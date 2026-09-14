import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

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
  return {
    render() {
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
