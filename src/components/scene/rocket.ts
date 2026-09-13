import * as THREE from 'three'

/**
 * Foguete estilizado no visual da marca: silhueta escura quase opaca com as
 * arestas em linha, cobalto no corpo e ivory no nariz e nas aletas. Chama
 * por shader, fumaça simulada na CPU (200 pontos, custo desprezível) e um
 * brilho na plataforma que acende no empuxo.
 *
 * Gancho para modelo real: preencha ROCKET_MODEL_URL com um .glb (Draco em
 * /public/draco/). Carregado, o estilizado some. Vazio, nada é baixado.
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

const ONYX = 0x0b1226
const COBALT = 0x4d84e0
const IVORY = 0xf5f7fb

const FLAME_VERTEX = /* glsl */ `
  uniform float uThrust;
  varying vec2 vUv;
  varying float vEdge;
  void main() {
    vUv = uv;
    vec3 p = position;
    /* Cresce para baixo com o empuxo; parado, sobra um bico curto. */
    p.y *= 0.25 + uThrust * 0.75;
    vec3 n = normalize(normalMatrix * normal);
    vEdge = abs(n.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const FLAME_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uThrust;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vEdge;
  void main() {
    /* uv.y = 1 na base (bocal), 0 na ponta. */
    float along = 1.0 - vUv.y;
    float flicker = 0.5 + 0.5 * sin(along * 22.0 - uTime * 26.0 + sin(vUv.x * 18.85) * 1.6);
    vec3 core = vec3(1.0, 0.97, 0.88);
    vec3 mid = vec3(1.0, 0.62, 0.24);
    vec3 tail = vec3(0.9, 0.25, 0.08);
    vec3 color = mix(core, mid, smoothstep(0.0, 0.35, along));
    color = mix(color, tail, smoothstep(0.35, 0.9, along));
    float alpha = pow(1.0 - along, 1.4) * (0.55 + 0.45 * flicker) * pow(vEdge, 0.6);
    gl_FragColor = vec4(color, alpha * uOpacity * (0.35 + 0.65 * uThrust));
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
    /* Nasce clara e esfria para o cinza-azul do fundo. */
    vec3 color = mix(vec3(0.95, 0.9, 0.85), vec3(0.45, 0.5, 0.62), vAge);
    float alpha = soft * (1.0 - vAge) * uOpacity * 0.55;
    gl_FragColor = vec4(color, alpha);
  }
`

/** Aleta: um trapézio fino extrudado, encostado no corpo. */
function finGeometry(height: number) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(0.16 * height, -0.1 * height)
  shape.lineTo(0.16 * height, -0.3 * height)
  shape.lineTo(0, -0.3 * height)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.018 * height,
    bevelEnabled: false,
  })
  geometry.translate(0, 0, -0.009 * height)
  return geometry
}

