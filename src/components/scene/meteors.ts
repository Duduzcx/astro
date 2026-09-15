import * as THREE from 'three'

/**
 * Meteoros: de tempos em tempos um risco de luz cruza o céu e some. Cada
 * um é uma fila de pontos atrás de uma cabeça que avança com ease-out, com
 * tamanho e brilho caindo para a cauda. Um draw call, quase sem CPU.
 */
const POINTS = 22

const VERTEX = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = aSize * uPixelRatio * (3.0 / -view.z);
  }
`

const FRAGMENT = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float soft = smoothstep(1.0, 0.1, d);
    /* Cabeça quase branca, cauda esfriando para o turquesa: o rastro de
       um meteoro de verdade muda de cor conforme esfria. */
    vec3 color = mix(vec3(0.5, 0.85, 1.0), vec3(0.95, 0.97, 1.0), smoothstep(0.15, 0.8, vAlpha));
    gl_FragColor = vec4(color, soft * vAlpha);
  }
`

type Meteor = {
  active: boolean
  next: number
  t: number
  duration: number
  x0: number
  y0: number
  dx: number
  dy: number
  length: number
}

export function createMeteors(count: number, pixelRatio: number) {
  const total = count * POINTS
  const positions = new Float32Array(total * 3)
  const alphas = new Float32Array(total)
  const sizes = new Float32Array(total)
  for (let m = 0; m < count; m += 1) {
    for (let i = 0; i < POINTS; i += 1) {
      const k = m * POINTS + i
      const along = i / (POINTS - 1)
      sizes[k] = 1.2 + (1 - along) * (1 - along) * 4.5
      positions[k * 3 + 2] = -1.2
    }
  }
  const geometry = new THREE.BufferGeometry()
  const positionAttr = new THREE.BufferAttribute(positions, 3)
  const alphaAttr = new THREE.BufferAttribute(alphas, 1)
  positionAttr.setUsage(THREE.DynamicDrawUsage)
  alphaAttr.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positionAttr)
  geometry.setAttribute('aAlpha', alphaAttr)
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uPixelRatio: { value: pixelRatio } },
  })
  const object = new THREE.Points(geometry, material)
  object.frustumCulled = false

  const meteors: Meteor[] = []
  for (let m = 0; m < count; m += 1) {
    meteors.push({
      active: false,
      next: 2 + m * 4 + Math.random() * 4,
      t: 0,
      duration: 1,
      x0: 0,
      y0: 0,
      dx: 0,
      dy: 0,
      length: 1,
    })
  }

  return {
    object,
    update(time: number, delta: number, halfWidth: number, halfHeight: number) {
      let any = false
      meteors.forEach((meteor, m) => {
        if (!meteor.active) {
          if (time < meteor.next) return
          /* Nasce no alto, cai inclinado para um dos lados. */
          meteor.active = true
          meteor.t = 0
          meteor.duration = 0.7 + Math.random() * 0.5
          meteor.x0 = (Math.random() * 2 - 1) * halfWidth * 1.3
          meteor.y0 = halfHeight * (0.1 + Math.random() * 1.0)
          const angle = -Math.PI / 5 - Math.random() * Math.PI / 5
          const side = Math.random() < 0.5 ? 1 : -1
          meteor.dx = Math.cos(angle) * side
          meteor.dy = Math.sin(angle)
          meteor.length = 0.9 + Math.random() * 1.1
        }
        meteor.t += delta / meteor.duration
        const t = Math.min(meteor.t, 1)
        const eased = 1 - (1 - t) * (1 - t)
        const headX = meteor.x0 + meteor.dx * meteor.length * eased
        const headY = meteor.y0 + meteor.dy * meteor.length * eased
        const tail = meteor.length * 0.45 * Math.min(1, t * 2.5)
        const fade = Math.sin(Math.PI * t)
        for (let i = 0; i < POINTS; i += 1) {
          const k = m * POINTS + i
          const along = i / (POINTS - 1)
          positions[k * 3] = headX - meteor.dx * tail * along
          positions[k * 3 + 1] = headY - meteor.dy * tail * along
          alphas[k] = (1 - along) * (1 - along) * fade * 0.9
        }
        any = true
        if (meteor.t >= 1) {
          meteor.active = false
          meteor.next = time + 4 + Math.random() * 8
          for (let i = 0; i < POINTS; i += 1) alphas[m * POINTS + i] = 0
        }
      })
      if (any) {
        positionAttr.needsUpdate = true
        alphaAttr.needsUpdate = true
      }
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
