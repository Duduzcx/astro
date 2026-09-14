import * as THREE from 'three'
import { SIMPLEX_NOISE } from './glsl'

/**
 * O rastro do foguete: uma fita que sai do bocal e segue o caminho que ele
 * já percorreu, fina e quente na cabeça, larga, fria e rala na cauda, como
 * o jato de exaustão se dissipando na atmosfera.
 *
 * A fita é analítica: em vez de guardar posições frame a frame (que
 * enrolam quando o scroll volta), ela amostra a própria trajetória, uma
 * função do progresso, um trecho atrás da cabeça. Assim o rastro é sempre
 * exatamente o caminho, para frente e para trás.
 */
export type TrailPath = (u: number, out: THREE.Vector3) => void

const VERTEX = /* glsl */ `
  attribute float aAlong;
  attribute float aSide;
  varying float vAlong;
  varying float vSide;
  void main() {
    vAlong = aAlong;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uSeed;
  varying float vAlong;
  varying float vSide;
  ${SIMPLEX_NOISE}
  void main() {
    /* Quente e estreito no bocal, pálido e ralo na cauda. */
    vec3 hot = vec3(1.0, 0.82, 0.55);
    vec3 warm = vec3(0.95, 0.9, 0.86);
    vec3 cold = vec3(0.62, 0.72, 0.9);
    vec3 color = mix(hot, warm, smoothstep(0.0, 0.12, vAlong));
    color = mix(color, cold, smoothstep(0.2, 0.8, vAlong));
    /* Borda macia, mais macia conforme dissipa. */
    float edge = 1.0 - smoothstep(0.15 + vAlong * 0.35, 1.0, abs(vSide));
    /* Turbulência: vórtices que correm para trás com o tempo. */
    float swirl = snoise(vec3(vAlong * 7.0 - uTime * 0.9, vSide * 2.2, uSeed)) * 0.5 + 0.5;
    float wisps = snoise(vec3(vAlong * 18.0 - uTime * 1.6, vSide * 4.0 + 3.0, uSeed + 7.0)) * 0.5 + 0.5;
    float body = mix(0.6, 1.0, swirl) * mix(0.8, 1.0, wisps);
    float fade = pow(1.0 - vAlong, 0.9);
    /* Miolo claro perto do bocal: o jato ainda denso antes de abrir. */
    float core = smoothstep(0.45, 0.0, abs(vSide)) * pow(1.0 - vAlong, 3.0) * 0.5;
    float alpha = min((edge * body * fade * 1.3 + core) * uOpacity, 1.0);
    gl_FragColor = vec4(color * (0.6 + 0.4 * fade), alpha);
  }
`

export function createTrail({ segments, seed = 0 }: { segments: number; seed?: number }) {
  const vertexCount = (segments + 1) * 2
  const positions = new Float32Array(vertexCount * 3)
  const along = new Float32Array(vertexCount)
  const side = new Float32Array(vertexCount)
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    along[i * 2] = t
    along[i * 2 + 1] = t
    side[i * 2] = -1
    side[i * 2 + 1] = 1
  }
  const index: number[] = []
  for (let i = 0; i < segments; i += 1) {
    const a = i * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geometry = new THREE.BufferGeometry()
  const positionAttr = new THREE.BufferAttribute(positions, 3)
  positionAttr.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positionAttr)
  geometry.setAttribute('aAlong', new THREE.BufferAttribute(along, 1))
  geometry.setAttribute('aSide', new THREE.BufferAttribute(side, 1))
  geometry.setIndex(index)

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uSeed: { value: seed },
    },
  })
  const object = new THREE.Mesh(geometry, material)
  object.frustumCulled = false
  object.visible = false

  const point = new THREE.Vector3()
  const next = new THREE.Vector3()
  const tangent = new THREE.Vector2()

  return {
    object,
    /**
     * `path(u)` dá a posição do bocal no progresso `u`; a fita cobre de
     * `head - span` até `head`. `width` é a meia largura na cabeça, em
     * mundo; a cauda abre `spread` vezes isso (no ar abre muito, no vácuo
     * quase nada).
     */
    update(
      path: TrailPath,
      {
        head,
        span,
        width,
        opacity,
        spread = 3.15,
      }: { head: number; span: number; width: number; opacity: number; spread?: number },
      time: number,
    ) {
      object.visible = opacity > 0.01
      if (!object.visible) return
      material.uniforms.uTime.value = time
      material.uniforms.uOpacity.value = opacity
      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments
        const u = head - span * t
        path(u, point)
        /* Tangente por diferença finita, sempre para a frente do caminho. */
        path(u + span * 0.02, next)
        tangent.set(next.x - point.x, next.y - point.y)
        if (tangent.lengthSq() < 1e-10) tangent.set(0, 1)
        tangent.normalize()
        const half = width * (0.35 + spread * t)
        const nx = -tangent.y * half
        const ny = tangent.x * half
        const k = i * 6
        positions[k] = point.x - nx
        positions[k + 1] = point.y - ny
        positions[k + 2] = point.z
        positions[k + 3] = point.x + nx
        positions[k + 4] = point.y + ny
        positions[k + 5] = point.z
      }
      positionAttr.needsUpdate = true
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
