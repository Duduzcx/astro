import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

/* Vinheta leve e grão fino: os dois truques mais baratos de fotografia de
   cinema, e os que mais tiram o ar de render limpo demais. */
const FILM = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uVignette: { value: 0.32 },
    uGrain: { value: 0.035 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - smoothstep(0.42, 0.95, d) * uVignette;
      float g = fract(sin(dot(vUv + fract(uTime * 0.37), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      c.rgb += g * uGrain;
      gl_FragColor = c;
    }
  `,
}

/**
 * Bloom cinematográfico, só no desktop: o que passa do limiar (motor,
 * disco de acreção, supernova, borda da atmosfera) sangra luz. Meia
 * resolução, três níveis. No celular a cena desenha direto.
 */
export function createPostFx(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
) {
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType })
  const composer = new EffectComposer(renderer, target)
  composer.setPixelRatio(renderer.getPixelRatio())
  composer.addPass(new RenderPass(scene, camera))
  /* Limiar alto: só o que é luz de verdade sangra (motor, disco, núcleo da
     supernova, limbo da atmosfera). Abaixo disso o casco branco virava neve. */
  const bloom = new UnrealBloomPass(new THREE.Vector2(width / 2, height / 2), 0.38, 0.45, 0.92)
  composer.addPass(bloom)
  const film = new ShaderPass(FILM)
  composer.addPass(film)
  return {
    render(time: number) {
      film.uniforms.uTime.value = time
      composer.render()
    },
    setSize(w: number, h: number) {
      composer.setSize(w, h)
      bloom.resolution.set(w / 2, h / 2)
    },
    setStrength(value: number) {
      bloom.strength = value
    },
    dispose() {
      composer.dispose()
      target.dispose()
    },
  }
}
