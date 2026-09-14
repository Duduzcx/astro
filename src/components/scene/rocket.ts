import * as THREE from 'three'

/**
 * O foguete: um veículo de dois estágios em aço inoxidável escovado, no
 * estilo dos lançadores totalmente reutilizáveis de hoje. Nave em cima
 * (ogiva, flaps dianteiros e traseiros, telhas pretas do escudo térmico
 * num flanco) e propulsor embaixo (grid fins, interestágio ventilado,
 * saia de motores com trinta e três sinos). O casco é um torneado só com
 * a textura correndo linearmente da ponta à saia: soldas de anel a cada
 * 1,8 m de veículo, costuras verticais escalonadas, escovado vertical,
 * marcas de calor azuladas e douradas perto dos motores.
 *
 * Aço em vez de tinta: o que faz aço parecer aço é o reflexo do ambiente
 * ao longo do cilindro, e isso a cena fornece (PMREM). Sem mapa de
 * ambiente, metal é preto.
 *
 * Em cruzeiro só a nave voa (o propulsor ficou para trás), com os seis
 * motores dela.
 *
 * Gancho para modelo real: preencha ROCKET_MODEL_URL com um .glb (Draco em
 * /public/draco/). Carregado, o torneado some. Vazio, nada é baixado.
 */
export const ROCKET_MODEL_URL = ''

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

/* Raio do corpo em fração da altura do veículo inteiro: onze diâmetros. */
const R = 0.046
/* Onde a nave termina e o propulsor começa, em fração da altura (topo = 0.5). */
const SHIP_BASE = 0.08
const NOSE_BASE = 0.32
/** Fração da altura total que a nave sozinha ocupa. */
export const SHIP_FRACTION = 0.5 - SHIP_BASE

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

/**
 * As telhas do escudo térmico cobrem um flanco da nave: metade da volta,
 * com a borda ondulando um pouco. `u` dá a volta, `v` corre da ponta (0)
 * à saia (1) do veículo inteiro.
 */
function inTiles(u: number, v: number) {
  const edge = 0.5 + 0.04 * Math.sin(v * 9.0) + 0.02 * Math.sin(v * 23.0)
  /* Na ponta as telhas fecham a volta inteira. */
  if (v < 0.03) return true
  return u > edge && u < edge + 0.5
}

type Canvases = { color: HTMLCanvasElement; surface: HTMLCanvasElement } | null

/**
 * Casco desenhado: o mapa de cor e, num segundo canvas, rugosidade (verde)
 * e metalicidade (azul) empacotadas no mesmo pixel, que o three lê dos
 * canais certos. `shipOnly` desenha só a nave, esticada no canvas inteiro.
 */