export function createRocket({ height, lightweight }: { height: number; lightweight: boolean }) {
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

  /* Silhueta: quase opaca, para o campo atrás não vazar pelo corpo. */
  const hull = trackM(new THREE.MeshBasicMaterial({ color: ONYX, transparent: true, opacity: 0.92 }))
  const edgeCobalt = trackM(
    new THREE.LineBasicMaterial({ color: COBALT, transparent: true, opacity: 0.9 }),
  )
  const edgeIvory = trackM(
    new THREE.LineBasicMaterial({ color: IVORY, transparent: true, opacity: 0.85 }),
  )

  const parts: Array<{
    solid: THREE.BufferGeometry
    wire: THREE.BufferGeometry
    y: number
    edge: THREE.LineBasicMaterial
  }> = [
    {
      solid: track(new THREE.CylinderGeometry(0.11 * h, 0.13 * h, 0.62 * h, 24)),
      wire: track(new THREE.CylinderGeometry(0.11 * h, 0.13 * h, 0.62 * h, 8)),
      y: 0,
      edge: edgeCobalt,
    },
    {
      solid: track(new THREE.ConeGeometry(0.11 * h, 0.3 * h, 24)),
      wire: track(new THREE.ConeGeometry(0.11 * h, 0.3 * h, 8)),
      y: 0.46 * h,
      edge: edgeIvory,
    },
    {
      solid: track(new THREE.CylinderGeometry(0.07 * h, 0.11 * h, 0.14 * h, 16)),
      wire: track(new THREE.CylinderGeometry(0.07 * h, 0.11 * h, 0.14 * h, 8)),
      y: -0.38 * h,
      edge: edgeCobalt,
    },
  ]
  for (const part of parts) {
    const mesh = new THREE.Mesh(part.solid, hull)
    mesh.position.y = part.y
    object.add(mesh)
    /* Arestas do modelo de 8 lados: linhas longitudinais, leitura de holograma. */
    const edges = new THREE.LineSegments(track(new THREE.EdgesGeometry(part.wire, 1)), part.edge)
    edges.position.y = part.y
    object.add(edges)
  }

  const fin = track(finGeometry(h))
  const finWire = track(new THREE.EdgesGeometry(fin, 1))
  for (let k = 0; k < 3; k += 1) {
    const pivot = new THREE.Group()
    pivot.rotation.y = (k / 3) * Math.PI * 2
    const mesh = new THREE.Mesh(fin, hull)
    mesh.position.set(0.12 * h, -0.02 * h, 0)
    const edges = new THREE.LineSegments(finWire, edgeIvory)
    edges.position.copy(mesh.position)
    pivot.add(mesh, edges)
    object.add(pivot)
  }

  /* Chama: cone de ponta para baixo, base no bocal. */
  const flameGeometry = track(new THREE.ConeGeometry(0.085 * h, 0.9 * h, 16, 1, true))
  flameGeometry.rotateX(Math.PI)
  flameGeometry.translate(0, -0.45 * h, 0)
  const flameMaterial = trackM(
    new THREE.ShaderMaterial({
      vertexShader: FLAME_VERTEX,
      fragmentShader: FLAME_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uThrust: { value: 0 }, uOpacity: { value: 1 } },
    }),
  )
  const flame = new THREE.Mesh(flameGeometry, flameMaterial)
  flame.position.y = -0.45 * h
  object.add(flame)

  /* Ponto de luz no bocal. */
  const glowGeometry = track(new THREE.PlaneGeometry(0.5 * h, 0.5 * h))
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
  glow.position.y = -0.48 * h
  object.add(glow)

  /* Brilho da plataforma: fica no chão, não sobe com o foguete. */
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

  /* Fumaça: simulada aqui, em mundo, para ficar para trás quando o foguete
     sobe. 200 partículas é pouco para a CPU e o bastante para a leitura. */
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

  /* O grupo raiz junta o que sobe e o que fica. */
  const root = new THREE.Group()
  root.add(object, pad, smoke)

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
        /* Some o estilizado, ficam chama, brilho e fumaça. */
        for (const child of [...object.children]) {
          if (child !== flame && child !== glow) child.visible = false
        }
        object.add(model)
        modelLoaded = true
      })
    })
  }

  return {
    object: root,
    update(state: RocketState, time: number, delta: number) {
      root.visible = state.visible || alive > 0
      if (!root.visible) return

      const y = state.yPad + state.lift * state.travel
      object.position.set(state.x, y, 0)
      object.visible = state.visible
      /* Balanço mínimo no ar: 1,5 grau, para o foguete não parecer colado. */
      object.rotation.z = state.lift > 0 ? Math.sin(time * 1.7) * 0.026 * state.lift : 0

      flameMaterial.uniforms.uTime.value = time
      flameMaterial.uniforms.uThrust.value = state.thrust
      flameMaterial.uniforms.uOpacity.value = state.opacity
      glowMaterial.uniforms.uOpacity.value = state.thrust * state.opacity * 0.9

      pad.position.set(state.x, state.yPad - 0.5 * h, -0.05)
      padMaterial.uniforms.uOpacity.value =
        state.thrust * Math.max(0, 1 - state.lift * 2.5) * state.opacity * 0.7

      /* Fumaça: nasce no bocal enquanto há empuxo e o foguete está baixo. */
      const rate = state.thrust * Math.max(0, 1 - state.lift * 1.6) * (lightweight ? 70 : 110)
      spawnDebt += rate * delta
      while (spawnDebt >= 1) {
        spawn(state.x, y - 0.45 * h)
        spawnDebt -= 1
      }
      alive = 0
      const floor = state.yPad - 0.5 * h
      for (let i = 0; i < smokeCount; i += 1) {
        if (smokeAges[i] >= 1) continue
        alive += 1
        smokeAges[i] = Math.min(1, smokeAges[i] + delta / lives[i])
        /* Perde velocidade e abre para os lados conforme envelhece. */
        velocities[i * 3 + 1] *= 1 - delta * 1.8
        velocities[i * 3] *= 1 - delta * 0.6
        smokePositions[i * 3] += velocities[i * 3] * delta
        smokePositions[i * 3 + 1] += velocities[i * 3 + 1] * delta
        smokePositions[i * 3 + 2] += velocities[i * 3 + 2] * delta
        /* Chão: a fumaça se espalha na horizontal ao bater na plataforma. */
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
