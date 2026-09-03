import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Núcleo orbital: uma bola densa de triângulos vazados com três anéis
 * inclinados girando em velocidades diferentes. No scroll ele se espalha e
 * depois volta a se juntar. É um canvas fixo atrás do documento inteiro; cada
 * seção é um estado dessa mesma cena.
 */

/** Paleta azul: cobalto na frente, ivory segurando a base fria. */
const PALETTE: Array<[string, number]> = [
  ['#4d84e0', 0.2],
  ['#5a8fe8', 0.14],
  ['#8db4f5', 0.12],
  ['#6d9df0', 0.08],
  ['#a8c8ff', 0.08],
  ['#f5f7fb', 0.18],
  ['#b9c2d4', 0.12],
  ['#ffffff', 0.08],
]

function pickColor(target: THREE.Color, random: () => number) {
  let roll = random()
  for (const [hex, weight] of PALETTE) {
    roll -= weight
    if (roll <= 0) {
      target.set(hex)
      return
    }
  }
  target.set(PALETTE[0][0])
}

/**
 * Keyframes de scroll: [progresso da página, dispersão, x (fração da meia
 * largura), y, escala, opacidade]. Casados com a ordem das seções em App.tsx:
 * hero à direita, serviços à esquerda, manifesto disperso, missão reagrupada à
 * direita, equipe com campo ralo (os cards precisam de silêncio atrás) e
 * rodapé reagrupado no centro.
 */
const KEYFRAMES: Array<[number, number, number, number, number, number]> = [
  [0.0, 0.04, 0.52, 0.02, 0.88, 1.0],
  [0.035, 0.05, 0.52, 0.0, 0.88, 1.0],
  [0.075, 0.85, 0.0, 0.0, 1.25, 0.35],
  [0.23, 0.85, 0.0, 0.0, 1.25, 0.35],
  [0.26, 1.0, 0.0, 0.0, 1.12, 0.9],
  [0.29, 1.0, 0.0, 0.0, 1.12, 0.9],
  [0.31, 1.0, 0.0, 0.0, 1.12, 0.0],
  [0.33, 0.3, 0.55, 0.0, 0.9, 0.0],
  [0.35, 0.05, 0.55, 0.0, 0.9, 1.0],
  [0.385, 0.06, 0.55, 0.0, 0.9, 1.0],
  [0.42, 0.9, 0.0, 0.0, 1.35, 0.22],
  [0.445, 0.9, 0.0, 0.0, 1.35, 0.22],
  [0.47, 0.9, 0.0, 0.0, 1.35, 0.0],
  [0.5, 0.9, 0.0, 0.0, 1.35, 0.0],
  [0.53, 0.9, 0.0, 0.0, 1.35, 0.22],
  [0.95, 0.9, 0.0, 0.0, 1.35, 0.22],
  [1.0, 0.3, 0.0, -0.04, 0.9, 0.85],
]

type Keyframes = Array<[number, number, number, number, number, number]>

/**
 * Mesmo valor do breakpoint `lg` do Tailwind, que é onde o menu vira hambúrguer.
 * A cena e o CSS precisam trocar de composição na mesma largura: abaixo disso
 * valem a tabela do hero e as placas de contraste marcadas com `lg:hidden`;
 * acima, o layout de duas colunas e a tabela de página inteira.
 */
const MOBILE_BREAKPOINT = 1024

/** Raio do objeto agrupado em unidades de mundo: o anel externo para em 1.64. */
const OBJECT_RADIUS = 1.64

/**
 * O anel é um disco inclinado, então na tela o objeto é mais baixo do que
 * largo: a altura dá cerca de 60% da largura.
 */
const OBJECT_FLATTEN = 0.6

/**
 * Opacidade do objeto no hero e depois dele. Com a clareira do shader abrindo
 * espaço para o texto, o anel pode brilhar de verdade na primeira dobra; do
 * hero para baixo ele recua para grão de fundo atrás dos cards.
 */
const HERO_OPACITY = 0.95
const FIELD_OPACITY = 0.1