function hullCanvases(size: number, shipOnly: boolean): Canvases {
  const width = size
  const height = size * 2
  const color = document.createElement('canvas')
  color.width = width
  color.height = height
  const surface = document.createElement('canvas')
  surface.width = width >> 1
  surface.height = height >> 1
  const c = color.getContext('2d')
  const s = surface.getContext('2d')
  if (!c || !s) return null
  const random = rng(1234)

  /* Coordenadas do veículo (v de 0 na ponta a 1 na saia do propulsor)
     para o canvas: a nave sozinha ocupa 0 a SHIP_FRACTION. */
  const span = shipOnly ? SHIP_FRACTION : 1
  const Y = (v: number) => (v / span) * height
  const SY = (v: number) => (v / span) * surface.height
  const shipV = SHIP_FRACTION

  /* Aço base: cinza claro e frio. */
  c.fillStyle = '#d3d7dd'
  c.fillRect(0, 0, width, height)
  /* Rugosidade base 0,3 (verde 78), metal quase cheio (azul 205): um
     fio de difuso para o aço não virar breu onde o reflexo é escuro. */
  s.fillStyle = 'rgb(0, 78, 205)'
  s.fillRect(0, 0, surface.width, surface.height)

  /* Escovado vertical: milhares de riscos finos, claros e escuros. */
  for (let i = 0; i < 2600; i += 1) {
    const x = random() * width
    const y = random() * height
    const len = 60 + random() * 900
    const light = random() < 0.5
    c.fillStyle = light ? `rgba(255,255,255,${0.04 + random() * 0.08})` : `rgba(40,46,58,${0.03 + random() * 0.07})`
    c.fillRect(x, y, 1 + random() * 2, len)
  }
  for (let i = 0; i < 900; i += 1) {
    const g = 55 + Math.floor(random() * 60)
    s.fillStyle = `rgba(0,${g},205,0.5)`
    s.fillRect(random() * surface.width, random() * surface.height, 1 + random() * 2, 40 + random() * 500)
  }

  /* Manchas largas de reflexo desigual: aço laminado nunca é uniforme. */
  for (let i = 0; i < 40; i += 1) {
    const x = random() * width
    const y = random() * height
    const rw = 80 + random() * 300
    const rh = 200 + random() * 900
    const grad = c.createRadialGradient(x, y, 0, x, y, Math.max(rw, rh))
    const dark = random() < 0.5
    grad.addColorStop(0, dark ? 'rgba(60,66,80,0.16)' : 'rgba(255,255,255,0.12)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    c.fillStyle = grad
    c.fillRect(x - rw, y - rh, rw * 2, rh * 2)
  }

  /* Marcas de calor: azul-violeta e dourado, na base da nave e na saia do
     propulsor, onde o metal esquentou na reentrada e no voo. */
  const heat = (v0: number, v1: number, strength: number) => {
    const g = c.createLinearGradient(0, Y(v0), 0, Y(v1))
    g.addColorStop(0, 'rgba(120,110,190,0)')
    g.addColorStop(0.35, `rgba(110,100,190,${0.28 * strength})`)
    g.addColorStop(0.6, `rgba(190,150,90,${0.22 * strength})`)
    g.addColorStop(0.85, `rgba(90,70,60,${0.3 * strength})`)
    g.addColorStop(1, 'rgba(40,30,30,0)')
    c.fillStyle = g
    c.fillRect(0, Y(v0), width, Y(v1) - Y(v0))
  }
  heat(shipV - 0.09, shipV, 1)
  if (!shipOnly) heat(0.86, 0.95, 1.2)

  /* Soldas de anel: um anel a cada 1,8 m de um veículo de 120 m. Linha
     escura fina com um fio claro embaixo, como solda polida. */
  const ringStep = 0.015
  c.lineWidth = 2
  for (let v = ringStep; v < span; v += ringStep) {
    const y = Y(v)
    c.strokeStyle = 'rgba(50,56,68,0.55)'
    c.beginPath()
    c.moveTo(0, y)
    c.lineTo(width, y)
    c.stroke()
    c.strokeStyle = 'rgba(255,255,255,0.35)'
    c.beginPath()
    c.moveTo(0, y + 3)
    c.lineTo(width, y + 3)
    c.stroke()
    /* Solda é mais fosca. */
    s.fillStyle = 'rgb(0,160,240)'
    s.fillRect(0, SY(v) - 1, surface.width, 3)
    /* Costuras verticais escalonadas dentro de cada anel. */
    const seams = 3 + Math.floor(random() * 2)
    const offset = random()
    for (let k = 0; k < seams; k += 1) {
      const x = ((offset + k / seams) % 1) * width
      c.strokeStyle = 'rgba(50,56,68,0.35)'
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(x, Y(v + ringStep))
      c.stroke()
    }
  }

  /* Telhas pretas do escudo térmico num flanco da nave: hexágonos
     escuros com variação, separados por frestas mais claras. */
  const hexR = width / 96
  const hexH = hexR * Math.sqrt(3)
  const tilesEnd = Y(shipV)
  for (let row = 0; row * hexH * 0.5 < tilesEnd + hexH; row += 1) {
    const y = row * hexH * 0.5
    const shift = row % 2 ? hexR * 1.5 : 0
    for (let col = -1; col * hexR * 3 < width + hexR * 3; col += 1) {
      const x = col * hexR * 3 + shift
      const u = (x / width + 1) % 1
      const v = (y / height) * span
      if (v > shipV || !inTiles(u, v)) continue
      const shade = 16 + Math.floor(random() * 14)
      c.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`
      c.beginPath()
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2
        const px = x + Math.cos(a) * hexR * 0.93
        const py = y + Math.sin(a) * hexR * 0.93
        if (k === 0) c.moveTo(px, py)
        else c.lineTo(px, py)
      }
      c.closePath()
      c.fill()
      /* A telha é fosca e não é metal. */
      s.fillStyle = 'rgb(0,225,25)'
      s.beginPath()
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2
        const px = (x + Math.cos(a) * hexR) * 0.5
        const py = (y + Math.sin(a) * hexR) * 0.5
        if (k === 0) s.moveTo(px, py)
        else s.lineTo(px, py)
      }
      s.closePath()
      s.fill()
    }
  }

  if (!shipOnly) {
    /* Interestágio ventilado: faixa escura com ranhuras. */
    const y0 = Y(shipV)
    const y1 = Y(shipV + 0.02)
    c.fillStyle = '#1b1e25'
    c.fillRect(0, y0, width, y1 - y0)
    c.fillStyle = '#3a3f4a'
    for (let k = 0; k < 64; k += 1) {
      c.fillRect((k / 64) * width + 4, y0 + (y1 - y0) * 0.3, width / 64 - 10, (y1 - y0) * 0.4)
    }
    s.fillStyle = 'rgb(0,150,200)'
    s.fillRect(0, SY(shipV), surface.width, SY(shipV + 0.02) - SY(shipV))
    /* Saia dos motores: aço escurecido pela fuligem. */
    const soot = c.createLinearGradient(0, Y(0.9), 0, Y(1))
    soot.addColorStop(0, 'rgba(20,20,24,0)')
    soot.addColorStop(1, 'rgba(20,20,24,0.85)')
    c.fillStyle = soot
    c.fillRect(0, Y(0.9), width, Y(1) - Y(0.9))
    c.fillStyle = '#15171c'
    c.fillRect(0, Y(0.965), width, Y(1) - Y(0.965))
  }

  /* Marca discreta no flanco de aço, de pé, e a bandeira da missão. */
  c.save()
  c.translate(width * 0.2, Y(shipV * 0.62))
  c.rotate(-Math.PI / 2)
  c.fillStyle = 'rgba(22,26,36,0.8)'
  c.font = `700 ${Math.round(width * 0.055)}px "Arial Black", Impact, sans-serif`
  c.textBaseline = 'middle'
  c.fillText('ASTRO', 0, 0)
  c.restore()
  c.fillStyle = '#3f74d6'
  c.fillRect(width * 0.17, Y(shipV * 0.36), width * 0.035, Y(shipV * 0.36 + 0.012) - Y(shipV * 0.36))
  c.fillStyle = 'rgba(22,26,36,0.7)'
  c.font = `600 ${Math.round(width * 0.016)}px "Courier New", monospace`
  c.fillText('AS-01', width * 0.17, Y(shipV * 0.36 + 0.02))

  return { color, surface }
}

/**
 * Perfil do veículo, da ponta à saia, com pontos igualmente espaçados em
 * altura: assim o v da textura corre linear ao longo do corpo.
 */
function vehicleProfile(h: number, shipOnly: boolean) {
  const points: THREE.Vector2[] = []
  const top = 0.5
  const bottom = shipOnly ? SHIP_BASE : -0.5
  const steps = shipOnly ? 96 : 200
  for (let i = 0; i <= steps; i += 1) {
    const y = top - ((top - bottom) * i) / steps
    let r: number
    if (y > NOSE_BASE) {
      const t = (top - y) / (top - NOSE_BASE)
      r = R * Math.pow(1 - (1 - t) * (1 - t), 0.6)
    } else if (!shipOnly && y < SHIP_BASE && y > SHIP_BASE - 0.02) {
      r = R * 1.035
    } else if (!shipOnly && y < -0.465) {
      r = R * 1.01
    } else {
      r = R
    }
    points.push(new THREE.Vector2(Math.max(r, 0.002) * h, y * h))
  }
  /* Fecha o fundo. */
  points.push(new THREE.Vector2(R * 0.35 * h, bottom * h))
  points.push(new THREE.Vector2(0.0005 * h, bottom * h))
  return points
}

/** Sino de motor: garganta, expansão, boca. Escala em fração da altura. */
function bellProfile(h: number, size: number) {
  return [
    new THREE.Vector2(0.28 * size * h, 0),
    new THREE.Vector2(0.24 * size * h, -0.2 * size * h),
    new THREE.Vector2(0.4 * size * h, -0.7 * size * h),
    new THREE.Vector2(0.62 * size * h, -1.25 * size * h),
    new THREE.Vector2(0.7 * size * h, -1.5 * size * h),
    new THREE.Vector2(0.66 * size * h, -1.55 * size * h),
  ]
}

/** Flap: uma placa achatada com borda chanfrada, presa ao casco por uma dobradiça. */
function flapGeometry(h: number, length: number, widthFrac: number) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(widthFrac * h, -length * 0.25 * h)
  shape.lineTo(widthFrac * h, -length * 0.85 * h)
  shape.lineTo(widthFrac * 0.4 * h, -length * h)
  shape.lineTo(0, -length * h)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.008 * h,
    bevelEnabled: true,
    bevelThickness: 0.002 * h,
    bevelSize: 0.002 * h,
    bevelSegments: 2,
  })
  geometry.translate(0, 0, -0.004 * h)
  return geometry
}

export function createRocket({
  height,
  lightweight,
  cruise = false,
}: {
  height: number
  lightweight: boolean
  /** Em cruzeiro voa só a nave, sem plataforma nem fumaça, e a opacidade vale. */
  cruise?: boolean
}) {
  const object = new THREE.Group()
  /* Em cruzeiro a altura pedida é a da nave; o veículo inteiro seria maior. */
  const h = cruise ? height / SHIP_FRACTION : height
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const track = <G extends THREE.BufferGeometry>(g: G) => {
    geometries.push(g)
    return g
  }
  const trackM = <M extends THREE.Material>(m: M) => {
    materials.push(m)
    return m
  }

  const canvases = hullCanvases(lightweight ? 1024 : 2048, cruise)
  const colorMap = canvases ? new THREE.CanvasTexture(canvases.color) : null
  const surfaceMap = canvases ? new THREE.CanvasTexture(canvases.surface) : null
  if (colorMap) {
    colorMap.colorSpace = THREE.SRGBColorSpace
    colorMap.wrapS = THREE.RepeatWrapping
    colorMap.anisotropy = 8
  }
  if (surfaceMap) {
    surfaceMap.wrapS = THREE.RepeatWrapping
    surfaceMap.anisotropy = 4
  }

  /* Aço: quase todo metal, rugosidade média, e o reflexo do ambiente é
     quem desenha o cilindro. Base um pouco abaixo do branco: sem tone
     mapping no composer, reflexo cheio passa de 1,0 e vira neve no bloom. */
  const hull = trackM(
    new THREE.MeshStandardMaterial({
      map: colorMap,
      roughnessMap: surfaceMap,
      metalnessMap: surfaceMap,
      color: 0xd6dae0,
      metalness: 1,
      roughness: 1,
      envMapIntensity: 1.5,
      transparent: cruise,
      toneMapped: false,
    }),
  )
  const dark = trackM(
    new THREE.MeshStandardMaterial({
      color: 0x22262e,
      metalness: 0.85,
      roughness: 0.48,
      envMapIntensity: 0.7,
      transparent: cruise,
      toneMapped: false,
    }),
  )
  const bell = trackM(
    new THREE.MeshStandardMaterial({
      color: 0x7c8189,
      metalness: 1,
      roughness: 0.32,
      envMapIntensity: 0.8,
      side: THREE.DoubleSide,
      transparent: cruise,
      toneMapped: false,
    }),
  )
  const hullMaterials = [hull, dark, bell]

  const around = lightweight ? 48 : 96
  const body = new THREE.Mesh(track(new THREE.LatheGeometry(vehicleProfile(h, cruise), around)), hull)
  object.add(body)

  const shipBaseY = SHIP_BASE * h
  const bottomY = (cruise ? SHIP_BASE : -0.5) * h

  /* Flaps: dois dianteiros pequenos perto da ponta, dois traseiros grandes
     na base da nave, em lados opostos. */
  const forwardFlap = track(flapGeometry(h, 0.075, 0.032))
  const aftFlap = track(flapGeometry(h, 0.11, 0.05))
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.rotation.y = side > 0 ? 0 : Math.PI
    const fwd = new THREE.Mesh(forwardFlap, dark)
    fwd.position.set(R * 0.72 * h, 0.44 * h, 0)
    fwd.rotation.z = -0.35
    pivot.add(fwd)
    const aft = new THREE.Mesh(aftFlap, dark)
    aft.position.set(R * 0.98 * h, shipBaseY + 0.11 * h, 0)
    pivot.add(aft)
    object.add(pivot)
  }

  /* Motores em sino, instanciados: o propulsor tem trinta e três, a nave
     seis (três maiores, de vácuo). */
  const bellSize = cruise ? 0.026 : 0.0115
  const bellGeometry = track(new THREE.LatheGeometry(bellProfile(h, bellSize), 20))
  const bellCount = cruise ? 6 : 33
  const bells = new THREE.InstancedMesh(bellGeometry, bell, bellCount)
  const matrix = new THREE.Matrix4()
  const place = (index: number, x: number, z: number, y: number, scale: number) => {
    matrix.makeScale(scale, scale, scale)
    matrix.setPosition(x, y, z)
    bells.setMatrixAt(index, matrix)
  }
  if (cruise) {
    for (let k = 0; k < 3; k += 1) {
      const a = (k / 3) * Math.PI * 2
      place(k, Math.cos(a) * R * 0.28 * h, Math.sin(a) * R * 0.28 * h, bottomY + 0.002 * h, 0.7)
    }
    for (let k = 0; k < 3; k += 1) {
      const a = (k / 3) * Math.PI * 2 + Math.PI / 3
      place(3 + k, Math.cos(a) * R * 0.66 * h, Math.sin(a) * R * 0.66 * h, bottomY + 0.002 * h, 1)
    }
  } else {
    let index = 0
    for (let k = 0; k < 20; k += 1) {
      const a = (k / 20) * Math.PI * 2
      place(index++, Math.cos(a) * R * 0.86 * h, Math.sin(a) * R * 0.86 * h, bottomY, 1)
    }
    for (let k = 0; k < 10; k += 1) {
      const a = (k / 10) * Math.PI * 2 + Math.PI / 10
      place(index++, Math.cos(a) * R * 0.52 * h, Math.sin(a) * R * 0.52 * h, bottomY, 1)
    }
    for (let k = 0; k < 3; k += 1) {
      const a = (k / 3) * Math.PI * 2
      place(index++, Math.cos(a) * R * 0.17 * h, Math.sin(a) * R * 0.17 * h, bottomY, 1)
    }
  }
  bells.instanceMatrix.needsUpdate = true
  object.add(bells)

  if (!cruise) {
    /* Grid fins no topo do propulsor: moldura com lâminas cruzadas. */
    const frame = track(new THREE.BoxGeometry(0.058 * h, 0.072 * h, 0.006 * h))
    const slatH = track(new THREE.BoxGeometry(0.052 * h, 0.003 * h, 0.009 * h))
    const slatV = track(new THREE.BoxGeometry(0.003 * h, 0.066 * h, 0.009 * h))
    for (let k = 0; k < 4; k += 1) {
      const pivot = new THREE.Group()
      pivot.rotation.y = (k / 4) * Math.PI * 2 + Math.PI / 4
      const fin = new THREE.Group()
      fin.position.set(R * h + 0.03 * h, shipBaseY - 0.06 * h, 0)
      fin.add(new THREE.Mesh(frame, dark))
      for (let i = -3; i <= 3; i += 1) {
        const a = new THREE.Mesh(slatH, bell)
        a.position.y = i * 0.0095 * h
        fin.add(a)
      }
      for (let i = -3; i <= 3; i += 1) {
        const b = new THREE.Mesh(slatV, bell)
        b.position.x = i * 0.0075 * h
        fin.add(b)
      }
      pivot.add(fin)
      object.add(pivot)
    }
    /* Anel do interestágio e conduítes ao longo do propulsor. */
    const ring = new THREE.Mesh(track(new THREE.TorusGeometry(R * 1.04 * h, 0.004 * h, 8, 64)), dark)
    ring.rotation.x = Math.PI / 2
    ring.position.y = shipBaseY - 0.02 * h
    object.add(ring)
    const conduit = track(new THREE.CylinderGeometry(0.005 * h, 0.005 * h, 0.5 * h, 8))
    for (const a of [0.9, 2.6]) {
      const mesh = new THREE.Mesh(conduit, dark)
      mesh.position.set(Math.cos(a) * R * 1.02 * h, -0.2 * h, Math.sin(a) * R * 1.02 * h)
      object.add(mesh)
    }
  } else {
    /* Um conduíte curto na nave. */
    const conduit = new THREE.Mesh(track(new THREE.CylinderGeometry(0.005 * h, 0.005 * h, 0.2 * h, 8)), dark)
    conduit.position.set(Math.cos(2.4) * R * 1.02 * h, 0.2 * h, Math.sin(2.4) * R * 1.02 * h)
    object.add(conduit)
  }

  /* O bocal é um grupo: chama e brilho penduram nele, e ele gimbala. */
  const nozzle = new THREE.Group()
  nozzle.position.y = bottomY + 0.05 * h
  object.add(nozzle)

  /* Chama em duas camadas: laranja por fora, branco-azulado por dentro.
     O propulsor faz uma pluma larga; a nave, um jato mais estreito. */
  const flameMaterials: THREE.ShaderMaterial[] = []
  const makeFlame = (radius: number, length: number, core: string, mid: string, tail: string) => {
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
    mesh.position.y = -0.06 * h
    nozzle.add(mesh)
  }
  if (cruise) {
    makeFlame(0.03, 0.55, '#fff4dc', '#ffb36a', '#d9481a')
    makeFlame(0.014, 0.36, '#ffffff', '#d6ecff', '#79b4ff')
  } else {
    makeFlame(0.052, 1.3, '#fff4dc', '#ff9a3c', '#d42a0a')
    makeFlame(0.026, 0.85, '#ffffff', '#d6ecff', '#79b4ff')
  }

  const glowGeometry = track(new THREE.PlaneGeometry(0.45 * h, 0.45 * h))
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

  const padGeometry = track(new THREE.PlaneGeometry(2.2 * h, 0.7 * h))
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
  const smokeCount = lightweight ? 120 : 360
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

  let spawnCursor = 0
  let spawnDebt = 0
  let ventDebt = 0
  let ventSide = 0
  let alive = 0

  const spawn = (x: number, y: number) => {
    const i = spawnCursor
    spawnCursor = (spawnCursor + 1) % smokeCount
    smokePositions[i * 3] = x + (Math.random() - 0.5) * 0.06 * h
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

  let modelLoaded = false
  if (ROCKET_MODEL_URL) {
    Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/DRACOLoader.js'),
    ]).then(([{ GLTFLoader }, { DRACOLoader }]) => {
      const draco = new DRACOLoader()
      draco.setDecoderPath('/draco/')
      const loader = new GLTFLoader()
      loader.setDRACOLoader(draco)
      loader.load(ROCKET_MODEL_URL, (gltf) => {
        const model = gltf.scene
        const box = new THREE.Box3().setFromObject(model)
        const size = new THREE.Vector3()
        box.getSize(size)
        model.scale.setScalar(height / Math.max(size.y, 0.0001))
        box.setFromObject(model)
        const center = new THREE.Vector3()
        box.getCenter(center)
        model.position.sub(center)
        for (const child of [...object.children]) {
          if (child !== nozzle) child.visible = false
        }
        object.add(model)
        modelLoaded = true
      })
    })
  }

  /* A nave sozinha nasce entre 0.08h e 0.5h; recentrada, o eixo de
     inclinação passa pelo meio dela, não por um ponto abaixo. */
  const centerY = cruise ? ((0.5 + SHIP_BASE) / 2) * h : 0
  object.position.y = -centerY

  return {
    object: root,
    /** Altura do bocal abaixo do centro do objeto, em mundo. */
    nozzleOffset: centerY - (bottomY + 0.05 * h),
    update(state: RocketState, time: number, delta: number) {
      root.visible = state.visible || (!cruise && alive > 0)
      if (!root.visible) return
      if (cruise) for (const material of hullMaterials) material.opacity = state.opacity

      const y = state.yPad + state.lift * state.travel
      lean.position.set(state.x, y, 0)
      lean.visible = state.visible
      /* O flanco de aço fica para a câmera (as telhas ficam do lado de
         lá): na plataforma e em cruzeiro o veículo só balança em torno
         disso, mostrando as telhas nas pontas do balanço; na subida gira
         inteiro para mostrar o volume. O eixo segue a inclinação que a
         cena manda (o rumo) mais um balanço leve no tempo. */
      const flying = cruise ? 0 : state.lift
      object.rotation.y = cruise
        ? Math.sin(time * 0.35) * 0.8
        : Math.sin(time * 0.15) * 0.45 * (1 - flying) + time * 0.3 * flying
      const tilt = state.tilt ?? 0
      lean.rotation.z = cruise
        ? tilt + Math.sin(time * 1.3) * 0.02
        : tilt + Math.sin(time * 1.7) * 0.02 * state.lift
      /* Gimbal: o bocal corrige o rumo o tempo todo, e a chama vai junto. */
      const gimbal = state.thrust * (cruise ? 0.6 : 1)
      nozzle.rotation.z = (Math.sin(time * 2.1) * 0.03 + Math.sin(time * 3.7) * 0.02) * gimbal
      nozzle.rotation.x = Math.cos(time * 2.6) * 0.025 * gimbal

      for (const material of flameMaterials) {
        material.uniforms.uTime.value = time
        material.uniforms.uThrust.value = state.thrust
        material.uniforms.uOpacity.value = state.opacity
      }
      glowMaterial.uniforms.uOpacity.value = state.thrust * state.opacity

      if (cruise) return
      pad.position.set(state.x, state.yPad + bottomY - 0.02 * h, -0.05)
      padMaterial.uniforms.uOpacity.value =
        state.thrust * Math.max(0, 1 - state.lift * 2.5) * state.opacity * 0.7

      const rate = state.thrust * Math.max(0, 1 - state.lift * 1.6) * (lightweight ? 70 : 110)
      spawnDebt += rate * delta
      while (spawnDebt >= 1) {
        spawn(state.x, y + bottomY)
        spawnDebt -= 1
      }
      const ventRate = state.lift < 0.02 && state.thrust < 0.3 ? 4 : 0
      ventDebt += ventRate * delta
      while (ventDebt >= 1) {
        ventDebt -= 1
        ventSide = 1 - ventSide
        vent(state.x + R * h * 0.96, ventSide ? y + 0.1 * h : y - 0.42 * h)
      }
      alive = 0
      const floor = state.yPad + bottomY - 0.02 * h
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

      if (modelLoaded) object.rotation.y = time * 0.15
    },
    setPixelRatio(ratio: number) {
      smokeMaterial.uniforms.uPixelRatio.value = ratio
    },
    /** Some a fumaça em máquina que não segura a taxa. */
    lighten() {
      smoke.visible = false
    },
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
      colorMap?.dispose()
      surfaceMap?.dispose()
    },
  }
}
