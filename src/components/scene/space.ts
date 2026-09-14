import * as THREE from 'three'
import { SIMPLEX_NOISE } from './glsl'

/**
 * O espaço em si: uma esfera enorme virada para dentro com um panorama da
 * Via Láctea, em intensidade baixa e puxada para o azul da marca, girando
 * devagar com o scroll para dar paralaxe atrás das estrelas e dos astros.
 * Enquanto a textura não chega, a esfera é invisível e o fundo é o onyx.
 */
const VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vDir;
  void main() {
    vUv = uv;
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uIntensity;
  uniform vec3 uTint;
  uniform vec3 uBase;
  uniform float uNebula;
  varying vec2 vUv;
  varying vec3 vDir;
  ${SIMPLEX_NOISE}
  void main() {
    vec3 sky = texture2D(uMap, vUv).rgb;
    /* Luminância guia o brilho; a cor vai um pouco para o azul da marca
       para o panorama não brigar com a paleta. O onyx da página é a base:
       a esfera pinta por cima de tudo e não pode virar preto. */
    float lum = dot(sky, vec3(0.299, 0.587, 0.114));
    vec3 color = uBase + mix(sky, uTint * lum, 0.45) * uIntensity;
    if (uNebula > 0.0) {
      /* Nebulosas: dois véus de ruído, cobalto e violeta, mais fortes
         longe da faixa da galáxia, girando junto com o céu. */
      vec3 d = normalize(vDir);
      float a = fbm3(d * 2.6 + 3.1);
      float b = fbm3(d * 6.0 - 1.7);
      float veil = smoothstep(0.08, 0.6, a * 0.75 + b * 0.35 + 0.05);
      vec3 tone = mix(vec3(0.16, 0.34, 0.92), vec3(0.42, 0.26, 0.8), smoothstep(-0.2, 0.3, b));
      color += tone * veil * uNebula * (0.35 + 0.65 * (1.0 - min(lum * 2.5, 1.0)));
    }
    gl_FragColor = vec4(color, 1.0);
  }
`

export function createSpace(
  urls: { low: string; high: string },
  nebula = 0,
  warm?: (texture: THREE.Texture) => void,
) {
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
      uNebula: { value: nebula },
    },
  })
  const object = new THREE.Mesh(geometry, material)
  object.renderOrder = -20
  object.visible = false
  object.frustumCulled = false

  const loader = new THREE.TextureLoader()
  const textures: THREE.Texture[] = []
  const apply = (loaded: THREE.Texture) => {
    loaded.colorSpace = THREE.NoColorSpace
    loaded.minFilter = THREE.LinearMipmapLinearFilter
    loaded.anisotropy = 8
    warm?.(loaded)
    material.uniforms.uMap.value = loaded
    object.visible = true
  }
  /* Em degraus: o leve aparece primeiro, o pesado substitui. */
  textures.push(
    loader.load(urls.low, (low) => {
      apply(low)
      textures.push(loader.load(urls.high, (high) => apply(high)))
    }),
  )

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
      for (const texture of textures) texture.dispose()
    },
  }
}