/**
 * Geometria da primeira dobra em fração da altura da tela (0 no topo): onde o
 * menu termina e onde o bloco de texto do hero começa e acaba. Medido no DOM
 * porque com 360px de largura o título quebra numa linha a mais e qualquer
 * número fixo erra. `offsetTop` ignora o transform de parallax, que é o que
 * queremos. Sem os elementos, assume uma dobra típica de celular.
 */
function measureHero() {
  const viewport = window.innerHeight
  const header = document.querySelector('header')
  const navBottom = header ? header.getBoundingClientRect().height / viewport : 0.07
  const copy = document.getElementById('hero-copy')
  if (!copy) return { navBottom, copyStart: 0.44, copyEnd: 0.95 }
  let node: HTMLElement | null = copy
  let top = 0
  while (node) {
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return {
    navBottom,
    copyStart: top / viewport,
    copyEnd: (top + copy.offsetHeight) / viewport,
  }
}

/** Faixa do texto do hero em NDC, [centro, raio], com folga de 18%. */
function heroCopyBand(): [number, number] {
  const { copyStart, copyEnd } = measureHero()
  return [1 - (copyStart + copyEnd), (copyEnd - copyStart) * 1.18]
}

/**
 * Tela estreita usa outra tabela. O objeto continua sendo fundo e o texto passa
 * por cima da borda dele — quem abre espaço para a leitura é a clareira do
 * shader, não uma placa opaca por cima do objeto.
 *
 * Na primeira dobra ele ocupa o vão entre o menu e o título, medido no DOM:
 * sem isso sobrava uma faixa morta de até metade da tela em aparelho alto.
 * Da dobra para baixo ele se espalha e cai para FIELD_OPACITY, virando grão de
 * fundo: continua lá a página inteira sem competir com os cards.
 */
function mobileKeyframes(halfWidth: number, halfHeight: number, maxScroll: number): Keyframes {
  /* O objeto mora no vão entre o menu e o título. Centro no meio desse vão;
     raio o bastante para preenchê-lo, sem passar da largura da tela nem
     encolher a ponto de virar mancha em tela baixa. */
  const { navBottom, copyStart } = measureHero()
  const gap = Math.max(copyStart - navBottom, 0.12)
  const centre = navBottom + gap / 2
  /* A altura do objeto na tela é 2 × OBJECT_FLATTEN × raio, e a tela inteira
     mede 2 × halfHeight: o raio que cabe no vão sai dessa proporção. */
  const gapRadius = ((gap * 0.98) / OBJECT_FLATTEN) * halfHeight
  const radius = Math.min(1.55 * halfWidth, Math.max(gapRadius, 0.85 * halfWidth))
  const scale = radius / OBJECT_RADIUS
  const y = (1 - 2 * centre) * halfHeight
  /* O disco é inclinado, então a caixa dele nasce torta: 0.09 recentraliza. */
  const x = 0.09

  /* Trechos medidos em telas de rolagem, não em fração da página: 6% de uma
     página de 25.000px são 1.500px, e o objeto ainda estaria brilhando muito
     depois do hero. */
  const screen = window.innerHeight / maxScroll
  const hold = Math.min(screen * 0.25, 0.2)
  const settle = Math.min(screen * 0.9, 0.5)

  return [
    /* Hero: objeto inteiro no vão entre o menu e o título. */
    [0.0, 0.03, x, y, scale, HERO_OPACITY],
    [hold, 0.05, x, y, scale, HERO_OPACITY],
    /* Ao sair da dobra ele se espalha e recua para textura de fundo. */
    [settle, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY],
    [0.93, 0.95, 0.0, 0.0, scale * 1.5, FIELD_OPACITY],
    /* Fechamento: reagrupa no centro para a última tela. */
    [0.98, 0.3, 0.0, -0.05, scale * 1.05, 0.45],
    [1.0, 0.1, 0.0, -0.1, scale, 0.7],
  ]
}

function sampleKeyframes(table: Keyframes, progress: number) {
  const clamped = Math.min(Math.max(progress, 0), 1)
  let index = 0
  while (index < table.length - 2 && table[index + 1][0] < clamped) index += 1
  const from = table[index]
  const to = table[index + 1]
  const span = to[0] - from[0] || 1
  const local = Math.min(Math.max((clamped - from[0]) / span, 0), 1)
  const eased = local * local * (3 - 2 * local)
  return {
    mix: from[1] + (to[1] - from[1]) * eased,
    x: from[2] + (to[2] - from[2]) * eased,
    y: from[3] + (to[3] - from[3]) * eased,
    scale: from[4] + (to[4] - from[4]) * eased,
    opacity: from[5] + (to[5] - from[5]) * eased,
  }
}

const VERTEX_SHADER = /* glsl */ `
  attribute vec3 aSphere;
  attribute vec3 aScatter;
  attribute vec3 aColor;
  attribute float aRand;
  attribute float aRing;
  uniform float uMix;
  uniform float uTime;
  uniform float uScale;
  uniform vec2 uCenter;
  uniform float uClear;
  uniform vec2 uClearBand;
  varying vec3 vColor;
  varying float vFade;
  varying float vClear;

  /* Rotação de Rodrigues em torno de um eixo unitário qualquer. */
  vec3 rotateAxis(vec3 p, vec3 axis, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
  }

  void main() {
    vColor = aColor;

    /* O corpo gira devagar no Y; cada faixa de anel orbita no plano inclinado
       comum, em velocidade e sentido próprios. É a contra-rotação que dá vida
       ao objeto. */
    const vec3 discAxis = vec3(0.2488, 0.7465, 0.6171);
    float speed = 0.5;
    if (aRing > 0.5 && aRing < 1.5) speed = 1.4;
    else if (aRing > 1.5 && aRing < 2.5) speed = -1.0;
    else if (aRing > 2.5) speed = 1.9;
    float angle = uTime * 0.07 * speed;
    vec3 core = aRing > 0.5
      ? rotateAxis(aSphere, discAxis, angle)
      : rotateAxis(aSphere, vec3(0.0, 1.0, 0.0), angle);

    vec3 scatter = aScatter;
    scatter.x += sin(uTime * 0.28 + aRand * 6.2831) * 0.09;
    scatter.y += cos(uTime * 0.22 + aRand * 9.42) * 0.09;

    vec3 position3 = mix(core, scatter, uMix) * uScale;
    position3.xy += uCenter;

    /* O lado de trás escurece em vez de sumir; os anéis ficam um pouco mais claros. */
    float depth = smoothstep(-1.5, 1.2, core.z);
    float base = aRing > 0.5 ? 0.35 : 0.15;
    vFade = mix(base + (1.0 - base) * depth * depth, 0.85, uMix);

    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position3, 1.0);
    gl_Position = clip;

    /* Clareira: no celular o objeto fica centralizado atrás do texto, e o
       miolo dele cai bem em cima da leitura. Em vez de tapar o objeto com uma
       placa opaca, ele mesmo se apaga onde o texto está e volta ao brilho
       cheio na borda — o anel continua inteiro, só respira no meio. */
    vec2 ndc = clip.xy / max(abs(clip.w), 0.0001);
    float hole = length(vec2(ndc.x / 1.05, (ndc.y - uClearBand.x) / uClearBand.y));
    float dim = mix(0.16, 1.0, smoothstep(0.28, 1.0, hole));
    vClear = mix(1.0, dim, uClear);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vFade;
  varying float vClear;

  void main() {
    gl_FragColor = vec4(vColor, uOpacity * vFade * vClear);
  }
`

/**
 * Monta os triângulos vazados como uma única geometria LineSegments: 3 arestas
 * viram 6 vértices por triângulo, com a posição agrupada e a dispersa gravadas
 * em atributos para o shader interpolar entre as duas.
 */
/**
 * Um plano orbital inclinado comum: três faixas concêntricas com folga entre
 * elas, girando em sentidos opostos.
 */
const RING_NORMAL = new THREE.Vector3(0.25, 0.75, 0.62).normalize()
const RING_BANDS: Array<[number, number]> = [
  [1.04, 1.2],
  [1.3, 1.46],
  [1.56, 1.64],
]

function buildTriangles(count: number, spread: THREE.Vector3, onSphere: boolean) {
  const spherePositions = new Float32Array(count * 6 * 3)
  const scatterPositions = new Float32Array(count * 6 * 3)
  const colors = new Float32Array(count * 6 * 3)
  const randoms = new Float32Array(count * 6)
  const rings = new Float32Array(count * 6)
  const color = new THREE.Color()

  for (let i = 0; i < count; i += 1) {
    /* Estado agrupado: a maior parte num núcleo denso e o resto dividido
       entre os três anéis inclinados. */
    let anchor: THREE.Vector3
    let ring = 0
    if (onSphere) {
      const roll = Math.random()
      if (roll < 0.6) {
        /* Corpo: casca densa na superfície da esfera mais um preenchimento interno. */
        const t = Math.random()
        const inclination = Math.acos(1 - 2 * t)
        const azimuth = Math.random() * Math.PI * 2
        const shell = Math.random() < 0.7 ? 0.6 + Math.random() * 0.06 : 0.62 * Math.sqrt(Math.random())
        anchor = new THREE.Vector3(
          Math.sin(inclination) * Math.cos(azimuth),
          Math.cos(inclination),
          Math.sin(inclination) * Math.sin(azimuth),
        ).multiplyScalar(shell)
      } else {
        ring = 1 + Math.floor(Math.random() * 3)
        const [inner, outer] = RING_BANDS[ring - 1]
        const radius = inner + Math.random() * (outer - inner)
        const tangent = new THREE.Vector3(1, 0, 0)
        tangent.cross(RING_NORMAL).normalize()
        const bitangent = new THREE.Vector3().crossVectors(RING_NORMAL, tangent)
        const theta = Math.random() * Math.PI * 2
        anchor = new THREE.Vector3()
          .addScaledVector(tangent, Math.cos(theta) * radius)
          .addScaledVector(bitangent, Math.sin(theta) * radius)
        /* Ruído vertical mínimo: as faixas precisam ler como um disco plano. */
        anchor.addScaledVector(RING_NORMAL, (Math.random() - 0.5) * 0.035)
      }
    } else {
      anchor = new THREE.Vector3(
        (Math.random() * 2 - 1) * spread.x,
        (Math.random() * 2 - 1) * spread.y,
        (Math.random() * 2 - 1) * spread.z,
      )
    }

    const scatterAnchor = new THREE.Vector3(
      (Math.random() * 2 - 1) * spread.x,
      (Math.random() * 2 - 1) * spread.y,
      (Math.random() * 2 - 1) * spread.z,
    )

    /* Cantos do triângulo num plano aleatório em volta da âncora. Quase todos
       minúsculos, um ou outro maior: grão fino no núcleo, mais grosso nos anéis. */
    const size =
      (onSphere ? (ring > 0 ? 0.008 : 0.005) : 0.012) +
      Math.random() * Math.random() * (onSphere ? (ring > 0 ? 0.03 : 0.02) : 0.055)
    const normal = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
    const tangent = new THREE.Vector3(1, 0, 0)
    if (Math.abs(normal.x) > 0.9) tangent.set(0, 1, 0)
    tangent.cross(normal).normalize()
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent)
    const phase = Math.random() * Math.PI * 2
    const corners: THREE.Vector3[] = []
    for (let k = 0; k < 3; k += 1) {
      const angle = phase + (k / 3) * Math.PI * 2
      corners.push(
        new THREE.Vector3()
          .addScaledVector(tangent, Math.cos(angle) * size)
          .addScaledVector(bitangent, Math.sin(angle) * size),
      )
    }

    pickColor(color, Math.random)
    const random = Math.random()

    /* Arestas: 0-1, 1-2, 2-0. */
    const edgeOrder = [0, 1, 1, 2, 2, 0]
    for (let v = 0; v < 6; v += 1) {
      const corner = corners[edgeOrder[v]]
      const base = (i * 6 + v) * 3
      spherePositions[base] = anchor.x + corner.x
      spherePositions[base + 1] = anchor.y + corner.y
      spherePositions[base + 2] = anchor.z + corner.z
      scatterPositions[base] = scatterAnchor.x + corner.x
      scatterPositions[base + 1] = scatterAnchor.y + corner.y
      scatterPositions[base + 2] = scatterAnchor.z + corner.z
      colors[base] = color.r
      colors[base + 1] = color.g
      colors[base + 2] = color.b
      randoms[i * 6 + v] = random
      rings[i * 6 + v] = ring
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('aSphere', new THREE.BufferAttribute(spherePositions, 3))
  geometry.setAttribute('aScatter', new THREE.BufferAttribute(scatterPositions, 3))
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('aRand', new THREE.BufferAttribute(randoms, 1))
  geometry.setAttribute('aRing', new THREE.BufferAttribute(rings, 1))
  /* LineSegments exige o atributo `position` mesmo com o shader ignorando ele. */
  geometry.setAttribute('position', new THREE.BufferAttribute(spherePositions, 3))
  return geometry
}

function makeMaterial(opacity: number) {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMix: { value: 0 },
      uTime: { value: 0 },
      uScale: { value: 1 },
      uCenter: { value: new THREE.Vector2(0, 0) },
      uClear: { value: 0 },
      uClearBand: { value: new THREE.Vector2(0, 0.5) },
      uOpacity: { value: opacity },
    },
  })
}

