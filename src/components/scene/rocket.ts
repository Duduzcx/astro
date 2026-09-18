import * as THREE from 'three'

/**
 * O foguete. Hoje é um modelo real (abaixo); o torneado procedural continua
 * aqui como reserva: um lançador pesado de três núcleos, no estilo dos
 * veículos reutilizáveis de hoje. Núcleo central com interestágio preto, segundo
 * estágio e coifa larga; dois propulsores laterais com cone, presos ao
 * núcleo; pernas de pouso recolhidas ao longo dos três corpos, grid fins
 * no alto, nove motores por núcleo (vinte e sete sinos instanciados),
 * canalizações, fuligem na saia. Tinta branca acetinada com painéis,
 * costuras e uma linha cobalto: é o que lê como lançador real e largo.
 *
 * Cada corpo é um torneado com pontos igualmente espaçados em altura, para
 * a textura correr linear da ponta à saia. Materiais físicos iluminados
 * pelo sol da cena e pelo mapa de ambiente (PMREM), que é o que faz a
 * tinta ter volume.
 *
 * Em cruzeiro voa só o segundo estágio com a coifa (o resto ficou para
 * trás), com um motor grande de vácuo.
 *
 * Modelo real: com ROCKET_MODEL_URL preenchido (um .glb com Draco, decoder
 * em /public/draco/) o torneado nem é construído; o veículo é o modelo,
 * escalado para `height`, com a base em -0,5h e o bico no mesmo lugar do
 * procedural, então chama, brilho, fumaça e rastro não mudam. Em cruzeiro
 * o modelo perde o booster e voa só a nave. Vazio, o torneado de três
 * núcleos volta a valer (é também o caminho de `model: false`).
 *
 * O modelo é o "SpaceX Starship Block 3" de Clarence365 (Sketchfab, CC BY
 * 4.0, https://sketchfab.com/3d-models/spacex-starship-block-3-6f6c6f88a3eb4b4d822fdca66733fbb2),
 * otimizado: logo e número de série removidos, motores decimados (eram
 * metade dos 870k vértices e ocupam 20px na tela), Draco. Crédito no
 * rodapé e no README.
 */
export const ROCKET_MODEL_URL = '/models/starship.glb'

/** Nó do modelo que é o booster (o .glb vem em dois grupos, `ship` e
    `booster`, cada um com as malhas fundidas por material): some em cruzeiro. */
const BOOSTER_NODE = /^booster$/i

/** Uma carga por página: as duas instâncias (lançamento e cruzeiro)
    compartilham geometria; cada uma clona só os materiais que anima. */
let modelPromise: Promise<THREE.Group> | null = null
function loadModel() {
  if (!modelPromise) {
    modelPromise = Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/DRACOLoader.js'),
    ]).then(([{ GLTFLoader }, { DRACOLoader }]) => {
      const draco = new DRACOLoader()
      draco.setDecoderPath('/draco/')
      const loader = new GLTFLoader()
      loader.setDRACOLoader(draco)
      return loader.loadAsync(ROCKET_MODEL_URL).then((gltf) => {
        draco.dispose()
        return gltf.scene
      })
    })
  }
  return modelPromise
}

export type RocketState = {
  visible: boolean
  /** 0 na plataforma, 1 fora da tela. */
  lift: number
  /** 0 a 1, empuxo do motor. */
  thrust: number
  /** Centro em mundo (x) e altura da plataforma (y). */
  x: number
  yPad: number
  /** Quanto o foguete sobe em mundo entre lift 0 e 1. */
  travel: number
  opacity: number
  /** Inclinação do eixo em radianos; positiva tomba o bico para a esquerda. */
  tilt?: number
}

/* Raio de cada núcleo em fração da altura: pouco mais de oito diâmetros. */
const R = 0.058
/* Marcos do núcleo central, em fração da altura (topo = 0.5). */
const INTERSTAGE = [0.18, 0.22] as const
const STAGE2_TOP = 0.36
const FAIRING_TOP = 0.44
const BOOSTER_TOP = 0.3
const BOOSTER_SHOULDER = 0.22
/** Fração da altura total que o segundo estágio com a coifa ocupa. */
export const UPPER_FRACTION = 0.5 - INTERSTAGE[1]

const FLAME_VERTEX = /* glsl */ `
  uniform float uThrust;
  varying vec2 vUv;
  varying float vEdge;
  void main() {
    vUv = uv;
    vec3 p = position;
    /* Cresce para baixo com o empuxo; parado, sobra um bico curto. */
    p.y *= 0.2 + uThrust * 0.8;
    vec3 n = normalize(normalMatrix * normal);
    vEdge = abs(n.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const FLAME_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uThrust;
  uniform float uOpacity;
  uniform vec3 uCore;
  uniform vec3 uMid;
  uniform vec3 uTail;
  varying vec2 vUv;
  varying float vEdge;
  void main() {
    /* uv.y = 1 na base (bocal), 0 na ponta. */
    float along = 1.0 - vUv.y;
    float flicker = 0.5 + 0.5 * sin(along * 26.0 - uTime * 34.0 + sin(vUv.x * 18.85) * 1.8);
    /* Diamantes de choque: pulsos de brilho ao longo do jato. */
    float diamonds = 0.75 + 0.25 * sin(along * 60.0 - uTime * 8.0);
    vec3 color = mix(uCore, uMid, smoothstep(0.0, 0.3, along));
    color = mix(color, uTail, smoothstep(0.3, 0.9, along));
    float alpha = pow(1.0 - along, 1.6) * (0.55 + 0.45 * flicker) * diamonds * pow(vEdge, 0.8);
    gl_FragColor = vec4(color, alpha * uOpacity * (0.3 + 0.7 * uThrust));
  }
`

const GLOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const GLOW_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float alpha = pow(max(0.0, 1.0 - d), 2.2);
    gl_FragColor = vec4(uColor, alpha * uOpacity);
  }
`

const SMOKE_VERTEX = /* glsl */ `
  attribute float aAge;
  attribute float aSize;
  uniform float uPixelRatio;
  varying float vAge;
  void main() {
    vAge = aAge;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = aSize * (0.4 + aAge * 1.6) * uPixelRatio * (3.0 / -view.z);
  }
`

const SMOKE_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying float vAge;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float soft = smoothstep(1.0, 0.2, d);
    vec3 color = mix(vec3(0.95, 0.9, 0.85), vec3(0.45, 0.5, 0.62), vAge);
    float alpha = soft * (1.0 - vAge) * uOpacity * 0.55;
    gl_FragColor = vec4(color, alpha);
  }
`

/** Gerador determinístico: o casco nasce igual em toda carga. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

type HullSpec = {
  size: number
  /** Trecho preto do interestágio, em v (0 na ponta, 1 na saia). */
  interstage?: [number, number]
  /** Onde a fuligem começa, em v. */
  sootFrom: number
  /** Costura da base da coifa, em v. */
  fairingSeam?: number
  /** Marca e bandeira. */
  branding: boolean
  seed: number
}

/**
 * Casco pintado: branco acetinado com painéis, costuras horizontais dos
 * tanques, rebites, uma linha cobalto, fuligem na saia e, no núcleo, o
 * interestágio preto e a marca. Um segundo canvas leva a rugosidade
 * (riscos mais brilhantes, costuras mais foscas).
 */
function hullCanvases(spec: HullSpec) {
  const width = spec.size
  const height = spec.size * 2
  const color = document.createElement('canvas')
  color.width = width
  color.height = height
  const rough = document.createElement('canvas')
  rough.width = width >> 1
  rough.height = height >> 1
  const c = color.getContext('2d')
  const r = rough.getContext('2d')
  if (!c || !r) return null
  const random = rng(spec.seed)
  const Y = (v: number) => v * height
  const RY = (v: number) => v * rough.height

  const base = c.createLinearGradient(0, 0, 0, height)
  base.addColorStop(0, '#eceef2')
  base.addColorStop(0.75, '#e3e6eb')
  base.addColorStop(1, '#d4d8de')
  c.fillStyle = base
  c.fillRect(0, 0, width, height)
  r.fillStyle = 'rgb(140, 140, 140)'
  r.fillRect(0, 0, rough.width, rough.height)

  /* Sujeira fina: riscos verticais fracos, como tinta que voou e poeira. */
  for (let i = 0; i < 320; i += 1) {
    const x = random() * width
    const y = random() * height
    const len = 40 + random() * 500
    c.fillStyle = `rgba(${random() < 0.5 ? '34, 40, 54' : '255, 255, 255'}, ${0.02 + random() * 0.05})`
    c.fillRect(x, y, 2 + random() * 4, len)
    const g = 105 + Math.floor(random() * 70)
    r.fillStyle = `rgba(${g},${g},${g},0.5)`
    r.fillRect(x * 0.5, y * 0.5, 1 + random() * 2, len * 0.5)
  }
  /* Sombreado de cilindro falso, para o corpo ler como volume de longe. */
  const shade = c.createLinearGradient(0, 0, width, 0)
  shade.addColorStop(0, 'rgba(20, 24, 34, 0.14)')
  shade.addColorStop(0.25, 'rgba(20, 24, 34, 0)')
  shade.addColorStop(0.5, 'rgba(20, 24, 34, 0.1)')
  shade.addColorStop(0.75, 'rgba(20, 24, 34, 0)')
  shade.addColorStop(1, 'rgba(20, 24, 34, 0.14)')
  c.fillStyle = shade
  c.fillRect(0, 0, width, height)

  /* Costuras verticais entre painéis e horizontais dos anéis de tanque. */
  c.strokeStyle = 'rgba(40, 48, 66, 0.22)'
  c.lineWidth = 3
  for (let i = 0; i < 10; i += 1) {
    const x = (i / 10) * width
    c.beginPath()
    c.moveTo(x, Y(0.16))
    c.lineTo(x, Y(0.94))
    c.stroke()
  }
  for (const v of [0.24, 0.38, 0.5, 0.62, 0.74, 0.86]) {
    c.beginPath()
    c.moveTo(0, Y(v))
    c.lineTo(width, Y(v))
    c.stroke()
    r.fillStyle = 'rgb(190,190,190)'
    r.fillRect(0, RY(v) - 2, rough.width, 4)
    c.fillStyle = 'rgba(40, 48, 66, 0.25)'
    for (let i = 0; i < 40; i += 1) {
      c.beginPath()
      c.arc((i + 0.5) * (width / 40), Y(v) + 9, 2.4, 0, Math.PI * 2)
      c.fill()
    }
  }
  if (spec.fairingSeam !== undefined) {
    c.strokeStyle = 'rgba(40, 48, 66, 0.45)'
    c.lineWidth = 5
    c.beginPath()
    c.moveTo(0, Y(spec.fairingSeam))
    c.lineTo(width, Y(spec.fairingSeam))
    c.stroke()
    /* A coifa se abre em duas metades: uma costura vertical de cada lado. */
    for (const u of [0.25, 0.75]) {
      c.beginPath()
      c.moveTo(u * width, 0)
      c.lineTo(u * width, Y(spec.fairingSeam))
      c.stroke()
    }
  }

  /* Escotilhas e painéis de acesso. */
  c.fillStyle = 'rgba(30, 36, 50, 0.5)'
  c.strokeStyle = 'rgba(30, 36, 50, 0.7)'
  c.lineWidth = 3
  for (const [u, v, w, hh] of [
    [0.12, 0.42, 0.05, 0.03],
    [0.44, 0.56, 0.04, 0.05],
    [0.7, 0.45, 0.06, 0.025],
    [0.84, 0.7, 0.04, 0.04],
  ]) {
    c.strokeRect(u * width, Y(v), w * width, hh * height)
    c.fillRect(u * width + 6, Y(v) + 6, w * width - 12, hh * height - 12)
  }

  if (spec.interstage) {
    /* Interestágio em carvão fosco. */
    c.fillStyle = '#171a22'
    c.fillRect(0, Y(spec.interstage[0]), width, Y(spec.interstage[1]) - Y(spec.interstage[0]))
    r.fillStyle = 'rgb(215,215,215)'
    r.fillRect(0, RY(spec.interstage[0]), rough.width, RY(spec.interstage[1]) - RY(spec.interstage[0]))
    /* Uma linha cobalto fina logo abaixo: a marca, sem virar brinquedo. */
    c.fillStyle = '#4d84e0'
    c.fillRect(0, Y(spec.interstage[1] + 0.012), width, 8)
  }

  /* Fuligem: escurece da metade de baixo até a saia, mais nas costuras. */
  const soot = c.createLinearGradient(0, Y(spec.sootFrom), 0, Y(1))
  soot.addColorStop(0, 'rgba(24, 24, 30, 0)')
  soot.addColorStop(0.55, 'rgba(24, 24, 30, 0.3)')
  soot.addColorStop(1, 'rgba(18, 18, 22, 0.88)')
  c.fillStyle = soot
  c.fillRect(0, Y(spec.sootFrom), width, Y(1) - Y(spec.sootFrom))
  for (let i = 0; i < 60; i += 1) {
    const x = random() * width
    const y = Y(spec.sootFrom + random() * (1 - spec.sootFrom))
    c.fillStyle = `rgba(20, 20, 24, ${0.06 + random() * 0.12})`
    c.fillRect(x, y, 6 + random() * 40, 80 + random() * 400)
  }
  /* Saia dos motores em preto. */
  c.fillStyle = '#121418'
  c.fillRect(0, Y(0.975), width, Y(1) - Y(0.975))

  if (spec.branding) {
    c.save()
    c.translate(width * 0.27, Y(0.6))
    c.rotate(-Math.PI / 2)
    c.fillStyle = 'rgba(29, 34, 48, 0.85)'
    c.font = `700 ${Math.round(width * 0.08)}px "Arial Black", Impact, sans-serif`
    c.textBaseline = 'middle'
    c.fillText('ASTRO', 0, 0)
    c.restore()
    c.fillStyle = '#4d84e0'
    c.fillRect(width * 0.62, Y(0.47), width * 0.07, Y(0.022))
    c.fillStyle = '#f5f7fb'
    c.fillRect(width * 0.62, Y(0.481), width * 0.07, Y(0.004))
    c.fillStyle = 'rgba(29, 34, 48, 0.75)'
    c.font = `600 ${Math.round(width * 0.022)}px "Courier New", monospace`
    c.fillText('AS-01', width * 0.62, Y(0.515))
    c.fillText('MISSÃO 001', width * 0.62, Y(0.53))
  }

  return { color, rough }
}

