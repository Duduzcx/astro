import * as THREE from 'three'

/**
 * O foguete. Corpo torneado num perfil só (nariz ogival, corpo, boca de
 * sino), material metálico branco-ivory com faixas e aletas em cobalto,
 * janelas escuras, bocal de metal escuro. Precisa das luzes da cena: sem
 * luz direcional tudo isso vira silhueta.
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

const IVORY = 0xf5f7fb
const COBALT = 0x4d84e0
const STEEL = 0x2a3244
const GLASS = 0x0b1226

const FLAME_VERTEX = /* glsl */ `
  uniform float uThrust;
  varying vec2 vUv;
  varying float vEdge;
  void main() {
    vUv = uv;
    vec3 p = position;
    /* Cresce para baixo com o empuxo; parado, sobra um bico curto. */
    p.y *= 0.22 + uThrust * 0.78;
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
    float flicker = 0.5 + 0.5 * sin(along * 24.0 - uTime * 30.0 + sin(vUv.x * 18.85) * 1.8);
    vec3 color = mix(uCore, uMid, smoothstep(0.0, 0.35, along));
    color = mix(color, uTail, smoothstep(0.35, 0.9, along));
    float alpha = pow(1.0 - along, 1.5) * (0.55 + 0.45 * flicker) * pow(vEdge, 0.7);
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
 * Perfil do corpo, de cima para baixo, em frações da altura: ponta do nariz,
 * ogiva, corpo reto, cintura, garganta e a boca de sino do bocal.
 */
function hullProfile(h: number) {
  const points: THREE.Vector2[] = []
  /* Ogiva: raio cresce como um arco de círculo, ponta fina. */
  const steps = 14
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const r = 0.115 * Math.sqrt(1 - (1 - t) * (1 - t))
    points.push(new THREE.Vector2(r * h, (0.62 - 0.3 * t) * h))
  }
  points.push(new THREE.Vector2(0.115 * h, -0.28 * h))
  points.push(new THREE.Vector2(0.105 * h, -0.36 * h))
  points.push(new THREE.Vector2(0.075 * h, -0.4 * h))
  return points
}

function nozzleProfile(h: number) {
  return [
    new THREE.Vector2(0.06 * h, -0.4 * h),
    new THREE.Vector2(0.055 * h, -0.43 * h),
    new THREE.Vector2(0.075 * h, -0.5 * h),
    new THREE.Vector2(0.105 * h, -0.56 * h),
    new THREE.Vector2(0.1 * h, -0.565 * h),
  ]
}

/** Faixa cobalto: um anel torneado um fio maior que o corpo. */
function bandProfile(h: number, top: number, bottom: number, r: number) {
  return [
    new THREE.Vector2((r + 0.002) * h, top * h),
    new THREE.Vector2((r + 0.002) * h, bottom * h),
  ]
}

/** Aleta em asa: raiz longa no corpo, ponta curta, borda de fuga varrida. */
function finGeometry(h: number) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0.06 * h)
  shape.lineTo(0.2 * h, -0.14 * h)
  shape.lineTo(0.2 * h, -0.3 * h)
  shape.lineTo(0, -0.34 * h)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.016 * h,
    bevelEnabled: true,
    bevelThickness: 0.003 * h,
    bevelSize: 0.003 * h,
    bevelSegments: 1,
  })
  geometry.translate(0, 0, -0.008 * h)
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

  const ivory = trackM(
    new THREE.MeshStandardMaterial({ color: IVORY, metalness: 0.35, roughness: 0.38, transparent: cruise }),
  )
  const cobalt = trackM(
    new THREE.MeshStandardMaterial({ color: COBALT, metalness: 0.4, roughness: 0.35, transparent: cruise }),
  )
  const steel = trackM(
    new THREE.MeshStandardMaterial({ color: STEEL, metalness: 0.85, roughness: 0.3, transparent: cruise }),
  )
  const glass = trackM(
    new THREE.MeshStandardMaterial({
      color: GLASS,
      metalness: 0.2,
      roughness: 0.15,
      emissive: 0x1e3a6a,
      emissiveIntensity: 0.6,
      transparent: cruise,
    }),
  )
  const hullMaterials = [ivory, cobalt, steel, glass]

  const lathe = (profile: THREE.Vector2[], material: THREE.Material) => {
    const mesh = new THREE.Mesh(track(new THREE.LatheGeometry(profile, lightweight ? 28 : 40)), material)
    object.add(mesh)
    return mesh
  }
  lathe(hullProfile(h), ivory)
  lathe(nozzleProfile(h), steel)
  /* Ponta do nariz e duas faixas em cobalto. */
  lathe(
    hullProfile(h)
      .slice(0, 7)
      .map((p) => new THREE.Vector2(p.x + 0.002 * h, p.y)),
    cobalt,
  )
  lathe(bandProfile(h, 0.2, 0.14, 0.115), cobalt)
  lathe(bandProfile(h, -0.18, -0.22, 0.115), cobalt)

  /* Três janelas na altura do ombro. */
  const windowGeometry = track(new THREE.CircleGeometry(0.022 * h, 16))
  for (let k = 0; k < 3; k += 1) {
    const angle = (k / 3) * Math.PI * 2 + 0.5
    const mesh = new THREE.Mesh(windowGeometry, glass)
    mesh.position.set(Math.cos(angle) * 0.116 * h, 0.06 * h, Math.sin(angle) * 0.116 * h)
    mesh.lookAt(mesh.position.clone().multiplyScalar(2))
    object.add(mesh)
  }

  /* Quatro aletas. */
  const fin = track(finGeometry(h))
  for (let k = 0; k < 4; k += 1) {
    const pivot = new THREE.Group()
    pivot.rotation.y = (k / 4) * Math.PI * 2 + Math.PI / 4
    const mesh = new THREE.Mesh(fin, cobalt)
    mesh.position.set(0.1 * h, -0.06 * h, 0)
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
    mesh.position.y = -0.55 * h
    object.add(mesh)
  }
  makeFlame(0.1, 1.1, '#fff2d6', '#ff9a3c', '#e8340c')
  makeFlame(0.05, 0.7, '#ffffff', '#cfe6ff', '#6fb0ff')

  const glowGeometry = track(new THREE.PlaneGeometry(0.6 * h, 0.6 * h))
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
  glow.position.y = -0.58 * h
  object.add(glow)

  const padGeometry = track(new THREE.PlaneGeometry(2.4 * h, 0.8 * h))
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
          if (!(child instanceof THREE.Mesh && flameMaterials.includes(child.material as THREE.ShaderMaterial)) && child !== glow) {
            child.visible = false
          }
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
      /* No ar: gira devagar para mostrar o volume, e inclina um nada. Em
         cruzeiro, inclina para o lado do rumo. */
      const flying = cruise ? 1 : state.lift
      object.rotation.y = flying > 0 ? time * 0.35 * flying : 0.4
      object.rotation.z = cruise ? -0.12 + Math.sin(time * 1.3) * 0.02 : state.lift > 0 ? Math.sin(time * 1.7) * 0.02 * state.lift : 0

      for (const material of flameMaterials) {
        material.uniforms.uTime.value = time
        material.uniforms.uThrust.value = state.thrust
        material.uniforms.uOpacity.value = state.opacity
      }
      glowMaterial.uniforms.uOpacity.value = state.thrust * state.opacity

      if (cruise) return
      pad.position.set(state.x, state.yPad - 0.58 * h, -0.05)
      padMaterial.uniforms.uOpacity.value =
        state.thrust * Math.max(0, 1 - state.lift * 2.5) * state.opacity * 0.7

      const rate = state.thrust * Math.max(0, 1 - state.lift * 1.6) * (lightweight ? 70 : 110)
      spawnDebt += rate * delta
      while (spawnDebt >= 1) {
        spawn(state.x, y - 0.55 * h)
        spawnDebt -= 1
      }
      alive = 0
      const floor = state.yPad - 0.58 * h
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
    },
  }
}
