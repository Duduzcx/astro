import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * The signature object, after the reference: thousands of small outlined
 * triangles that assemble into a sphere, scatter into a field, and regroup as
 * the page scrolls. One fixed canvas behind the whole document; every section
 * change is a state of this scene, not a new scene.
 */

/**
 * Mercury discipline applied to the Dala field: a cool monochrome of ivory,
 * ash and slate-blue, with cobalt as the only chromatic note.
 */
const PALETTE: Array<[string, number]> = [
  ['#5266eb', 0.24],
  ['#7d8bf0', 0.16],
  ['#a5b1ff', 0.08],
  ['#ededf3', 0.2],
  ['#c3c3cc', 0.14],
  ['#8b8fa8', 0.1],
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
  [0.0, 0.04, 0.58, 0.02, 1.0, 1.0],
  [0.05, 0.06, 0.58, 0.0, 1.0, 1.0],
  [0.1, 0.14, -0.52, 0.0, 0.92, 1.0],
  [0.24, 0.16, -0.52, 0.0, 0.92, 1.0],
  [0.3, 1.0, 0.0, 0.0, 1.12, 0.9],
  [0.41, 1.0, 0.0, 0.0, 1.12, 0.9],
  [0.45, 0.05, 0.55, 0.0, 0.98, 1.0],
  [0.49, 0.06, 0.55, 0.0, 0.98, 1.0],
  [0.55, 0.9, 0.0, 0.0, 1.35, 0.22],
  [0.93, 0.9, 0.0, 0.0, 1.35, 0.22],
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
  uniform float uMix;
  uniform float uTime;
  uniform float uScale;
  uniform vec2 uCenter;
  varying vec3 vColor;
  varying float vFade;

  void main() {
    vColor = aColor;

    float spin = uTime * 0.07;
    float c = cos(spin);
    float s = sin(spin);
    vec3 sphere = vec3(
      aSphere.x * c + aSphere.z * s,
      aSphere.y,
      -aSphere.x * s + aSphere.z * c
    );

    vec3 scatter = aScatter;
    scatter.x += sin(uTime * 0.28 + aRand * 6.2831) * 0.09;
    scatter.y += cos(uTime * 0.22 + aRand * 9.42) * 0.09;

    vec3 position3 = mix(sphere, scatter, uMix) * uScale;
    position3.xy += uCenter;

    /* Triangles on the far side of the sphere dim instead of disappearing. */
    float depth = smoothstep(-1.0, 0.9, sphere.z);
    vFade = mix(0.12 + 0.88 * depth * depth, 0.85, uMix);

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
function buildTriangles(count: number, spread: THREE.Vector3, onSphere: boolean) {
  const spherePositions = new Float32Array(count * 6 * 3)
  const scatterPositions = new Float32Array(count * 6 * 3)
  const colors = new Float32Array(count * 6 * 3)
  const randoms = new Float32Array(count * 6)
  const color = new THREE.Color()
  const golden = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < count; i += 1) {
    /* Sphere anchor: fibonacci distribution with a little jitter. */
    let anchor: THREE.Vector3
    if (onSphere) {
      const t = (i + 0.5) / count
      const inclination = Math.acos(1 - 2 * t)
      const azimuth = golden * i
      anchor = new THREE.Vector3(
        Math.sin(inclination) * Math.cos(azimuth),
        Math.cos(inclination),
        Math.sin(inclination) * Math.sin(azimuth),
      ).multiplyScalar(0.98 + Math.random() * 0.06)
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
       occasional bigger one — the reference brain reads as fine grain. */
    const size = (onSphere ? 0.005 : 0.012) + Math.random() * Math.random() * (onSphere ? 0.022 : 0.055)
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
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('aSphere', new THREE.BufferAttribute(spherePositions, 3))
  geometry.setAttribute('aScatter', new THREE.BufferAttribute(scatterPositions, 3))
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('aRand', new THREE.BufferAttribute(randoms, 1))
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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 20)
    camera.position.z = 3.3

    const spread = new THREE.Vector3(2.6, 1.7, 1.2)
    const sphereGeometry = buildTriangles(6000, spread, true)
    const sphereMaterial = makeMaterial(0.95)
    const sphereField = new THREE.LineSegments(sphereGeometry, sphereMaterial)
    scene.add(sphereField)

    /* Always-dispersed ambient layer: the faint triangles floating everywhere. */
    const ambientGeometry = buildTriangles(420, new THREE.Vector3(3.2, 2.1, 1.6), false)
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

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
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

      /* Narrow viewports put the object BEHIND the copy, so it shrinks and
         quiets down instead of competing with the text. */
      const narrow = camera.aspect < 0.9
      const xDamp = narrow ? 0.25 : 1
      const scaleDamp = narrow ? 0.72 : 1
      const opacityDamp = narrow ? 0.5 : 1
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
