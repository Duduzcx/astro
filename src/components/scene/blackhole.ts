import * as THREE from 'three'
import { HOLE_NORMAL } from './triangles'

/**
 * O buraco negro, do jeito que uma simulação mostra (Interstellar, EHT):
 *
 * - a sombra: um disco preto-tinta de borda nítida, tapando tudo atrás —
 *   estrelas, campo, o lado de trás do disco;
 * - o anel de fótons: um fio branco colado à sombra, a luz que deu uma
 *   volta inteira antes de escapar, com um halo frio curto por fora — o
 *   céu deformado pela lente;
 * - o disco de acreção quase de lado, no plano dos triângulos, com
 *   brilho que cai para fora, cor que esfria do branco ao vermelho
 *   profundo, estrias turbulentas girando mais depressa por dentro, e o
 *   efeito Doppler relativístico: o lado que vem na nossa direção brilha
 *   mais e mais azul, o que se afasta apaga e avermelha;
 * - dois arcos de pé atrás da sombra, por cima e por baixo: a imagem do
 *   lado de trás do disco dobrada pela gravidade, o que faz a silhueta
 *   clássica sem traçar raio nenhum;
 * - um jato polar tênue, azul-branco, saindo pelo eixo do disco.
 *
 * Sem ruído por pixel: a turbulência vem de uma textura de ruído
 * periódico gerada uma vez na CPU, amostrada em coordenadas polares.
 * Três leituras de textura e um punhado de contas por pixel.
 *
 * `presence` é o peso da forma (1 quando os triângulos são o buraco negro),
 * `mix` a dispersão do campo: o disco só aparece com o campo agrupado.
 */
export type BlackHoleState = {
  x: number
  y: number
  scale: number
  opacity: number
  presence: number
  mix: number
}

/* Raio da sombra. Na geometria de Schwarzschild a sombra tem ~2,6 raios
   gravitacionais e a órbita estável mais interna do disco fica em 3, então
   a borda interna do disco cai um pouco fora do anel de fótons. */
const HORIZON = 0.4
const INNER = 0.47
/* Borda externa curta: dali para fora o brilho já é quase zero e cada
   pixel do anel custa fill rate. */
const OUTER = 1.42

/* Coordenadas polares vêm do vértice: uv.x é o ângulo em voltas (0 a 1),
   uv.y o raio normalizado (0 na borda interna, 1 na externa). aBeam é o
   cosseno entre a velocidade orbital e a câmera, aFade um peso extra por
   vértice (os arcos apagam nas pontas). */
