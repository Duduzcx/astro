import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * The signature object: an ORBITAL CORE — a dense nucleus of outlined
 * triangles wrapped by three tilted rings that precess at different speeds,
 * like an atom or a small planetary system. On scroll it scatters into a field
 * and regroups, one fixed canvas behind the whole document; every section
 * change is a state of this scene, not a new scene.
 */

/**
 * Blue-hour palette with more life than pure monochrome: cobalt leads, cyan
 * and soft violet season it, ivory keeps the cool base.
 */
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
 * Scroll keyframes: [pageProgress, scatterMix, sphereX (fraction of half-width),
 * sphereY, scale, opacity]. Tuned to the section order in App.tsx — hero right,
 * services left, manifesto dispersed, mission regrouped right, team/clients a
 * faint sparse field (cards need quiet behind them), footer regrouped centre.
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

function sampleKeyframes(progress: number) {
  const clamped = Math.min(Math.max(progress, 0), 1)
  let index = 0
  while (index < KEYFRAMES.length - 2 && KEYFRAMES[index + 1][0] < clamped) index += 1
  const from = KEYFRAMES[index]
  const to = KEYFRAMES[index + 1]
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
  varying vec3 vColor;
  varying float vFade;

  /* Rodrigues rotation around an arbitrary unit axis. */
  vec3 rotateAxis(vec3 p, vec3 axis, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
  }

  void main() {
    vColor = aColor;

    /* The planet body spins slowly on Y; each ring band ORBITS in the shared
       tilted disc plane at its own speed and direction — counter-rotation is
       what makes the object feel alive. */
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

    /* Far side dims instead of disappearing; rings stay a touch brighter. */
    float depth = smoothstep(-1.5, 1.2, core.z);
    float base = aRing > 0.5 ? 0.35 : 0.15;
    vFade = mix(base + (1.0 - base) * depth * depth, 0.85, uMix);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position3, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vFade;

  void main() {
    gl_FragColor = vec4(vColor, uOpacity * vFade);
  }
`

/**
 * Builds outlined triangles as one LineSegments geometry: 3 edges → 6 vertices
 * per triangle, with the sphere-state and scatter-state positions baked into
 * attributes so the shader can morph between them.
 */
/**
 * One shared tilted orbital plane (a ringed planet, not a brain): three
 * concentric bands with clear gaps, counter-rotating against each other.
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
    /* Gathered state: 58% in a dense nucleus, the rest split across three
       tilted orbit rings — an orbital core, not the reference's brain-sphere. */
    let anchor: THREE.Vector3
    let ring = 0
    if (onSphere) {
      const roll = Math.random()
      if (roll < 0.6) {
        /* Planet body: dense ball on the sphere surface plus inner fill. */
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
        /* Paper-thin vertical jitter: the bands must read as a flat ring disc. */
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

    /* Triangle corners in a random plane around the anchor. Mostly tiny, the
       occasional bigger one — fine grain in the core, chunkier on the rings. */
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

    /* Edges: 0-1, 1-2, 2-0. */
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
  /* LineSegments needs a `position` attribute even though the shader ignores it. */
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
    /* Small screens get the same scene at a lighter weight: fewer triangles
       and a lower pixel ratio — same look, steadier frame rate. */
    const lightweight = window.innerWidth < 1024

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lightweight ? 1.25 : 1.5))
    renderer.setSize(window.innerWidth, window.innerHeight)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 20)
    camera.position.z = 3.3

    const spread = new THREE.Vector3(2.6, 1.7, 1.2)
    const sphereGeometry = buildTriangles(lightweight ? 3200 : 9000, spread, true)
    const sphereMaterial = makeMaterial(0.95)
    const sphereField = new THREE.LineSegments(sphereGeometry, sphereMaterial)
    scene.add(sphereField)

    /* Always-dispersed ambient layer: the faint triangles floating everywhere. */
    const ambientGeometry = buildTriangles(lightweight ? 240 : 700, new THREE.Vector3(3.2, 2.1, 1.6), false)
    const ambientMaterial = makeMaterial(0.32)
    ambientMaterial.uniforms.uMix.value = 1
    const ambientField = new THREE.LineSegments(ambientGeometry, ambientMaterial)
    scene.add(ambientField)

    let halfWidth = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * camera.aspect
    const current = { mix: 0.04, x: 0.58, y: 0.02, scale: 1, opacity: 1 }
    const pointer = { x: 0, y: 0 }

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    /* Mobile browsers fire resize when the URL bar collapses mid-scroll; if we
       re-project on that, the planet visibly jumps. Only a real width change
       (rotation, window resize) rebuilds the projection. */
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
      halfWidth = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * camera.aspect
    }
    window.addEventListener('resize', onResize)

    /* First rendered frame lifts the container's opacity — no canvas pop-in. */
    let revealed = false

    let frame = 0
    let previous = performance.now()

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const delta = Math.min((now - previous) / 1000, 0.05)
      previous = now

      const doc = document.documentElement
      const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 1)
      const progress = window.scrollY / maxScroll
      const target = sampleKeyframes(progress)

      /* Narrow viewports put the object BEHIND the copy — same scene, slightly
         smaller and softer so the text stays readable. */
      const narrow = camera.aspect < 0.9
      const xDamp = narrow ? 0.3 : 1
      const scaleDamp = narrow ? 0.8 : 1
      const opacityDamp = narrow ? 0.6 : 1
      const damping = reducedMotion ? 1 : 1 - Math.exp(-delta * 4.5)
      current.mix += (target.mix - current.mix) * damping
      current.x += (target.x * xDamp - current.x) * damping
      current.y += (target.y - current.y) * damping
      current.scale += (target.scale * scaleDamp - current.scale) * damping
      current.opacity += (target.opacity * opacityDamp - current.opacity) * damping

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

      renderer.render(scene, camera)

      if (!revealed) {
        revealed = true
        mount.style.opacity = '1'
      }
    }
    frame = requestAnimationFrame(tick)

    /* No point burning GPU while the tab is hidden. */
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
