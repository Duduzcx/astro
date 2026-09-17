import * as THREE from 'three'
import { SIMPLEX_NOISE } from './glsl'
import { createGalaxies } from './galaxies'

/**
 * O espaço em si: uma esfera enorme virada para dentro com um panorama da
 * Via Láctea, puxado para o azul da marca, girando devagar com o scroll para
 * dar paralaxe atrás das estrelas e dos astros. Por cima do panorama vai uma
 * camada de nebulosas — cobalto, violeta e um toque de turquesa, com
 * filamentos e faixas de poeira escura — assada UMA vez na GPU numa textura
 * e depois lida com uma amostra por pixel, então custa o mesmo no celular
 * e no desktop. Enquanto a textura da galáxia não chega, a esfera é
 * invisível e o fundo é o onyx.
 */
const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/* A nebulosa cobre só a faixa do céu que a página mostra: 1/3 da volta em
   longitude (repete sem emenda) e a metade central em latitude. Assim a
   textura gasta os pixels onde eles aparecem. */
const NEBULA_TILES = 3.0

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uNebulaMap;
  uniform float uIntensity;
  uniform float uSparkle;
  uniform vec3 uTint;
  uniform vec3 uBase;
  uniform float uNebula;
  uniform float uShift;
  varying vec2 vUv;
  void main() {
    vec3 sky = texture2D(uMap, vUv).rgb;
    /* Curva de contraste: o véu cinza fraco do panorama continua discreto,
       mas a faixa densa da galáxia ganha corpo (o termo quadrático só pesa
       onde o panorama já é claro). A cor vai um pouco para o azul da marca
       para não brigar com a paleta; o onyx da página é a base. */
    float lum = dot(sky, vec3(0.299, 0.587, 0.114));
    /* O termo quadrático é o que faz ponto brilhante saltar da fotografia:
       ele só pesa onde o panorama já é claro, ou seja, exatamente em cima de
       cada estrela. Ele é o verdadeiro controle de quantidade de estrelas
       deste céu — não o gerador procedural, que no celular nem roda. Com
       uSparkle baixo, as fracas afundam no fundo e sobram as poucas que
       valem; a faixa densa da galáxia continua, porque ali a luminância é
       alta por área e não por ponto. */
    vec3 lifted = sky * uIntensity + sky * sky * uSparkle;
    float lumLifted = lum * uIntensity + lum * lum * uSparkle;
    vec3 color = mix(lifted, uTint * lumLifted, 0.4);
    /* Nebulosa: desliza um pouco mais devagar que o panorama (uShift), o
       que dá paralaxe entre as duas camadas. A poeira no canal alfa
       escurece a galáxia atrás, para as faixas escuras lerem. */
    vec2 nuv = vec2(vUv.x * ${NEBULA_TILES.toFixed(1)} + uShift, (vUv.y - 0.5) * 2.0 + 0.5);
    vec4 neb = texture2D(uNebulaMap, nuv);
    color = color * (1.0 - neb.a * 0.75) + neb.rgb * uNebula;
    gl_FragColor = vec4(uBase + color, 1.0);
  }
