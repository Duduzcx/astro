import * as THREE from 'three'

/**
 * O espaço em si: uma esfera enorme virada para dentro com um panorama da
 * Via Láctea, em intensidade baixa e puxada para o azul da marca, girando
 * devagar com o scroll para dar paralaxe atrás das estrelas e dos astros.
 * Enquanto a textura não chega, a esfera é invisível e o fundo é o onyx.
 */
const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uIntensity;
  uniform vec3 uTint;
  uniform vec3 uBase;
  varying vec2 vUv;
  void main() {
    vec3 sky = texture2D(uMap, vUv).rgb;
    /* Luminância guia o brilho; a cor vai um pouco para o azul da marca
       para o panorama não brigar com a paleta. O onyx da página é a base:
       a esfera pinta por cima de tudo e não pode virar preto. */
    float lum = dot(sky, vec3(0.299, 0.587, 0.114));
    vec3 color = uBase + mix(sky, uTint * lum, 0.45) * uIntensity;
    gl_FragColor = vec4(color, 1.0);
  }
`

export function createSpace(url: string) {
  const geometry = new THREE.SphereGeometry(14, 48, 32)
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uMap: { value: null },
      uIntensity: { value: 0.75 },
      uTint: { value: new THREE.Color('#8db4f5') },
      uBase: { value: new THREE.Color('#0a0f1e') },
    },
  })
  const object = new THREE.Mesh(geometry, material)
  object.renderOrder = -20
  object.visible = false
  object.frustumCulled = false

  const loader = new THREE.TextureLoader()
  let texture: THREE.Texture | null = null
  loader.load(url, (loaded) => {
    loaded.colorSpace = THREE.NoColorSpace
    loaded.minFilter = THREE.LinearMipmapLinearFilter
    loaded.anisotropy = 4
    texture = loaded
    material.uniforms.uMap.value = loaded
    object.visible = true
  })

  return {
    object,
    update(progress: number, time: number) {
      /* Paralaxe: o céu gira devagar com a página e respira no tempo. */
      object.rotation.y = -0.9 + progress * 0.7 + time * 0.002
      object.rotation.x = 0.2 - progress * 0.25
    },
    setIntensity(value: number) {
      material.uniforms.uIntensity.value = value
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      texture?.dispose()
    },
  }
}