/** Ogiva de von Kármán aproximada: t de 0 na ponta a 1 na base. */
const ogive = (t: number) => Math.pow(1 - (1 - t) * (1 - t), 0.6)

/**
 * Perfil de um corpo, do topo à base, com pontos igualmente espaçados em
 * altura (o v da textura corre linear). `radius(y)` dá o raio em cada
 * altura, em fração de h.
 */
function profile(h: number, top: number, bottom: number, radius: (y: number) => number, steps = 160) {
  const points: THREE.Vector2[] = []
  for (let i = 0; i <= steps; i += 1) {
    const y = top - ((top - bottom) * i) / steps
    points.push(new THREE.Vector2(Math.max(radius(y), 0.001) * h, y * h))
  }
  points.push(new THREE.Vector2(R * 0.4 * h, bottom * h))
  points.push(new THREE.Vector2(0.0005 * h, bottom * h))
  return points
}

/** Raio do núcleo central em cada altura: saia, corpo, interestágio, coifa. */
function coreRadius(y: number) {
  if (y > FAIRING_TOP) return 1.38 * R * ogive((0.5 - y) / (0.5 - FAIRING_TOP))
  if (y > STAGE2_TOP + 0.03) return 1.38 * R
  if (y > STAGE2_TOP) return R + 0.38 * R * ((y - STAGE2_TOP) / 0.03)
  if (y < -0.485) return 1.02 * R
  return R
}

/** Raio de um propulsor lateral: cone no topo, corpo, saia. */
function boosterRadius(y: number) {
  if (y > BOOSTER_SHOULDER) return R * ogive((BOOSTER_TOP - y) / (BOOSTER_TOP - BOOSTER_SHOULDER))
  if (y < -0.485) return 1.02 * R
  return R
}

/** Sino de motor: garganta, expansão, boca. Escala em fração da altura. */
function bellProfile(h: number, size: number) {
  return [
    new THREE.Vector2(0.3 * size * h, 0),
    new THREE.Vector2(0.26 * size * h, -0.2 * size * h),
    new THREE.Vector2(0.42 * size * h, -0.7 * size * h),
    new THREE.Vector2(0.64 * size * h, -1.25 * size * h),
    new THREE.Vector2(0.72 * size * h, -1.5 * size * h),
    new THREE.Vector2(0.68 * size * h, -1.55 * size * h),
  ]
}