`

/**
 * O assador da nebulosa: roda uma vez num quad para uma textura. Ruído
 * simplex com o domínio dobrado sobre si mesmo (é isso que faz os
 * filamentos parecerem gás, e não manchas), em três camadas: uma máscara
 * grande escolhe ONDE há nebulosa, para o céu não virar um nevoeiro
 * uniforme; o ruído dobrado dá as nuvens; o ruído "cordilheira"
 * (1 - |n|) dá os fios brilhantes. A poeira vai no alfa. O u dá a volta
 * num círculo no espaço do ruído, então a textura repete sem emenda.
 */
const BAKE_FRAGMENT = /* glsl */ `
  uniform float uSeed;
  varying vec2 vUv;
  ${SIMPLEX_NOISE}
  vec3 dom(vec2 uv) {
    float a = uv.x * 6.2831853;
    /* Circunferência 4 : profundidade 3, a proporção da faixa do céu que
       a textura cobre (120° por 90°). */
    return vec3(cos(a) * 0.6366, sin(a) * 0.6366, uv.y * 3.0) * 2.1;
  }
  float ridged(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i += 1) {
      sum += amp * (1.0 - abs(snoise(p)));
      p = p * 2.1 + 7.3;
      amp *= 0.5;
    }
    return sum;
  }
  float hash21(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
  }
  void main() {
    vec3 p = dom(vUv) + uSeed;
    /* Máscara grande: dois ou três complexos, com céu limpo entre eles. */
    float m = fbm(p * 0.33 + 20.0);
    float mask = smoothstep(-0.05, 0.45, m);
    /* Domínio dobrado: o gás. */
    vec3 q = vec3(fbm(p + 1.7), fbm(p + 9.2), fbm(p - 4.1));
    vec3 w = p + q * 1.5;
    float n = fbm(w);
    float cloud = smoothstep(-0.25, 0.55, n);
    /* Detalhe fino por cima: sem ele as nuvens são manchas lisas de
       tinta; com ele viram textura de gás. */
    cloud *= 0.72 + 0.5 * fbm3(w * 3.2 + 50.0);
    /* Fios brilhantes, só dentro das nuvens. */
    float r = ridged(w * 1.7 + 3.0);
    float fil = smoothstep(0.62, 0.98, r) * cloud;
    /* Poeira: faixas escuras cortando o gás, mais fortes no miolo. */
    float d = fbm(w * 2.3 - 5.0);
    float dust = smoothstep(0.16, 0.44, d) * mask * (0.4 + 0.6 * cloud);
    /* Borda acesa: onde a poeira encosta no gás, a frente da nuvem
       brilha (a orla clara das fotos do Hubble). */
    float rim = smoothstep(0.06, 0.16, d) * smoothstep(0.28, 0.17, d) * cloud * mask;
    float density = mask * (cloud * 0.75 + fil * 1.1 + rim * 0.55) * (1.0 - dust * 0.85);
    /* Cor: cobalto no geral, violeta por regiões, turquesa em veios e um
       bolsão rosado (hidrogênio) numa região só. O miolo mais denso
       clareia para um lilás quase branco. */
    float hueT = fbm(p * 0.6 + 40.0);
    vec3 cobalt = vec3(0.16, 0.40, 0.98);
    vec3 violet = vec3(0.50, 0.30, 0.90);
    vec3 teal = vec3(0.20, 0.78, 0.86);
    vec3 rose = vec3(0.96, 0.45, 0.58);
    vec3 tone = mix(cobalt, violet, smoothstep(-0.25, 0.3, hueT));
    tone = mix(tone, teal, smoothstep(0.15, 0.5, fbm(p * 1.1 - 30.0)) * 0.55);
    tone = mix(tone, rose, smoothstep(0.28, 0.55, fbm(p * 0.5 - 60.0)) * 0.7);
    vec3 col = tone * density + vec3(0.92, 0.86, 1.0) * (fil * fil * 0.7 + rim * 0.25) * mask;
    /* Estrelas fracas e densas, assadas junto: uma por célula, quase todas
       apagadas, poucas visíveis, atrás da poeira. As células são quadradas
       em graus (a textura é 1,5x mais esticada na vertical). Como a camada
       desliza com a nebulosa e não com o campo de pontos, vira mais um
       plano de paralaxe de graça. */
    /* Menos células e um corte mais alto. Antes eram 360 por 270, quase cem
       mil estrelas com metade delas acesa: cortar o campo de pontos de 900
       para 150 não mudava nada, porque a esmagadora maioria do que se via
       estava assada aqui, não nos pontos. */
    vec2 cell = vUv * vec2(96.0, 72.0);
    vec2 id = floor(cell);
    float h = hash21(id);
    vec2 center = vec2(hash21(id + 7.1), hash21(id + 3.3)) * 0.5 + 0.25;
    float dist = length(fract(cell) - center);
    float bright = smoothstep(0.88, 1.0, h);
    float star = smoothstep(0.3, 0.02, dist) * bright * bright * 0.7;
    vec3 starTone = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.9, 0.72), step(0.7, hash21(id + 11.7)));
    col += starTone * star * (1.0 - dust * 0.7);
    /* Some para as bordas de latitude, onde a textura é presa. */
    float edge = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
    gl_FragColor = vec4(col * edge, dust * edge);
  }