const DISC_VERTEX = /* glsl */ `
  attribute float aBeam;
  attribute float aFade;
  varying vec2 vPolar;
  varying float vBeam;
  varying float vFade;
  void main() {
    vPolar = uv;
    vBeam = aBeam;
    vFade = aFade;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const DISC_FRAGMENT = /* glsl */ `
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uGain;
  uniform float uFlow;
  varying vec2 vPolar;
  varying float vBeam;
  varying float vFade;

  /* Corpo negro de mentira: do vermelho profundo ao azul-branco. */
  vec3 heatColor(float h) {
    vec3 c = mix(vec3(0.42, 0.05, 0.005), vec3(1.0, 0.36, 0.06), smoothstep(0.0, 0.32, h));
    c = mix(c, vec3(1.0, 0.72, 0.36), smoothstep(0.32, 0.6, h));
    c = mix(c, vec3(1.0, 0.94, 0.84), smoothstep(0.6, 0.88, h));
    c = mix(c, vec3(0.82, 0.88, 1.0), smoothstep(0.88, 1.2, h));
    return c;
  }

  void main() {
    float u = vPolar.x;
    float rn = vPolar.y;

    /* Rotação diferencial sem cisalhamento infinito: duas cópias do mesmo
       ruído girando rígidas, uma rápida por dentro e uma lenta por fora,
       cruzadas pelo raio. Um cisalhamento fixo torce as estrias em espiral.
       O múltiplo inteiro de voltas mantém a costura invisível na textura
       periódica. */
    float twist = rn * 0.75;
    /* Uma volta a cada ~15 s por dentro, ~45 s por fora: dá para ver o gás
       andar sem virar ventilador. */
    vec2 uvA = vec2(u * 3.0 - uFlow * uTime * 0.2 + twist, rn * 1.6 + 0.11);
    vec2 uvB = vec2(u * 3.0 - uFlow * uTime * 0.065 + twist, rn * 1.6 + 0.11);
    float nA = texture2D(uNoise, uvA).r;
    float nB = texture2D(uNoise, uvB).r;
    float inner = 1.0 - smoothstep(0.05, 0.62, rn);
    float turb = mix(nB, nA, inner);
    /* Grão fino em estrias compridas, girando numa velocidade do meio. */
    vec2 uvF = vec2(u * 5.0 - uFlow * uTime * 0.12 + rn * 1.3, rn * 2.4 + 0.47);
    float fine = texture2D(uNoise, uvF).g;

    /* Brilho cai para fora, e o gás aparece em faixas: as estrias comem o
       fundo entre elas. */
    float radial = pow(1.0 - rn, 1.5);
    float bands = smoothstep(0.18, 0.95, turb) * 0.85 + 0.15;
    float grain = 0.7 + 0.6 * fine;
    /* Borda externa rasgada pelo ruído, não uma elipse desenhada a
       compasso; borda interna quente e nítida. */
    float edge = smoothstep(1.0, 0.72, rn + (nB - 0.5) * 0.35);
    float lip = smoothstep(0.0, 0.035, rn);
    float hotLip = 1.0 + 0.9 * smoothstep(0.12, 0.0, rn);

    /* Doppler: fator D = 1/(1 - β cos θ). A velocidade cai com a raiz do
       raio, como órbita kepleriana. Intensidade vai com D², e a
       temperatura aparente também sobe com D, o que empurra o lado que
       vem para o branco-azul e o que vai para o vermelho. */
    float beta = 0.42 * inversesqrt(1.0 + rn * 2.0);
    float d = 1.0 / (1.0 - beta * vBeam);
    float beam = clamp(d * d, 0.35, 2.0);
    /* Temperatura aparente: branco só na borda interna do lado que vem;
       o grosso do disco fica no laranja-ouro e a borda externa esfria até
       o vermelho profundo. É o que separa um disco de acreção de uma
       fumaça branca. */
    float heat = (0.66 - rn * 0.58) * (0.9 + 0.2 * turb) * pow(d, 1.1)
      * (1.0 + 0.5 * smoothstep(0.12, 0.0, rn));
    vec3 color = heatColor(heat);

    /* Energia por camada com teto: aditivo com alfa acima de 1 estourava
       tudo em branco e o bloom do desktop virava um borrão. O joelho
       exponencial mantém as estrias no corpo do disco e deixa só a borda
       quente e o lado que vem passarem do limiar do bloom. */
    float energy = radial * bands * grain * beam * edge * lip * hotLip * vFade;
    float alpha = 1.15 * (1.0 - exp(-energy * 0.9));
    gl_FragColor = vec4(color, alpha * uOpacity * uGain);
  }
`

/* Sombra e anel de fótons no mesmo plano de tela: a sombra é um disco
   preto com borda suavizada pela derivada (nítida em qualquer resolução,
   sem serrilhado nem borrão); o anel, um fio quente com halo frio curto. */
const FLAT_VERTEX = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const HORIZON_FRAGMENT = /* glsl */ `
  varying vec2 vPos;
  void main() {
    float r = length(vPos);
    float aa = fwidth(r) * 0.9;
    float alpha = 1.0 - smoothstep(${HORIZON.toFixed(2)} - aa, ${HORIZON.toFixed(2)} + aa, r);
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
  }
`

const RING_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uTime;
  uniform vec2 uBright;
  varying vec2 vPos;
  void main() {
    float r = length(vPos);
    float aa = fwidth(r);
    /* O fio: nasce na borda da sombra e cai rápido para fora. Um pouco
       mais forte do lado que vem na nossa direção, como o disco. */
    float side = 0.8 + 0.4 * dot(normalize(vPos), uBright);
    float ring = smoothstep(${HORIZON.toFixed(2)} - aa, ${HORIZON.toFixed(2)} + 0.005, r)
      * exp(-(r - ${HORIZON.toFixed(2)}) * 75.0);
    /* Halo frio curto: o céu dobrado em volta da sombra. */
    float halo = smoothstep(${HORIZON.toFixed(2)}, ${HORIZON.toFixed(2)} + 0.01, r)
      * exp(-(r - ${HORIZON.toFixed(2)}) * 9.0) * 0.16;
    float flicker = 0.94 + 0.06 * sin(uTime * 2.3 + r * 40.0);
    /* Acima de 1 de propósito: é o fio que o bloom deve pegar. */
    vec3 color = vec3(1.0, 0.97, 0.92) * ring * side * flicker * 1.3 + vec3(0.55, 0.7, 1.0) * halo;
    float alpha = min(ring * side * 1.2, 1.0) + halo;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`

/* Jato polar: um véu azul-branco no eixo do disco, mais denso perto dos
   polos e sumindo ao longe. Fica atrás da sombra, que o tapa no meio. */
