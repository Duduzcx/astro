import * as THREE from 'three'

/**
 * O foguete. Proporção de lançador de verdade (nove diâmetros de altura),
 * corpo torneado num perfil só (ogiva, corpo, cintura, saia), casco com
 * textura desenhada em canvas: painéis, costuras, faixa de interestágio em
 * carvão, escotilhas, uma linha cobalto fina e a marca. Materiais metálicos
 * que só ficam bonitos com o mapa de ambiente que a cena gera (sem ele,
 * metal é preto). Três motores em sino, quatro aletas curtas e escuras.
 *
 * Chama em duas camadas (laranja por fora, branco-azulado por dentro), brilho
 * no bocal, brilho na plataforma e fumaça simulada na CPU que fica para
 * trás no chão quando o foguete sobe.
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
}

/* Raio do corpo em fração da altura: nove diâmetros de altura. */
const R = 0.055

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

/**
 * O casco desenhado: a textura dá volta no corpo (u) e corre da ponta à
 * saia (v). Branco fosco com costuras, faixas escuras de interestágio, uma
 * linha cobalto, escotilhas e a marca. É o que tira o ar de brinquedo.
 */
function hullTexture() {
  const width = 1024
  const height = 2048
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  /* Base: branco levemente frio, com um gradiente sutil de sujeira. */
  const base = ctx.createLinearGradient(0, 0, 0, height)
  base.addColorStop(0, '#eef0f3')
  base.addColorStop(0.7, '#e4e7ec')
  base.addColorStop(1, '#cfd3da')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, width, height)

  /* Costuras verticais entre painéis. */
  ctx.strokeStyle = 'rgba(40, 48, 66, 0.16)'
  ctx.lineWidth = 2
  for (let i = 0; i < 12; i += 1) {
    const x = (i / 12) * width
    ctx.beginPath()
    ctx.moveTo(x, height * 0.12)
    ctx.lineTo(x, height * 0.9)
    ctx.stroke()
  }
  /* Costuras horizontais dos anéis de tanque. */
  for (const v of [0.22, 0.34, 0.5, 0.62, 0.74, 0.86]) {
    ctx.beginPath()
    ctx.moveTo(0, v * height)
    ctx.lineTo(width, v * height)
    ctx.stroke()
  }
  /* Rebites discretos ao longo das costuras horizontais. */
  ctx.fillStyle = 'rgba(40, 48, 66, 0.22)'
  for (const v of [0.34, 0.62, 0.86]) {
    for (let i = 0; i < 48; i += 1) {
      ctx.beginPath()
      ctx.arc((i + 0.5) * (width / 48), v * height + 8, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /* Interestágio em carvão fosco e a faixa térmica na saia. */
  ctx.fillStyle = '#1d2230'
  ctx.fillRect(0, height * 0.29, width, height * 0.05)
  ctx.fillRect(0, height * 0.9, width, height * 0.1)
  /* Escurecimento por fuligem acima da saia. */
  const soot = ctx.createLinearGradient(0, height * 0.8, 0, height * 0.9)
  soot.addColorStop(0, 'rgba(20, 22, 30, 0)')
  soot.addColorStop(1, 'rgba(20, 22, 30, 0.45)')
  ctx.fillStyle = soot
  ctx.fillRect(0, height * 0.8, width, height * 0.1)

  /* Uma linha cobalto fina: a marca, sem virar brinquedo. */
  ctx.fillStyle = '#4d84e0'
  ctx.fillRect(0, height * 0.355, width, 10)

  /* Escotilhas e painéis de acesso. */
  ctx.fillStyle = 'rgba(30, 36, 50, 0.55)'
  ctx.strokeStyle = 'rgba(30, 36, 50, 0.7)'
  for (const [u, v, w, h] of [
    [0.1, 0.4, 0.05, 0.03],
    [0.42, 0.55, 0.04, 0.05],
    [0.7, 0.44, 0.06, 0.025],
    [0.83, 0.68, 0.04, 0.04],
  ]) {
    ctx.strokeRect(u * width, v * height, w * width, h * height)
    ctx.fillRect(u * width + 6, v * height + 6, w * width - 12, h * height - 12)
  }
  /* Marca ao longo do corpo, de pé, discreta. */
  ctx.save()
  ctx.translate(width * 0.27, height * 0.585)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = 'rgba(29, 34, 48, 0.85)'
  ctx.font = '700 84px "Arial Black", Impact, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('ASTRO', 0, 0)
  ctx.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.anisotropy = 4
  return texture
}

/** Perfil do casco, da ponta à saia, em frações da altura. */
function hullProfile(h: number) {
  const points: THREE.Vector2[] = []
  const steps = 16
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    /* Ogiva de von Kármán aproximada: mais cheia que um cone, ponta fina. */
    const r = R * Math.pow(1 - (1 - t) * (1 - t), 0.62)
    points.push(new THREE.Vector2(r * h, (0.5 - 0.22 * t) * h))
  }
  points.push(new THREE.Vector2(R * h, -0.4 * h))
  points.push(new THREE.Vector2(R * 1.06 * h, -0.44 * h))
  points.push(new THREE.Vector2(R * 1.06 * h, -0.5 * h))
  points.push(new THREE.Vector2(R * 0.6 * h, -0.5 * h))
  return points
}

/** Motor em sino: garganta, expansão, boca. */
function bellProfile(h: number, scale: number) {
  return [
    new THREE.Vector2(0.012 * h * scale, -0.5 * h),
    new THREE.Vector2(0.01 * h * scale, -0.52 * h),
    new THREE.Vector2(0.018 * h * scale, -0.56 * h),
    new THREE.Vector2(0.03 * h * scale, -0.6 * h),
    new THREE.Vector2(0.036 * h * scale, -0.625 * h),
    new THREE.Vector2(0.034 * h * scale, -0.63 * h),
  ]
}

/** Aleta curta e varrida, escura, na base. */
function finGeometry(h: number) {
  const shape = new THREE.Shape()
  shape.moveTo(0, -0.3 * h)
  shape.lineTo(0.075 * h, -0.42 * h)
  shape.lineTo(0.075 * h, -0.48 * h)
  shape.lineTo(0, -0.5 * h)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.006 * h,
    bevelEnabled: true,
    bevelThickness: 0.0015 * h,
    bevelSize: 0.0015 * h,
    bevelSegments: 1,
  })
  geometry.translate(0, 0, -0.003 * h)
  return geometry
}