export function TriScene() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    /* Mesma cena em todo lugar, dimensionada pelo hardware: celular e máquina
       fraca recebem menos triângulos e menos pixels para preencher. */
    const cores = navigator.hardwareConcurrency ?? 8
    const weakDevice = cores <= 4
    const lightweight = window.innerWidth < 1024

    const renderer = new THREE.WebGLRenderer({
      antialias: !weakDevice,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, weakDevice ? 1 : lightweight ? 1.25 : 1.5),
    )
    renderer.setSize(window.innerWidth, window.innerHeight)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 20)
    camera.position.z = 3.3

    const spread = new THREE.Vector3(2.6, 1.7, 1.2)
    const sphereGeometry = buildTriangles(
      weakDevice ? 3000 : lightweight ? 5200 : 8000,
      spread,
      true,
    )
    const sphereMaterial = makeMaterial(0.95)
    const sphereField = new THREE.LineSegments(sphereGeometry, sphereMaterial)
    scene.add(sphereField)

    /* Camada ambiente, sempre dispersa: os triângulos fracos flutuando em volta. */
    const ambientGeometry = buildTriangles(
      lightweight ? 260 : 600,
      new THREE.Vector3(3.2, 2.1, 1.6),
      false,
    )
    const ambientMaterial = makeMaterial(0.32)
    ambientMaterial.uniforms.uMix.value = 1
    const ambientField = new THREE.LineSegments(ambientGeometry, ambientMaterial)
    scene.add(ambientField)

    /* A altura da página fica em cache: ler scrollHeight dentro do loop força
       um layout a cada frame, que era o que travava o scroll em máquina lenta.
       Só recalcula quando o documento muda de verdade. */
    let maxScroll = 1
    const measureScroll = () => {
      maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
    }
    measureScroll()

    const halfHeight = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z
    let halfWidth = halfHeight * camera.aspect
    let mobileTable = mobileKeyframes(halfWidth, halfHeight, maxScroll)
    let narrow = window.innerWidth < MOBILE_BREAKPOINT
    const applyClear = () => {
      const band = heroCopyBand()
      for (const material of [sphereMaterial, ambientMaterial]) {
        material.uniforms.uClear.value = narrow ? 1 : 0
        material.uniforms.uClearBand.value.set(band[0], band[1])
      }
    }
    const current = { mix: 0.04, x: 0.58, y: 0.02, scale: 1, opacity: 1 }
    const pointer = { x: 0, y: 0 }

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    /* Browser de celular dispara resize quando a barra de URL recolhe no meio
       do scroll; reprojetar nisso faz o planeta pular na tela. Só mudança real
       de largura (girar o aparelho, redimensionar a janela) refaz a projeção. */
    let lastWidth = window.innerWidth
    let lastHeight = window.innerHeight
    const onResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      if (width === lastWidth && Math.abs(height - lastHeight) < 180) return
      lastWidth = width
      lastHeight = height
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      halfWidth = halfHeight * camera.aspect
      mobileTable = mobileKeyframes(halfWidth, halfHeight, maxScroll)
      narrow = width < MOBILE_BREAKPOINT
      applyClear()
      measureScroll()
    }
    window.addEventListener('resize', onResize)

    /* O primeiro frame renderizado levanta a opacidade do container, para o canvas não aparecer de supetão. */
    let revealed = false

    /* A tabela do hero depende da altura do texto e da altura da página, que
       mudam quando as fontes carregam e quando o documento cresce. */
    const remeasure = () => {
      measureScroll()
      mobileTable = mobileKeyframes(halfWidth, halfHeight, maxScroll)
      applyClear()
    }
    const pageObserver = new ResizeObserver(remeasure)
    pageObserver.observe(document.body)
    document.fonts?.ready.then(remeasure)

    applyClear()

    let frame = 0
    let previous = performance.now()

    /* Qualidade adaptativa: mede os primeiros segundos de frames reais e, se a
       máquina não segura a taxa, derruba resolução e camada ambiente uma vez
       só. Seguro barato para notebook velho, que não dá para detectar. */
    let sampled = 0
    let slowFrames = 0
    let downgraded = false
    const considerDowngrade = (delta: number) => {
      if (downgraded || sampled > 150) return
      sampled += 1
      if (delta > 0.028) slowFrames += 1
      if (sampled >= 90 && slowFrames > 30) {
        downgraded = true
        renderer.setPixelRatio(1)
        renderer.setSize(window.innerWidth, window.innerHeight)
        ambientField.visible = false
      }
    }

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const delta = Math.min((now - previous) / 1000, 0.05)
      previous = now
      considerDowngrade(delta)

      const progress = window.scrollY / maxScroll
      /* Abaixo do breakpoint roda a tabela presa ao hero, não a de página inteira. */
      const target = sampleKeyframes(narrow ? mobileTable : KEYFRAMES, progress)

      const damping = reducedMotion ? 1 : 1 - Math.exp(-delta * 4.5)
      current.mix += (target.mix - current.mix) * damping
      current.x += (target.x - current.x) * damping
      current.y += (target.y - current.y) * damping
      current.scale += (target.scale - current.scale) * damping
      current.opacity += (target.opacity - current.opacity) * damping

      const time = reducedMotion ? 0 : now / 1000
      sphereMaterial.uniforms.uTime.value = time
      sphereMaterial.uniforms.uMix.value = current.mix
      sphereMaterial.uniforms.uScale.value = current.scale
      sphereMaterial.uniforms.uOpacity.value = 0.95 * current.opacity
      sphereMaterial.uniforms.uCenter.value.set(
        current.x * halfWidth + pointer.x * 0.05,
        current.y + pointer.y * -0.04,
      )
      ambientMaterial.uniforms.uTime.value = time * 0.6
      ambientMaterial.uniforms.uOpacity.value = narrow ? 0.12 : 0.32

      renderer.render(scene, camera)

      if (!revealed) {
        revealed = true
        mount.style.opacity = '1'
      }
    }
    frame = requestAnimationFrame(tick)

    /* Sem sentido queimar GPU com a aba escondida. */
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame)
      } else {
        previous = performance.now()
        frame = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(frame)
      pageObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
      sphereGeometry.dispose()
      ambientGeometry.dispose()
      sphereMaterial.dispose()
      ambientMaterial.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 opacity-0 transition-opacity duration-700"
    />
  )
}