export function createRocket({
  height,
  lightweight,
  cruise = false,
  model = true,
  warm,
}: {
  height: number
  lightweight: boolean
  /** Em cruzeiro voa só o segundo estágio com a coifa; sem plataforma nem fumaça, e a opacidade vale. */
  cruise?: boolean
  /** `false` força o torneado procedural mesmo com modelo configurado. */
  model?: boolean
  /** Chamado com o modelo pronto, antes de entrar na cena: a cena compila
      os programas e sobe as texturas fora do caminho do scroll. */
  warm?: (object: THREE.Object3D) => Promise<unknown>
}) {
  const object = new THREE.Group()
  const modelMode = Boolean(ROCKET_MODEL_URL) && model
  /* Em cruzeiro a altura pedida é a do segundo estágio; no procedural o
     veículo inteiro é torneado e depois cortado, então é maior. Com o
     modelo, `h` é sempre a altura do que aparece. */
  const h = cruise && !modelMode ? height / UPPER_FRACTION : height
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const textures: THREE.Texture[] = []
  const track = <G extends THREE.BufferGeometry>(g: G) => {
    geometries.push(g)
    return g
  }
  const trackM = <M extends THREE.Material>(m: M) => {
    materials.push(m)
    return m
  }
  /* Base do veículo em fração de h: com o modelo, sempre -0,5 (a nave em
     cruzeiro é reescalada para h inteiro); no procedural o cruzeiro corta
     o torneado no interestágio. */
  const bottom = cruise && !modelMode ? INTERSTAGE[1] : -0.5
  /* Materiais do casco: em cruzeiro a opacidade da cena vale para eles. */
  const hullMaterials: THREE.Material[] = []

  /* O torneado procedural: existe sempre como função, mas só é
     construído quando o modelo não vem. Num aparelho lento ou numa rede
     ruim o .glb pode nunca chegar, e um hero sem foguete é pior do que
     um foguete desenhado à mão. */
  const buildProcedural = () => {
    const size = lightweight ? 1024 : 2048

    const makeHull = (spec: HullSpec) => {
      const canvases = hullCanvases(spec)
      const map = canvases ? new THREE.CanvasTexture(canvases.color) : null
      const roughnessMap = canvases ? new THREE.CanvasTexture(canvases.rough) : null
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace
        map.wrapS = THREE.RepeatWrapping
        map.anisotropy = 8
        textures.push(map)
      }
      if (roughnessMap) {
        roughnessMap.wrapS = THREE.RepeatWrapping
        textures.push(roughnessMap)
      }
      /* Tinta acetinada. Base cinza-clara: sem tone mapping no composer o
         branco iluminado passa de 1,0 e vira neve no bloom. */
      return trackM(
        new THREE.MeshStandardMaterial({
          map,
          roughnessMap,
          color: cruise ? 0xa9b0ba : 0xb9bfc8,
          metalness: 0.18,
          roughness: 0.62,
          envMapIntensity: cruise ? 0.35 : 0.45,
          transparent: cruise,
          toneMapped: false,
        }),
      )
    }
    const dark = trackM(
      new THREE.MeshStandardMaterial({
        color: 0x1c2029,
        metalness: 0.75,
        roughness: 0.42,
        envMapIntensity: 0.7,
        transparent: cruise,
        toneMapped: false,
      }),
    )
    const bell = trackM(
      new THREE.MeshStandardMaterial({
        color: 0x80858d,
        metalness: 1,
        roughness: 0.3,
        envMapIntensity: 0.9,
        side: THREE.DoubleSide,
        transparent: cruise,
        toneMapped: false,
      }),
    )

    const around = lightweight ? 40 : 72
    /* v do interestágio e da coifa no núcleo, medidos do topo. */
    const coreV = (y: number) => (0.5 - y) / (0.5 - bottom)

    const coreHull = makeHull({
      size,
      interstage: cruise ? undefined : [coreV(INTERSTAGE[1]), coreV(INTERSTAGE[0])],
      sootFrom: cruise ? 0.86 : 0.7,
      fairingSeam: coreV(STAGE2_TOP),
      branding: true,
      seed: 1234,
    })
    const core = new THREE.Mesh(track(new THREE.LatheGeometry(profile(h, 0.5, bottom, coreRadius, 200), around)), coreHull)
    object.add(core)

  hullMaterials.push(coreHull, dark, bell)
    const bellSize = cruise ? 0.045 : 0.019
    const bellGeometry = track(new THREE.LatheGeometry(bellProfile(h, bellSize), 20))
    const engineSpots: Array<[number, number]> = []

    if (!cruise) {
      /* Propulsores laterais, encostados no núcleo. */
      const boosterHull = makeHull({ size, sootFrom: 0.72, branding: false, seed: 4321 })
      hullMaterials.push(boosterHull)
      const boosterGeometry = track(
        new THREE.LatheGeometry(profile(h, BOOSTER_TOP, -0.5, boosterRadius, 160), around),
      )
      for (const side of [-1, 1]) {
        const booster = new THREE.Mesh(boosterGeometry, boosterHull)
        booster.position.x = side * 2.04 * R * h
        object.add(booster)
        /* Presilhas entre o propulsor e o núcleo, em cima e embaixo. */
        for (const y of [0.16, -0.38]) {
          const strut = new THREE.Mesh(track(new THREE.BoxGeometry(0.4 * R * h, 0.02 * h, 0.03 * h)), dark)
          strut.position.set(side * 1.02 * R * h, y * h, 0)
          object.add(strut)
        }
      }
      /* Nove motores por núcleo: oito em volta e um no meio. */
      for (const cx of [-2.04 * R, 0, 2.04 * R]) {
        engineSpots.push([cx, 0])
        for (let k = 0; k < 8; k += 1) {
          const a = (k / 8) * Math.PI * 2 + Math.PI / 8
          engineSpots.push([cx + Math.cos(a) * 0.62 * R, Math.sin(a) * 0.62 * R])
        }
      }
      /* Pernas de pouso recolhidas ao longo dos três corpos, e grid fins. */
      const leg = track(new THREE.BoxGeometry(0.016 * h, 0.27 * h, 0.022 * h))
      const frame = track(new THREE.BoxGeometry(0.05 * h, 0.06 * h, 0.006 * h))
      const slatH = track(new THREE.BoxGeometry(0.044 * h, 0.003 * h, 0.009 * h))
      const slatV = track(new THREE.BoxGeometry(0.003 * h, 0.054 * h, 0.009 * h))
      for (const [cx, finY] of [
        [-2.04 * R, BOOSTER_SHOULDER - 0.05],
        [0, INTERSTAGE[0] - 0.04],
        [2.04 * R, BOOSTER_SHOULDER - 0.05],
      ]) {
        for (let k = 0; k < 4; k += 1) {
          const pivot = new THREE.Group()
          pivot.position.x = cx * h
          pivot.rotation.y = (k / 4) * Math.PI * 2 + Math.PI / 4
          const mesh = new THREE.Mesh(leg, dark)
          mesh.position.set(R * 1.06 * h, -0.34 * h, 0)
          mesh.rotation.z = -0.04
          pivot.add(mesh)
          const fin = new THREE.Group()
          fin.position.set(R * h + 0.026 * h, finY * h, 0)
          fin.add(new THREE.Mesh(frame, dark))
          for (let i = -3; i <= 3; i += 1) {
            const a = new THREE.Mesh(slatH, bell)
            a.position.y = i * 0.008 * h
            fin.add(a)
            const b = new THREE.Mesh(slatV, bell)
            b.position.x = i * 0.0065 * h
            fin.add(b)
          }
          pivot.add(fin)
          object.add(pivot)
        }
        /* Canalização ao longo do corpo. */
        const raceway = new THREE.Mesh(track(new THREE.CylinderGeometry(0.006 * h, 0.006 * h, 0.62 * h, 8)), dark)
        raceway.position.set(cx * h + Math.cos(0.7) * R * 1.02 * h, -0.14 * h, Math.sin(0.7) * R * 1.02 * h)
        object.add(raceway)
      }
      /* Anel do interestágio. */
      const ring = new THREE.Mesh(track(new THREE.TorusGeometry(R * 1.03 * h, 0.005 * h, 8, 64)), dark)
      ring.rotation.x = Math.PI / 2
      ring.position.y = INTERSTAGE[0] * h
      object.add(ring)
    } else {
      /* Um motor de vácuo grande no meio. */
      engineSpots.push([0, 0])
    }

    const bells = new THREE.InstancedMesh(bellGeometry, bell, engineSpots.length)
    const matrix = new THREE.Matrix4()
    engineSpots.forEach(([x, z], index) => {
      matrix.makeTranslation(x * h, bottom * h, z * h)
      bells.setMatrixAt(index, matrix)
    })
    bells.instanceMatrix.needsUpdate = true
    object.add(bells)
  }

  if (!modelMode) buildProcedural()

  /* O bocal é um grupo: chamas e brilho penduram nele, e ele gimbala. */
  const nozzle = new THREE.Group()
  nozzle.position.y = (bottom + 0.05) * h
  object.add(nozzle)

  /* Chama em duas camadas por núcleo: laranja por fora, branco-azulado
     por dentro. */
  const flameMaterials: THREE.ShaderMaterial[] = []
  const makeFlame = (x: number, radius: number, length: number, core: string, mid: string, tail: string) => {
    const geometry = track(new THREE.ConeGeometry(radius * h, length * h, 24, 1, true))
    geometry.rotateX(Math.PI)
    geometry.translate(0, -(length / 2) * h, 0)
    const material = trackM(
      new THREE.ShaderMaterial({
        vertexShader: FLAME_VERTEX,
        fragmentShader: FLAME_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uThrust: { value: 0 },
          uOpacity: { value: 1 },
          uCore: { value: new THREE.Color(core) },
          uMid: { value: new THREE.Color(mid) },
          uTail: { value: new THREE.Color(tail) },
        },
      }),
    )
    flameMaterials.push(material)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x * h, -0.06 * h, 0)
    nozzle.add(mesh)
  }
  if (modelMode) {
    /* Um corpo só: um jato largo (trinta e três motores viram uma pluma) e,
       em cruzeiro, o da nave, mais curto: a nave é mais gorda em relação
       à própria altura do que o veículo inteiro. */
    if (cruise) {
      makeFlame(0, 0.075, 0.8, '#fff4dc', '#ffb36a', '#d9481a')
      makeFlame(0, 0.038, 0.55, '#ffffff', '#d6ecff', '#79b4ff')
    } else {
      makeFlame(0, 0.058, 1.35, '#fff4dc', '#ff9a3c', '#d42a0a')
      makeFlame(0, 0.03, 0.9, '#ffffff', '#d6ecff', '#79b4ff')
    }
  } else {
    const plumes = cruise ? [0] : [-2.04 * R, 0, 2.04 * R]
    for (const x of plumes) {
      if (cruise) {
        makeFlame(x, 0.05, 0.6, '#fff4dc', '#ffb36a', '#d9481a')
        makeFlame(x, 0.024, 0.4, '#ffffff', '#d6ecff', '#79b4ff')
      } else {
        makeFlame(x, 0.06, 1.3, '#fff4dc', '#ff9a3c', '#d42a0a')
        makeFlame(x, 0.03, 0.85, '#ffffff', '#d6ecff', '#79b4ff')
      }
    }
  }

  const glowGeometry = track(new THREE.PlaneGeometry(0.6 * h, 0.45 * h))
  const glowMaterial = trackM(
    new THREE.ShaderMaterial({
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#ffd9a0') } },
    }),
  )
  const glow = new THREE.Mesh(glowGeometry, glowMaterial)
  glow.position.y = -0.08 * h
  nozzle.add(glow)

  const padGeometry = track(new THREE.PlaneGeometry(2.4 * h, 0.7 * h))
  const padMaterial = trackM(
    new THREE.ShaderMaterial({
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#ff9e57') } },
    }),
  )
  const pad = new THREE.Mesh(padGeometry, padMaterial)

  /* Fumaça: simulada em mundo, para ficar para trás quando o foguete sobe. */
  const smokeCount = lightweight ? 90 : 360
  const smokePositions = new Float32Array(smokeCount * 3)
  const smokeAges = new Float32Array(smokeCount)
  const smokeSizes = new Float32Array(smokeCount)
  const velocities = new Float32Array(smokeCount * 3)
  const lives = new Float32Array(smokeCount)
  for (let i = 0; i < smokeCount; i += 1) {
    smokeAges[i] = 1
    lives[i] = 1
    smokeSizes[i] = 8 + Math.random() * 16
  }
  const smokeGeometry = new THREE.BufferGeometry()
  const smokePosAttr = new THREE.BufferAttribute(smokePositions, 3)
  const smokeAgeAttr = new THREE.BufferAttribute(smokeAges, 1)
  const smokeSizeAttr = new THREE.BufferAttribute(smokeSizes, 1)
  smokeGeometry.setAttribute('position', smokePosAttr)
  smokeGeometry.setAttribute('aAge', smokeAgeAttr)
  smokeGeometry.setAttribute('aSize', smokeSizeAttr)
  track(smokeGeometry)
  const smokeMaterial = trackM(
    new THREE.ShaderMaterial({
      vertexShader: SMOKE_VERTEX,
      fragmentShader: SMOKE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: { uPixelRatio: { value: 1 }, uOpacity: { value: 1 } },
    }),
  )
  const smoke = new THREE.Points(smokeGeometry, smokeMaterial)
  smoke.frustumCulled = false

  /* A inclinação mora num grupo pai e o giro em torno do eixo no filho:
     no mesmo objeto, a ordem de Euler faz a inclinação girar junto com o
     giro, e o bico passa a apontar para fora do rumo metade do tempo. */
  const lean = new THREE.Group()
  lean.add(object)
  const root = new THREE.Group()
  root.add(lean)
  if (!cruise) root.add(pad, smoke)

  /* O segundo estágio nasce entre o interestágio e a ponta; recentrado, o
     eixo de inclinação passa pelo meio dele. */
  const centerY = cruise && !modelMode ? ((0.5 + bottom) / 2) * h : 0
  object.position.y = -centerY

  let spawnCursor = 0
  let spawnDebt = 0
  let ventDebt = 0
  let ventSide = 0
  let alive = 0

  const spawn = (x: number, y: number) => {
    const i = spawnCursor
    spawnCursor = (spawnCursor + 1) % smokeCount
    smokePositions[i * 3] = x + (Math.random() - 0.5) * 0.3 * h
    smokePositions[i * 3 + 1] = y
    smokePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.1 * h
    velocities[i * 3] = (Math.random() - 0.5) * 0.9 * h
    velocities[i * 3 + 1] = -(1.4 + Math.random() * 1.2) * h
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3 * h
    lives[i] = 0.7 + Math.random() * 0.6
    smokeAges[i] = 0
    smokeSizes[i] = 8 + Math.random() * 16
  }
  /* Respiro: na plataforma o tanque ferve e solta fios de vapor pelo
     casco, brancos, lentos, escorrendo para o lado. */
  const vent = (x: number, y: number) => {
    const i = spawnCursor
    spawnCursor = (spawnCursor + 1) % smokeCount
    smokePositions[i * 3] = x
    smokePositions[i * 3 + 1] = y
    smokePositions[i * 3 + 2] = 0.02 * h
    velocities[i * 3] = (0.06 + Math.random() * 0.08) * h
    velocities[i * 3 + 1] = -(0.03 + Math.random() * 0.05) * h
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.04 * h
    lives[i] = 1.6 + Math.random() * 1.4
    smokeAges[i] = 0
    smokeSizes[i] = 2.5 + Math.random() * 3
  }

  /* O modelo chega depois: some o booster em cruzeiro, os materiais
     entram no regime da cena (sem tone mapping no composer, o aço
     refletindo o ambiente a 1,0 viraria neve no bloom), e o conjunto é
     medido, girado, escalado e assentado com a base em -0,5h e o eixo no
     centro, onde o torneado estaria. Aparece num fade curto. */
  const modelMaterials: THREE.MeshStandardMaterial[] = []
  let appear = modelMode ? 0 : 1
  let disposed = false
  if (modelMode) {
    /* Oito segundos é o limite: acima disso o visitante já rolou a página e
       o hero ficou sem o seu assunto. O torneado entra, e o modelo, se
       chegar depois, não substitui mais nada — dois foguetes seria pior. */
    let gaveUp = false
    const giveUp = window.setTimeout(() => {
      if (disposed || modelMaterials.length) return
      gaveUp = true
      buildProcedural()
      appear = 1
    }, 8000)
    void loadModel()
      .catch(() => null)
      .then((source) => {
      window.clearTimeout(giveUp)
      if (disposed || gaveUp) return
      if (!source) {
        buildProcedural()
        appear = 1
        return
      }
      const model = source.clone(true)
      if (cruise) {
        const gone: THREE.Object3D[] = []
        model.traverse((node) => {
          if (BOOSTER_NODE.test(node.name)) gone.push(node)
        })
        for (const node of gone) node.removeFromParent()
      }
      model.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return
        const original = node.material as THREE.MeshStandardMaterial
        /* Cada instância anima a própria opacidade: clona o material
           (as texturas continuam compartilhadas). */
        const material = original.clone()
        material.toneMapped = false
        /* Filtragem anisotrópica nas texturas do modelo. O foguete é um
           cilindro alto visto quase de perfil: nas laterais a textura chega
           à tela muito comprimida, e com a filtragem padrão isso vira borrão
           na beirada, que é metade da silhueta. Custa amostragem, não
           preenchimento, então não aparece no orçamento de quadro. */
        for (const slot of ['map', 'roughnessMap', 'metalnessMap', 'normalMap', 'aoMap'] as const) {
          const texture = material[slot]
          if (!texture || texture.anisotropy >= 8) continue
          texture.anisotropy = 8
          texture.needsUpdate = true
        }
        /* Mais ambiente que antes: agora ele é um céu com sol e horizonte,
           não uma sala branca, então refletir mais dele desenha o casco em
           vez de lavá-lo. */
        material.envMapIntensity = 0.85
        material.transparent = true
        material.opacity = 0
        material.depthWrite = true
        node.material = material
        modelMaterials.push(material)
        materials.push(material)
      })
      /* As aletas ficam no eixo z do modelo; giradas para x, abrem a
         silhueta para a câmera, que olha ao longo de z. O sinal deixa o
         lado de aço virado para a câmera; o das telhas pretas aparece na
         volta lenta da subida. */
      model.rotation.y = -Math.PI / 2
      model.updateMatrixWorld(true)
      /* A altura vem da caixa de tudo, porque tudo tem que caber. O eixo
         horizontal, não: a caixa do conjunto inclui nós que ficam longe do
         corpo, e centralizar por ela empurrava o veículo para o lado — era
         o desvio de cerca de um quarto da largura da tela que antes se
         contornava deixando rocketX em zero no celular. Aqui o eixo sai da
         malha de maior volume, que é o corpo, então o foguete fica onde a
         cena pede. */
      const box = new THREE.Box3().setFromObject(model)
      const size = new THREE.Vector3()
      box.getSize(size)
      const axis = new THREE.Vector3()
      let biggest = -1
      const meshBox = new THREE.Box3()
      const meshSize = new THREE.Vector3()
      const meshCenter = new THREE.Vector3()
      model.traverse((node) => {
        if (!(node instanceof THREE.Mesh) || !node.geometry) return
        meshBox.setFromObject(node)
        if (meshBox.isEmpty()) return
        meshBox.getSize(meshSize)
        const volume = meshSize.x * meshSize.y * meshSize.z
        if (volume <= biggest) return
        biggest = volume
        meshBox.getCenter(meshCenter)
        axis.copy(meshCenter)
      })
      if (biggest < 0) box.getCenter(axis)
      const scale = h / Math.max(size.y, 0.0001)
      model.scale.setScalar(scale)
      model.position.set(-axis.x * scale, -box.min.y * scale + bottom * h, -axis.z * scale)
      /* O aquecimento (compilar programas e subir geometria) evita um
         tranco quando o foguete entra, mas num aparelho lento ele leva
         mais de dez segundos, e um hero vazio esse tempo todo é pior
         que um tranco. Dois segundos e meio de espera, no máximo. */
      const warmed = warm ? warm(model).catch(() => undefined) : Promise.resolve()
      /* Um segundo de espera pelo aquecimento, não dois e meio. O foguete é
         o assunto do hero: melhor um tranco curto quando ele entra do que
         uma plataforma vazia enquanto o visitante lê o título. */
      /* 350ms de espera pelo aquecimento, não mil. O modelo baixa em menos
         de cem; o que sobrava era espera por compilação, e um tranco curto
         de uma vez é melhor que o hero sem o seu assunto. */
      const late = new Promise<void>((resolve) => window.setTimeout(resolve, 350))
      void Promise.race([warmed, late]).then(() => {
        if (!disposed && !gaveUp && !model.parent) object.add(model)
      })
    })
  }

  return {
    object: root,
    /** Altura do bocal abaixo do centro do objeto, em mundo. */
    nozzleOffset: centerY - (bottom + 0.05) * h,
    update(state: RocketState, time: number, delta: number) {
      root.visible = state.visible || (!cruise && alive > 0)
      if (!root.visible) return
      if (cruise) for (const material of hullMaterials) material.opacity = state.opacity
      if (modelMaterials.length) {
        if (appear < 1) appear = Math.min(1, appear + delta * 4)
        const opacity = appear * (cruise ? state.opacity : 1)
        for (const material of modelMaterials) {
          material.opacity = opacity
          /* Opaco de verdade quando pode: com transparência as peças
             internas do modelo vazam pelo casco. */
          material.transparent = opacity < 0.999
        }
      }

      const y = state.yPad + state.lift * state.travel
      lean.position.set(state.x, y, 0)
      lean.visible = state.visible
      /* O voo, em camadas.
         Um foguete de verdade nunca está parado: na plataforma ele balança
         no vento preso às garras, na subida executa o programa de rolagem
         (gira em torno do próprio eixo enquanto inclina para o rumo),
         sacode na pressão dinâmica máxima e corrige o tempo todo com o
         bocal. Aqui cada uma dessas coisas é um seno; juntas, o movimento
         deixa de ser uma peça rígida deslizando pela tela. */
      const lift = state.lift
      const flying = cruise ? 0.6 : lift
      /* Programa de rolagem: parado na plataforma (só um bamboleio lento
         que mostra os flaps), acelerando conforme sobe. */
      /* Gira mais: parado na plataforma o veículo precisa mostrar que
         está vivo, e na subida o rolamento é o que dá a sensação de voo. */
      /* Giro no próprio eixo. Em cruzeiro ele passa de 0,34 para 0,95 rad/s:
         a 0,34 uma volta completa levava dezoito segundos, mais do que o
         foguete fica em cena entre dois planetas, então o giro existia sem
         ser visto. A velocidade não é constante — uma onda lenta acelera e
         segura a rotação, e é isso que separa um barrel roll de um espeto
         girando em rotisserie. */
      const rollRate = cruise ? 0.95 + Math.sin(time * 0.23) * 0.45 : 0.3 + lift * 0.8
      object.rotation.y =
        Math.sin(time * 0.15) * 0.35 * (1 - flying) + time * rollRate * flying
      /* Max-Q: entre um quinto e a metade da subida o ar ainda é denso e a
         velocidade já é alta. É onde o veículo mais treme. */
      const maxQ = Math.max(0, Math.sin(Math.min(Math.max((lift - 0.12) / 0.45, 0), 1) * Math.PI))
      const buffet = maxQ * 0.012
      const shiver =
        (Math.sin(time * 17.3) * 0.5 + Math.sin(time * 29.7) * 0.3 + Math.sin(time * 41.1) * 0.2) *
        buffet
      /* Na plataforma o vento também mexe com ele, devagar e pouco. */
      const wind = (1 - Math.min(lift * 4, 1)) * (cruise ? 0 : 1)
      const sway = Math.sin(time * 0.7) * 0.03 + Math.sin(time * 1.13) * 0.016
      const tilt = state.tilt ?? 0
      lean.rotation.z = cruise
        ? tilt + Math.sin(time * 1.3) * 0.02 + Math.sin(time * 0.37) * 0.05
        : tilt + Math.sin(time * 1.7) * 0.05 * lift + shiver + sway * wind
      /* Arfagem: em cruzeiro o bico sobe e desce devagar, como quem ajusta
         atitude; na subida é a vibração e um empinar leve no fim. */
      lean.rotation.x = cruise
        ? Math.sin(time * 0.53) * 0.12 + Math.cos(time * 0.91) * 0.06
        : shiver * 0.7 + sway * 0.6 * wind + Math.sin(time * 0.9) * 0.05 * lift
      /* Gimbal: o bocal corrige o rumo o tempo todo, e a chama vai junto.
         Na tremida ele corrige mais, contra o movimento. */
      const gimbal = state.thrust * (cruise ? 0.6 : 1)
      nozzle.rotation.z =
        (Math.sin(time * 2.1) * 0.03 + Math.sin(time * 3.7) * 0.02) * gimbal - shiver * 1.6
      nozzle.rotation.x = Math.cos(time * 2.6) * 0.025 * gimbal - shiver * 0.9

      for (const material of flameMaterials) {
        material.uniforms.uTime.value = time
        material.uniforms.uThrust.value = state.thrust
        material.uniforms.uOpacity.value = state.opacity
      }
      glowMaterial.uniforms.uOpacity.value = state.thrust * state.opacity

      if (cruise) return
      pad.position.set(state.x, state.yPad + (bottom - 0.02) * h, -0.05)
      padMaterial.uniforms.uOpacity.value =
        state.thrust * Math.max(0, 1 - state.lift * 2.5) * state.opacity * 0.7

      const rate = state.thrust * Math.max(0, 1 - state.lift * 1.6) * (lightweight ? 50 : 110)
      spawnDebt += rate * delta
      while (spawnDebt >= 1) {
        spawn(state.x, y + bottom * h)
        spawnDebt -= 1
      }
      const ventRate = state.lift < 0.02 && state.thrust < 0.3 ? 4 : 0
      ventDebt += ventRate * delta
      while (ventDebt >= 1) {
        ventDebt -= 1
        ventSide = 1 - ventSide
        vent(state.x + (modelMode ? 0.04 : R * 3.0) * h, ventSide ? y + 0.1 * h : y - 0.42 * h)
      }
      alive = 0
      const floor = state.yPad + (bottom - 0.02) * h
      for (let i = 0; i < smokeCount; i += 1) {
        if (smokeAges[i] >= 1) continue
        alive += 1
        smokeAges[i] = Math.min(1, smokeAges[i] + delta / lives[i])
        velocities[i * 3 + 1] *= 1 - delta * 1.8
        velocities[i * 3] *= 1 - delta * 0.6
        smokePositions[i * 3] += velocities[i * 3] * delta
        smokePositions[i * 3 + 1] += velocities[i * 3 + 1] * delta
        smokePositions[i * 3 + 2] += velocities[i * 3 + 2] * delta
        if (smokePositions[i * 3 + 1] < floor) {
          smokePositions[i * 3 + 1] = floor
          velocities[i * 3] += Math.sign(velocities[i * 3] || 1) * 6 * h * delta
          velocities[i * 3 + 1] = 0
        }
      }
      smokePosAttr.needsUpdate = true
      smokeAgeAttr.needsUpdate = true
      smokeSizeAttr.needsUpdate = true
      smokeMaterial.uniforms.uOpacity.value = state.opacity
    },
    setPixelRatio(ratio: number) {
      smokeMaterial.uniforms.uPixelRatio.value = ratio
    },
    /** Some a fumaça em máquina que não segura a taxa. */
    lighten() {
      smoke.visible = false
    },
    dispose() {
      disposed = true
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
      for (const t of textures) t.dispose()
    },
  }
}
