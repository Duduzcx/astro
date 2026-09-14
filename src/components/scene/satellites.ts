import * as THREE from 'three'

/**
 * Satélites em órbita da Terra do hero: pontos pequenos numa órbita
 * inclinada, girando devagar e piscando cada um no seu tempo. Vive como
 * filho do grupo da Terra, então recua e some junto com ela. A metade de
 * trás fica escondida pela profundidade do planeta.
 */
const VERTEX = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vBlink;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    vBlink = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (1.4 + aSeed * 2.0) + aSeed * 30.0), 6.0);
    gl_PointSize = (2.2 + aSeed * 1.6) * uPixelRatio;
  }
`

const FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying float vBlink;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = smoothstep(1.0, 0.3, d) * vBlink * uOpacity;
    gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), alpha);
  }
`

export function createSatellites(count: number, orbitRadius: number, pixelRatio: number) {
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2
    /* Órbitas em alturas ligeiramente diferentes. */
    const radius = orbitRadius * (1 + Math.random() * 0.08)
    positions[i * 3] = Math.cos(angle) * radius
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.06 * orbitRadius
    positions[i * 3 + 2] = Math.sin(angle) * radius
    seeds[i] = Math.random()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uOpacity: { value: 1 },
    },
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  const object = new THREE.Group()
  /* Plano orbital inclinado: lê como órbita, não como anel. */
  object.rotation.x = 0.38
  object.rotation.z = -0.12
  object.add(points)

  return {
    object,
    update(opacity: number, time: number) {
      object.visible = opacity > 0.01
      if (!object.visible) return
      object.rotation.y = time * 0.05
      material.uniforms.uTime.value = time
      material.uniforms.uOpacity.value = opacity
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