`

/** A orientação do céu numa fração da página: a régua da paralaxe. */
export function skyRotation(progress: number, time = 0, target = new THREE.Euler()) {
  /* 1,2 radianos ao longo da página: o céu passa de verdade enquanto a
     nave viaja, e as galáxias distantes entram e saem de cena. */
  /* Sem termo de tempo: o céu gira SÓ com a página. Girando sozinho, cada
     estrela de um pixel andava uma fração de pixel por frame e acendia e
     apagava — mil pontos fazendo isso ao mesmo tempo é a tela piscando. O
     que dá vida ao céu parado é a nebulosa deslizando, que é contínua. */
  /* Uma deriva mínima no tempo: a mil avos de radiano por segundo o céu
     nunca está parado, e é lento demais para uma estrela andar meio pixel
     entre dois quadros — que era o que fazia a tela piscar. */
  return target.set(0.2 - progress * 0.3, -0.9 + progress * 1.2 + time * 0.001, 0)
}

export type SpaceOptions = {
  /** Quem assa a nebulosa. Sem renderer, a esfera fica só com o panorama. */
  renderer?: THREE.WebGLRenderer
  /** Tamanho da textura assada: menor no celular. */
  bakeSize?: [number, number]
  /** Galáxias distantes presas ao céu; a vista posiciona cada uma. */
  view?: { halfWidth: number; halfHeight: number; cameraZ: number }
  /** Quanto o termo quadrático realça os pontos claros da fotografia. É o
      controle de quantidade de estrelas do céu: 2,8 é o padrão de tela
      grande, valores baixos afundam as fracas e deixam só as fortes. */
  sparkle?: number
}

export function createSpace(
  urls: { low: string; high: string },
  nebula = 0,
  warm?: (texture: THREE.Texture) => void,
  options: SpaceOptions = {},
) {
  const geometry = new THREE.SphereGeometry(14, 48, 32)
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uMap: { value: null },
      uNebulaMap: { value: null },
      uIntensity: { value: options.sparkle !== undefined && options.sparkle < 1 ? 0.8 : 1.2 },
      uSparkle: { value: options.sparkle ?? 2.8 },
      uTint: { value: new THREE.Color('#8db4f5') },
      uBase: { value: new THREE.Color('#0a0f1e') },
      uNebula: { value: 0 },
      uShift: { value: 0 },
    },
  })
  const object = new THREE.Mesh(geometry, material)
  object.renderOrder = -20
  object.visible = false
  object.frustumCulled = false

  /* Nebulosa assada. Sem renderer (ou sem nebulosa), um pixel transparente
     mantém o shader único. */
  let bakeTarget: THREE.WebGLRenderTarget | null = null
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
  blank.needsUpdate = true
  material.uniforms.uNebulaMap.value = blank
  if (options.renderer && nebula > 0) {
    const [w, h] = options.bakeSize ?? [1536, 768]
    bakeTarget = new THREE.WebGLRenderTarget(w, h, {
      /* Com mipmap. A textura assada é grande e quase sempre aparece
         minificada na tela: sem níveis, cada pixel desenhado busca texels
         espalhados e o cache de textura não aproveita nada. Os níveis também
         tiram o chuvisco das estrelas assadas quando o céu gira devagar. */
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: true,
      depthBuffer: false,
      stencilBuffer: false,
    })
    const bakeMaterial = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: BAKE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: { uSeed: { value: 3.7 } },
    })
    const bakeGeometry = new THREE.PlaneGeometry(2, 2)
    const bakeScene = new THREE.Scene()
    bakeScene.add(new THREE.Mesh(bakeGeometry, bakeMaterial))
    const bakeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const renderer = options.renderer
    /* Assar em tiras, uma por frame.
       São dezenas de amostras de ruído por pixel em mais de um milhão de
       pixels: num desenho só a GPU some por vários segundos e a página fica
       branca esperando — era boa parte da demora que o cliente via ao
       entrar. Cada tira é uma tesoura no mesmo alvo, e entre elas o
       navegador pinta. A nebulosa aparece por partes no primeiro segundo,
       de cima para baixo, e ninguém percebe porque o céu ainda está
       entrando. */
    /* Faixas dimensionadas por pixel, não por número fixo. Com oito faixas,
       cada uma assava um oitavo de 1024x512 no celular e custava mais de
       cem milissegundos — um quadro perdido por faixa. Com um teto de
       trinta mil pixels por vez, cada passo cabe num quadro e o céu vai
       aparecendo de cima para baixo sem travar a rolagem. */
    const strips = Math.min(40, Math.max(8, Math.round((w * h) / 30000)))
    let strip = 0
    const viewportSize = new THREE.Vector2()
    const bakeStrip = () => {
      if (!bakeTarget) return
      const y = Math.floor((h * strip) / strips)
      const nextY = Math.floor((h * (strip + 1)) / strips)
      const previous = renderer.getRenderTarget()
      renderer.setRenderTarget(bakeTarget)
      renderer.setScissorTest(true)
      renderer.setScissor(0, y, w, nextY - y)
      renderer.setViewport(0, 0, w, h)
      renderer.render(bakeScene, bakeCamera)
      renderer.setScissorTest(false)
      renderer.setRenderTarget(previous)
      /* Devolver o viewport em unidades lógicas, não em pixels do buffer.
         `domElement.width` já vem multiplicado pela razão de pixels, e o
         `setViewport` multiplica de novo: num celular a 1,5 o viewport
         voltava 1,5 vez maior que a tela, ancorado no canto. A cena inteira
         era desenhada grande demais e empurrada para a direita — era isto
         que punha o foguete, o Sol, o buraco negro e a supernova no terço
         direito, e o que fazia o foguete parecer enorme e cortado. */
      renderer.getSize(viewportSize)
      renderer.setViewport(0, 0, viewportSize.x, viewportSize.y)
      strip += 1
      if (strip < strips) {
        requestAnimationFrame(bakeStrip)

      } else {
        bakeMaterial.dispose()
        bakeGeometry.dispose()
      }
    }
    /* Começa depois da primeira pintura: o programa da assadeira é o mais
       pesado de compilar de toda a cena, e compilá-lo antes do primeiro
       frame atrasa tudo o que o visitante vê. */
    /* A primeira faixa pagava, além do seu pedaço, a compilação do shader da
       nebulosa: era ela sozinha que aparecia no perfil como um bloqueio de
       mais de um segundo. Compilar antes, num quadro só para isso, separa as
       duas contas e nenhuma delas trava sozinha. */
    window.setTimeout(() => {
      /* `compileAsync` e não `compile`: o síncrono faz a ligação do programa
         no thread principal e vira ele mesmo o bloqueio — medido, a maior
         travada subiu de 1,8s para 2,8s. O assíncrono usa
         KHR_parallel_shader_compile onde existe, e o driver trabalha fora
         daqui. */
      void renderer
        .compileAsync(bakeScene, bakeCamera)
        .catch(() => undefined)
        .then(() => requestAnimationFrame(bakeStrip))
    }, 600)
    material.uniforms.uNebulaMap.value = bakeTarget.texture
    material.uniforms.uNebula.value = nebula
  }

  /* Galáxias distantes: filhas da esfera, giram com o céu. */
  const galaxies = options.view ? createGalaxies(options.view, skyRotation) : null
  if (galaxies) object.add(galaxies.object)

  const loader = new THREE.TextureLoader()
  const textures: THREE.Texture[] = []
  const apply = (loaded: THREE.Texture) => {
    loaded.colorSpace = THREE.NoColorSpace
    loaded.minFilter = THREE.LinearMipmapLinearFilter
    loaded.anisotropy = 8
    warm?.(loaded)
    material.uniforms.uMap.value = loaded
    object.visible = true
  }
  /* Em degraus: o leve aparece primeiro, o pesado substitui. */
  textures.push(
    loader.load(urls.low, (low) => {
      apply(low)
      textures.push(loader.load(urls.high, (high) => apply(high)))
    }),
  )

  return {
    object,
    update(progress: number, time: number) {
      /* Paralaxe: o céu gira devagar com a página e respira no tempo; a
         nebulosa fica um pouco para trás do panorama. */
      skyRotation(progress, time, object.rotation)
      material.uniforms.uShift.value = -progress * 0.09 - time * 0.0004
      galaxies?.update(time)
    },
    setIntensity(value: number) {
      material.uniforms.uIntensity.value = value
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      blank.dispose()
      bakeTarget?.dispose()
      galaxies?.dispose()
      for (const texture of textures) texture.dispose()
    },
  }
}
