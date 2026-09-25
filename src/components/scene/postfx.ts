import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

/**
 * A "lente": tudo o que uma câmera de cinema faz com a imagem, num passe só.
 *
 * - Vinheta e grão: os dois truques mais baratos de fotografia, e os que
 *   mais tiram o ar de render limpo demais.
 * - Profundidade de campo radial: nítido no centro, macio para os cantos,
 *   como lente aberta. Oito amostras num anel que cresce com a distância ao
 *   centro; o anel gira por pixel (hash fixo) para não deixar oito fantasmas.
 * - Dolly e aberração cromática presos à velocidade do scroll: rolando
 *   rápido a imagem fecha 3% do centro e o vermelho e o azul se separam
 *   1–2px nas bordas; parado, nada disso existe. É o que faz o scroll
 *   parecer movimento de câmera, não de página.
 *
 * Tudo aqui é leitura de textura no mesmo passe: nenhum passe de tela cheia
 * a mais foi adicionado.
 */
const FILM = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    /* A pirâmide do bloom já composta, a meia resolução. */
    tBloom: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uVignette: { value: 0.3 },
    /* Grão quase invisível: acima disso, sobre fundo escuro, o ruído por
       frame lê como chuvisco de TV, não como filme. */
    uGrain: { value: 0.004 },
    uEdgeBlur: { value: 0.0 },
    uZoom: { value: 1.0 },
    uAberration: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tBloom;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uEdgeBlur;
    uniform float uZoom;
    uniform float uAberration;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float d = length(centered);
      /* Dolly: o quadro é amostrado mais perto do centro, então a imagem
         cresce a partir dele. Zoom para dentro nunca lê fora da textura. */
      vec2 uv = 0.5 + centered / uZoom;

      vec4 base = texture2D(tDiffuse, uv);
      vec4 c = base;

      /* Profundidade de campo: o raio do anel cresce com a distância ao
         centro numa curva côncava, então o miolo da tela fica nítido de
         verdade e só os cantos amolecem. */
      float focus = smoothstep(0.3, 0.82, d);
      float amount = focus * sqrt(focus) * uEdgeBlur;
      /* Abaixo de ~1px de raio o anel não muda nada visível e custa nove
         leituras por pixel: o miolo da tela pula o laço inteiro. */
      if (amount > 0.001) {
        float spin = hash(vUv) * 6.2831853;
        vec4 acc = c * 2.0;
        for (int i = 0; i < 8; i++) {
          float a = spin + float(i) * 0.7853982;
          acc += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * amount);
        }
        c = acc / 10.0;
      }

      /* O halo do bloom entra aqui, numa leitura da pirâmide a meia
         resolução, em vez de num passe próprio de tela cheia sobre o
         quadro. Era o passe mais caro da lente depois da própria cena:
         ler e reescrever cada pixel em meio-float, 2,8ms por quadro no
         Intel Iris Xe, para somar uma textura que cabe numa leitura. O
         resultado é o mesmo (soma aditiva, mesma pirâmide, mesma força),
         só que sem o passe. */
      c.rgb += texture2D(tBloom, uv).rgb;

      /* Aberração cromática: vermelho para fora, azul para dentro, ao longo
         do raio. Zero no centro; nos cantos vale uAberration pixels. Entra
         como diferença sobre a amostra central, então onde há desfoque a
         franja se soma ao macio em vez de trazer um canal nítido de volta. */
      if (uAberration > 0.01) {
        vec2 shift = centered * (smoothstep(0.06, 0.7, d) * uAberration * 1.4) / uResolution;
        c.r += texture2D(tDiffuse, uv + shift).r - base.r;
        c.b += texture2D(tDiffuse, uv - shift).b - base.b;
      }

      c.rgb *= 1.0 - smoothstep(0.42, 0.95, d) * uVignette;
      /* Grão de filme: mora nos meios-tons e quase some no preto, que é
         onde o olho mais nota ruído; por pixel físico, fino de verdade. */
      float g = hash(gl_FragCoord.xy * 0.37 + fract(uTime * 0.37)) - 0.5;
      float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb += g * uGrain * (0.25 + 0.75 * smoothstep(0.0, 0.5, luma));
      gl_FragColor = c;
    }
  `,
}

/**
 * Bloom cinematográfico, só no desktop (o celular desenha direto, com MSAA):
 * o que passa do limiar (motor, disco de acreção, supernova, borda da
 * atmosfera) sangra luz.
 *
 * Três passes de tela cheia por quadro, e nem um a mais: a cena no alvo em
 * meio-float, a pirâmide do bloom (que trabalha a meia resolução e para
 * baixo) e o passe de filme, que soma o halo, aplica vinheta, grão, desfoque
 * de borda e aberração e entrega ao canvas. Cada passe de tela cheia custa
 * perto de 2,8ms num Intel Iris Xe, então cada um que existe precisa pagar
 * a passagem.
 */
export function createPostFx(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
) {
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType })
  const composer = new EffectComposer(renderer, target)
  composer.setPixelRatio(renderer.getPixelRatio())
  composer.addPass(new RenderPass(scene, camera))
  /* Limiar alto: só o que é luz de verdade sangra (motor, disco, núcleo da
     supernova, limbo da atmosfera). Abaixo disso o casco branco virava neve.
     Raio mais largo e força contida: o halo se espalha macio em vez de
     engrossar o branco em volta da fonte.
     O tamanho passado aqui é provisório: o setSize do composer dimensiona a
     pirâmide a partir da metade da resolução do alvo, e é ele quem vale. */
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.36, 0.62, 0.92)
  composer.addPass(bloom)
  const film = new ShaderPass(FILM)
  /* O passe de mistura do bloom não é desenhado: o UnrealBloomPass termina
     somando a pirâmide composta sobre o quadro inteiro, a resolução cheia, e
     o passe de filme lê a pirâmide direto (tBloom) e faz a mesma soma numa
     leitura. O quad interno do passe pula esse material e só ele. */
  const quad = (bloom as unknown as { _fsQuad: { material: THREE.Material; render(r: THREE.WebGLRenderer): void } })._fsQuad
  const desenharQuad = quad.render.bind(quad)
  quad.render = (r) => {
    if (quad.material !== bloom.blendMaterial) desenharQuad(r)
  }
  film.uniforms.tBloom.value = bloom.renderTargetsHorizontal[0].texture
  /* Os valores cheios da lente, guardados para a entrada gradual poder
     interpolar a partir de zero. */
  const forcaCheia = bloom.strength
  const vinhetaCheia = film.uniforms.uVignette.value as number
  const graoCheio = film.uniforms.uGrain.value as number
  film.uniforms.uResolution.value.set(width, height)
  composer.addPass(film)
  /* Escala dos alvos internos em relação ao canvas (1 = a mesma resolução). */
  let escala = 1
  /* Medidor de GPU: uma query de tempo em volta do composer.render, no
     Chromium (EXT_disjoint_timer_query_webgl2). Onde a extensão não existe a
     lente não mede nada, e quem decide é o medidor de quadros da cena. */
  const gl2 = renderer.getContext() instanceof WebGL2RenderingContext ? (renderer.getContext() as WebGL2RenderingContext) : null
  const cronometro = gl2 ? gl2.getExtension('EXT_disjoint_timer_query_webgl2') : null
  let aoMedir: ((medianaMs: number) => void) | null = null
  let descartar = 0
  const pendentes: WebGLQuery[] = []
  const amostras: number[] = []
  const colher = () => {
    if (!gl2 || !cronometro) return
    for (let i = pendentes.length - 1; i >= 0; i--) {
      const q = pendentes[i]
      if (!gl2.getQueryParameter(q, gl2.QUERY_RESULT_AVAILABLE)) continue
      if (!gl2.getParameter(cronometro.GPU_DISJOINT_EXT)) {
        if (descartar > 0) descartar -= 1
        else amostras.push((gl2.getQueryParameter(q, gl2.QUERY_RESULT) as number) / 1e6)
      }
      gl2.deleteQuery(q)
      pendentes.splice(i, 1)
    }
    if (aoMedir && amostras.length >= 24) {
      const ordenadas = [...amostras].sort((a, b) => a - b)
      const mediana = ordenadas[Math.floor(ordenadas.length / 2)]
      const avisar = aoMedir
      aoMedir = null
      amostras.length = 0
      avisar(mediana)
    }
  }
  return {
    /**
     * `edgeBlur` é o raio do anel nos cantos, em fração da tela. `rush`
     * (0..1) é a velocidade do scroll já amortecida: vira dolly de até 3% e
     * até 2px de franja nos cantos.
     */
    render(time: number, edgeBlur = 0, rush = 0) {
      const k = Math.min(rush * 1.6, 1)
      film.uniforms.uTime.value = time
      film.uniforms.uEdgeBlur.value = edgeBlur
      film.uniforms.uZoom.value = 1 + 0.03 * k
      film.uniforms.uAberration.value = 2.0 * k
      colher()
      const query = aoMedir && gl2 && cronometro ? gl2.createQuery() : null
      if (query && gl2 && cronometro) gl2.beginQuery(cronometro.TIME_ELAPSED_EXT, query)
      composer.render()
      if (query && gl2 && cronometro) {
        gl2.endQuery(cronometro.TIME_ELAPSED_EXT)
        pendentes.push(query)
      }
    },
    /**
     * Mede o tempo de GPU de um quadro da lente e chama `avisar` com a
     * mediana de 24 quadros, em milissegundos, ignorando os `pular`
     * primeiros. Só no Chromium; noutros navegadores nunca chama.
     */
    medirGpu(avisar: (medianaMs: number) => void, pular = 0) {
      if (!cronometro) return
      amostras.length = 0
      descartar = pular
      aoMedir = avisar
    },
    /**
     * Emite a compilação dos programas da lente sem esperar por eles: com o
     * KHR_parallel_shader_compile o driver liga em paralelo e a chamada volta
     * em milissegundos. Sem isto, o primeiro composer.render() ligava a
     * pirâmide inteira de forma síncrona: 2,8s presos num programa só, no
     * Windows, no instante em que o visitante clicava em Entrar.
     *
     * A variante importa. Os passes internos desenham em render targets, e o
     * three gera para isso um programa diferente do da tela (saída linear,
     * sem tone mapping); só o último passe desenha na tela. Compilar a
     * variante errada é gastar o driver à toa e travar do mesmo jeito.
     */
    aquecer(alvo: THREE.WebGLRenderTarget) {
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      /* O mesmo triângulo do FullScreenQuad do three, e sem normal de
         propósito: com PlaneGeometry o vértice ganhava um HAS_NORMAL, a chave
         do programa mudava e a lente ligava tudo de novo, de forma síncrona,
         no primeiro quadro. Medido: os oito programas voltavam ao perfil. */
      const quad = new THREE.BufferGeometry()
      quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3))
      quad.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2))
      const cena = (materiais: THREE.Material[]) => {
        const s = new THREE.Scene()
        for (const m of materiais) s.add(new THREE.Mesh(quad, m))
        return s
      }
      const internos: THREE.Material[] = [
        bloom.materialHighPassFilter,
        ...bloom.separableBlurMaterials,
        bloom.compositeMaterial,
      ]
      const anterior = renderer.getRenderTarget()
      renderer.setRenderTarget(alvo)
      const a = renderer.compile(cena(internos), cam)
      renderer.setRenderTarget(null)
      const b = renderer.compile(cena([film.material]), cam)
      renderer.setRenderTarget(anterior)
      quad.dispose()
      return new Set<THREE.Material>([...a, ...b])
    },
    setSize(w: number, h: number) {
      composer.setPixelRatio(renderer.getPixelRatio() * escala)
      composer.setSize(w, h)
      film.uniforms.uResolution.value.set(w, h)
    },
    /**
     * Escala dos alvos internos em relação ao canvas. É o degrau de
     * sobrevivência do desktop: a cena e a pirâmide passam a ser desenhadas
     * em menos pixels e o passe de filme amplia ao tamanho do canvas, que
     * não muda. Mudar o canvas (setSize do renderer) apaga o buffer por um
     * quadro, e esse quadro apagado era a piscada que o cliente via.
     */
    setScale(valor: number) {
      escala = valor
      composer.setPixelRatio(renderer.getPixelRatio() * escala)
    },
    setStrength(value: number) {
      bloom.strength = value
    },
    /**
     * Entrada da lente, de 0 a 1. A lente muda a imagem toda de uma vez
     * (halo, vinheta, grão), e ligá-la num quadro só é um estalo na tela.
     * Normalmente ela já está no lugar antes de a tela de entrada sair e
     * isto nem é usado; quando o driver demora e ela chega com o site à
     * vista, este mix a traz em alguns quadros.
     */
    setMix(value: number) {
      const v = Math.max(0, Math.min(1, value))
      bloom.strength = forcaCheia * v
      film.uniforms.uVignette.value = vinhetaCheia * v
      film.uniforms.uGrain.value = graoCheio * v
    },
    dispose() {
      aoMedir = null
      if (gl2) for (const q of pendentes) gl2.deleteQuery(q)
      pendentes.length = 0
      composer.dispose()
      target.dispose()
    },
  }
}