const JET_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vPos;
  void main() {
    float along = abs(vPos.y);
    float across = abs(vPos.x);
    /* Abre um pouco com a distância, como um cone. */
    float width = 0.07 + along * 0.13;
    float core = exp(-(across * across) / (width * width));
    float reach = smoothstep(0.3, 0.5, along) * exp(-(along - 0.5) * 1.3);
    /* Nós de brilho subindo pelo jato, devagar: o feixe respira. */
    float knots = 0.8 + 0.2 * sin(along * 9.0 - uTime * 0.9);
    float pulse = 0.9 + 0.1 * sin(uTime * 1.1 + along * 6.0);
    /* A sombra tapa o jato no meio: o quad está no plano da tela, centrado
       no buraco, então a máscara é o próprio raio — sem depender do
       buffer de profundidade. */
    float r = length(vPos);
    float shadow = smoothstep(${HORIZON.toFixed(2)}, ${HORIZON.toFixed(2)} + 0.02, r);
    float alpha = core * reach * knots * pulse * shadow * 0.6;
    gl_FragColor = vec4(vec3(0.62, 0.76, 1.0), alpha * uOpacity);
  }
`

/**
 * Ruído periódico em valor, quatro oitavas, gerado uma vez. R: estrias
 * largas; G: grão fino; B: sobra para quem precisar. A malha de cada
 * oitava fecha em si mesma, então a textura repete sem costura nos dois
 * eixos.
 */
function makeNoiseTexture(size: number) {
  const data = new Uint8Array(size * size * 4)
  const hash = (x: number, y: number, seed: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return s - Math.floor(s)
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const valueNoise = (x: number, y: number, period: number, seed: number) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = fade(x - x0)
    const fy = fade(y - y0)
    const ix0 = ((x0 % period) + period) % period
    const iy0 = ((y0 % period) + period) % period
    const ix1 = (ix0 + 1) % period
    const iy1 = (iy0 + 1) % period
    const a = hash(ix0, iy0, seed)
    const b = hash(ix1, iy0, seed)
    const c = hash(ix0, iy1, seed)
    const d = hash(ix1, iy1, seed)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }
  const fbm = (u: number, v: number, base: number, octaves: number, seed: number) => {
    let sum = 0
    let amp = 0.5
    let period = base
    let norm = 0
    for (let o = 0; o < octaves; o += 1) {
      sum += amp * valueNoise(u * period, v * period, period, seed + o * 3.1)
      norm += amp
      amp *= 0.55
      period *= 2
    }
    return sum / norm
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size
      const i = (y * size + x) * 4
      /* Estrias: malha esticada no eixo do ângulo (u), fina no raio (v). */
      const streak = fbm(u, v * 5, 4, 4, 1)
      const grain = fbm(u * 2, v * 8, 8, 3, 7)
      const spare = fbm(u, v, 4, 3, 13)
      data[i] = Math.round(Math.min(Math.max((streak - 0.5) * 1.9 + 0.5, 0), 1) * 255)
      data[i + 1] = Math.round(Math.min(Math.max((grain - 0.5) * 2.2 + 0.5, 0), 1) * 255)
      data[i + 2] = Math.round(spare * 255)
      data[i + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  /* Sem mipmaps: a costura do atan2 faz a derivada explodir e o nível
     grosso do mip pintaria uma linha borrada no disco. */
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

/**
 * Disco em malha polar: anéis por raio, colunas por ângulo, com a coluna da
 * costura duplicada para o uv.x nunca interpolar de 1 para 0. `beam` é o
 * cosseno da velocidade orbital com a câmera, calculado por vértice.
 */
function discGeometry(segments: number, rings: number, beam: (angle: number) => number) {
  const positions: number[] = []
  const uvs: number[] = []
  const beams: number[] = []
  const fades: number[] = []
  const indices: number[] = []
  for (let j = 0; j <= rings; j += 1) {
    const rn = j / rings
    const r = INNER + (OUTER - INNER) * rn
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments
      const a = t * Math.PI * 2
      positions.push(Math.cos(a) * r, Math.sin(a) * r, 0)
      uvs.push(t, rn)
      beams.push(beam(a))
      fades.push(1)
    }
  }
  for (let j = 0; j < rings; j += 1) {
    for (let i = 0; i < segments; i += 1) {
      const a = j * (segments + 1) + i
      const b = a + segments + 1
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  return buildGeometry(positions, uvs, beams, fades, indices)
}

/**
 * Arco lenteado: uma faixa de pé no plano da tela, abraçando a sombra no
 * ápice e afinando até as pontas, onde encontra o disco. `height` é a
 * espessura no ápice; `beamAt` dá o Doppler pela direção na tela.
 */
function arcGeometry(
  segments: number,
  rings: number,
  height: number,
  beamAt: (x: number, y: number) => number,
) {
  const positions: number[] = []
  const uvs: number[] = []
  const beams: number[] = []
  const fades: number[] = []
  const indices: number[] = []
  const hug = HORIZON + 0.025
  for (let j = 0; j <= rings; j += 1) {
    const s = j / rings
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments
      const theta = t * Math.PI
      const lift = Math.pow(Math.sin(theta), 0.65)
      /* Nas pontas a faixa sobe até o raio do disco; no ápice cola na sombra. */
      const inner = hug + (INNER + 0.08 - hug) * (1 - lift)
      const outer = inner + height * (0.35 + 0.65 * lift)
      const r = inner + (outer - inner) * s
      const x = Math.cos(theta) * r
      const y = Math.sin(theta) * r
      positions.push(x, y, 0)
      /* A imagem do lado de trás cobre meia volta do disco. */
      uvs.push(0.5 + t * 0.5, s)
      beams.push(beamAt(x, y))
      /* Apaga nas pontas, onde o disco de verdade já brilha. */
      fades.push(Math.pow(Math.sin(theta), 0.45))
    }
  }
  for (let j = 0; j < rings; j += 1) {
    for (let i = 0; i < segments; i += 1) {
      const a = j * (segments + 1) + i
      const b = a + segments + 1
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  return buildGeometry(positions, uvs, beams, fades, indices)
}

function buildGeometry(
  positions: number[],
  uvs: number[],
  beams: number[],
  fades: number[],
  indices: number[],
) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('aBeam', new THREE.Float32BufferAttribute(beams, 1))
  geometry.setAttribute('aFade', new THREE.Float32BufferAttribute(fades, 1))
  geometry.setIndex(indices)
  return geometry
}

function discMaterial(noise: THREE.Texture, gain: number, flow: number) {
  return new THREE.ShaderMaterial({
    vertexShader: DISC_VERTEX,
    fragmentShader: DISC_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uNoise: { value: noise },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uGain: { value: gain },
      uFlow: { value: flow },
    },
  })
}

export function createBlackHole({ segments, lightweight = false }: { segments: number; lightweight?: boolean }) {
  const object = new THREE.Group()
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const noise = makeNoiseTexture(256)

  /* Orientação do disco: o quatérnio leva o plano XY local ao plano dos
     triângulos. A câmera olha ao longo de -Z sem girar, então "para a
     câmera" é +Z do mundo e a tela é o plano XY. */
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), HOLE_NORMAL)
  const tangent = new THREE.Vector3()
  const discBeam = (a: number) => {
    tangent.set(-Math.sin(a), Math.cos(a), 0).applyQuaternion(quaternion)
    return tangent.z
  }
  /* Na tela: o eixo menor da elipse é a projeção da normal; o lado de trás
     do disco fica do lado +normal, o da frente do lado -normal. O eixo
     maior é perpendicular, e a ponta que vem na nossa direção é a que tem
     a velocidade orbital com Z positivo. */
  const minor = new THREE.Vector2(HOLE_NORMAL.x, HOLE_NORMAL.y).normalize()
  const major = new THREE.Vector2(minor.y, -minor.x)
  let approach = 1
  {
    /* Ângulo local cuja projeção cai sobre +major. */
    const point = new THREE.Vector3()
    let best = -Infinity
    let bestAngle = 0
    for (let i = 0; i < 360; i += 1) {
      const a = (i / 360) * Math.PI * 2
      point.set(Math.cos(a), Math.sin(a), 0).applyQuaternion(quaternion)
      const along = point.x * major.x + point.y * major.y
      if (along > best) {
        best = along
        bestAngle = a
      }
    }
    approach = discBeam(bestAngle) >= 0 ? 1 : -1
  }
  /* Doppler dos arcos pela direção na tela: cosseno com o eixo maior,
     escalado pela inclinação, o mesmo teto do disco. */
  const tilt = Math.sqrt(1 - HOLE_NORMAL.z * HOLE_NORMAL.z)
  const arcBeam = (rotation: number) => (x: number, y: number) => {
    const c = Math.cos(rotation)
    const s = Math.sin(rotation)
    const wx = x * c - y * s
    const wy = x * s + y * c
    const len = Math.hypot(wx, wy) || 1
    return (approach * tilt * (wx * major.x + wy * major.y)) / len
  }
  /* Sentido do fluxo nos arcos: o lado de trás anda em direção à ponta
     que se aproxima; no referencial do arco (θ = 0 na ponta +major) isso
     é θ decrescente quando +major se aproxima. */
  const arcFlow = -approach

  /* Sombra: disco preto de borda nítida, escrevendo profundidade para
     tapar tudo o que está atrás. */
  const horizonGeometry = new THREE.CircleGeometry(HORIZON + 0.02, 96)
  const horizonMaterial = new THREE.ShaderMaterial({
    vertexShader: FLAT_VERTEX,
    fragmentShader: HORIZON_FRAGMENT,
    transparent: true,
    depthWrite: true,
  })
  const horizon = new THREE.Mesh(horizonGeometry, horizonMaterial)
  horizon.renderOrder = -4
  object.add(horizon)
  geometries.push(horizonGeometry)
  materials.push(horizonMaterial)

  /* Jato polar, atrás da sombra, ao longo da projeção do eixo do disco. */
  const jetGeometry = new THREE.PlaneGeometry(1.4, 3.6)
  const jetMaterial = new THREE.ShaderMaterial({
    vertexShader: FLAT_VERTEX,
    fragmentShader: JET_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
  })
  const jet = new THREE.Mesh(jetGeometry, jetMaterial)
  jet.rotation.z = Math.atan2(minor.y, minor.x) - Math.PI / 2
  jet.position.z = -0.3
  jet.renderOrder = -3
  jet.visible = !lightweight
  object.add(jet)
  geometries.push(jetGeometry)
  materials.push(jetMaterial)

  /* Arcos lenteados: o de cima é a imagem do lado de trás do disco, largo;
     o de baixo, a imagem secundária do lado da frente, estreito e fraco. */
  const topRotation = Math.atan2(minor.y, minor.x) - Math.PI / 2
  const topGeometry = arcGeometry(segments, 6, 0.5, arcBeam(topRotation))
  const topMaterial = discMaterial(noise, 0.8, arcFlow)
  const top = new THREE.Mesh(topGeometry, topMaterial)
  top.rotation.z = topRotation
  top.position.z = -0.05
  top.renderOrder = -2
  object.add(top)
  geometries.push(topGeometry)
  materials.push(topMaterial)

  const bottomRotation = topRotation + Math.PI
  const bottomGeometry = arcGeometry(Math.max(24, segments >> 1), 4, 0.2, arcBeam(bottomRotation))
  const bottomMaterial = discMaterial(noise, 0.65, arcFlow)
  const bottom = new THREE.Mesh(bottomGeometry, bottomMaterial)
  bottom.rotation.z = bottomRotation
  bottom.position.z = -0.05
  bottom.renderOrder = -2
  bottom.visible = !lightweight
  object.add(bottom)
  geometries.push(bottomGeometry)
  materials.push(bottomMaterial)

  /* O disco, no plano dos triângulos. */
  const discGeo = discGeometry(segments, lightweight ? 8 : 12, discBeam)
  const discMat = discMaterial(noise, 1, 1)
  const disc = new THREE.Mesh(discGeo, discMat)
  disc.quaternion.copy(quaternion)
  disc.renderOrder = -1
  object.add(disc)
  geometries.push(discGeo)
  materials.push(discMat)

  /* Anel de fótons, no plano da tela, por cima de tudo. */
  const ringGeometry = new THREE.RingGeometry(HORIZON - 0.01, HORIZON + 0.36, 96, 1)
  const ringMaterial = new THREE.ShaderMaterial({
    vertexShader: FLAT_VERTEX,
    fragmentShader: RING_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uBright: { value: new THREE.Vector2(major.x * approach, major.y * approach) },
    },
  })
  const ring = new THREE.Mesh(ringGeometry, ringMaterial)
  ring.position.z = 0.002
  ring.renderOrder = 1
  object.add(ring)
  geometries.push(ringGeometry)
  materials.push(ringMaterial)

  const timed = [discMat, topMaterial, bottomMaterial, ringMaterial, jetMaterial]

  return {
    object,
    update(state: BlackHoleState, time: number) {
      /* Só com o campo agrupado: disperso, o disco não tem o que enfeitar. */
      const grouped = 1 - Math.min(Math.max((state.mix - 0.25) / 0.6, 0), 1)
      const strength = state.opacity * state.presence * grouped
      object.visible = strength > 0.01
      if (!object.visible) return
      object.position.set(state.x, state.y, 0)
      object.scale.setScalar(state.scale)
      for (const material of timed) {
        material.uniforms.uTime.value = time
        material.uniforms.uOpacity.value = strength
      }
    },
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
      noise.dispose()
    },
  }
}