export function createRocket({
  height,
  lightweight,
  cruise = false,
}: {
  height: number
  lightweight: boolean
  /** Em cruzeiro não há plataforma nem fumaça, e a opacidade vale. */
  cruise?: boolean
}) {
  const object = new THREE.Group()
  const h = height
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

  const texture = hullTexture()
  const hull = trackM(
    new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      metalness: 0.55,
      roughness: 0.42,
      envMapIntensity: 1.1,
      transparent: cruise,
    }),
  )
  const dark = trackM(
    new THREE.MeshStandardMaterial({
      color: 0x1f2532,
      metalness: 0.8,
      roughness: 0.35,
      envMapIntensity: 1.2,
      transparent: cruise,
    }),
  )
  const bell = trackM(
    new THREE.MeshStandardMaterial({
      color: 0x8a8f9a,
      metalness: 0.95,
      roughness: 0.28,
      envMapIntensity: 1.4,
      side: THREE.DoubleSide,
      transparent: cruise,
    }),
  )
  const hullMaterials = [hull, dark, bell]

  const segments = lightweight ? 36 : 56
  const body = new THREE.Mesh(track(new THREE.LatheGeometry(hullProfile(h), segments)), hull)
  object.add(body)

  /* Três motores em sino num triângulo, mais um brilho no meio. */
  for (let k = 0; k < 3; k += 1) {
    const angle = (k / 3) * Math.PI * 2 + Math.PI / 6
    const mesh = new THREE.Mesh(track(new THREE.LatheGeometry(bellProfile(h, 1), 24)), bell)
    mesh.position.set(Math.cos(angle) * 0.028 * h, 0, Math.sin(angle) * 0.028 * h)
    object.add(mesh)
  }

  /* Quatro aletas curtas e escuras. */
  const fin = track(finGeometry(h))
  for (let k = 0; k < 4; k += 1) {
    const pivot = new THREE.Group()
    pivot.rotation.y = (k / 4) * Math.PI * 2 + Math.PI / 4
    const mesh = new THREE.Mesh(fin, dark)
    mesh.position.set(R * 1.0 * h, 0, 0)
    pivot.add(mesh)
    object.add(pivot)
  }

  /* Chama em duas camadas: laranja por fora, branco-azulado por dentro. */
  const flameMaterials: THREE.ShaderMaterial[] = []
  const makeFlame = (radius: number, length: number, core: string, mid: string, tail: string) => {
    const geometry = track(new THREE.ConeGeometry(radius * h, length * h, 20, 1, true))
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
    mesh.position.y = -0.62 * h
    object.add(mesh)
  }
  makeFlame(0.06, 1.5, '#fff4dc', '#ff9a3c', '#d42a0a')
  makeFlame(0.028, 0.9, '#ffffff', '#d6ecff', '#79b4ff')

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
  glow.position.y = -0.64 * h
  object.add(glow)

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
  const smokeCount = lightweight ? 120 : 200
  const smokePositions = new Float32Array(smokeCount * 3)
  const smokeAges = new Float32Array(smokeCount)
  const smokeSizes = new Float32Array(smokeCount)
  const velocities = new Float32Array(smokeCount * 3)
  const lives = new Float32Array(smokeCount)
  for (let i = 0; i < smokeCount; i += 1) {
    smokeAges[i] = 1
    lives[i] = 1
    smokeSizes[i] = 6 + Math.random() * 10
  }
  const smokeGeometry = new THREE.BufferGeometry()
  const smokePosAttr = new THREE.BufferAttribute(smokePositions, 3)
  const smokeAgeAttr = new THREE.BufferAttribute(smokeAges, 1)
  smokeGeometry.setAttribute('position', smokePosAttr)
  smokeGeometry.setAttribute('aAge', smokeAgeAttr)
  smokeGeometry.setAttribute('aSize', new THREE.BufferAttribute(smokeSizes, 1))
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

  const root = new THREE.Group()
  root.add(object)
  if (!cruise) root.add(pad, smoke)

  let spawnCursor = 0
  let spawnDebt = 0
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
        model.scale.setScalar(h / Math.max(size.y, 0.0001))
        box.setFromObject(model)
        const center = new THREE.Vector3()
        box.getCenter(center)
        model.position.sub(center)
        for (const child of [...object.children]) {
          const isFlame = child instanceof THREE.Mesh && flameMaterials.includes(child.material as THREE.ShaderMaterial)
          if (!isFlame && child !== glow) child.visible = false
        }
        object.add(model)
        modelLoaded = true
      })
    })
  }

  return {
    object: root,
    update(state: RocketState, time: number, delta: number) {
      root.visible = state.visible || (!cruise && alive > 0)
      if (!root.visible) return
      if (cruise) for (const material of hullMaterials) material.opacity = state.opacity

      const y = state.yPad + state.lift * state.travel
      object.position.set(state.x, y, 0)
      object.visible = state.visible
      /* No ar gira devagar para mostrar o volume e inclina um nada; em
         cruzeiro inclina para o lado do rumo. Na plataforma, a marca fica
         virada para a câmera. */
      const flying = cruise ? 1 : state.lift
      object.rotation.y = flying > 0 ? 1.4 + time * 0.3 * flying : 1.4
      object.rotation.z = cruise
        ? -0.12 + Math.sin(time * 1.3) * 0.02
        : state.lift > 0
          ? Math.sin(time * 1.7) * 0.02 * state.lift
          : 0

      for (const material of flameMaterials) {
        material.uniforms.uTime.value = time
        material.uniforms.uThrust.value = state.thrust
        material.uniforms.uOpacity.value = state.opacity
      }
      glowMaterial.uniforms.uOpacity.value = state.thrust * state.opacity

      if (cruise) return
      pad.position.set(state.x, state.yPad - 0.64 * h, -0.05)
      padMaterial.uniforms.uOpacity.value =
        state.thrust * Math.max(0, 1 - state.lift * 2.5) * state.opacity * 0.7

      const rate = state.thrust * Math.max(0, 1 - state.lift * 1.6) * (lightweight ? 70 : 110)
      spawnDebt += rate * delta
      while (spawnDebt >= 1) {
        spawn(state.x, y - 0.62 * h)
        spawnDebt -= 1
      }
      alive = 0
      const floor = state.yPad - 0.64 * h
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
      texture?.dispose()
    },
  }
}
