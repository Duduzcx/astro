import type * as THREE from 'three'

/**
 * Movimento de câmera: a cena nunca fica parada.
 *
 * Duas coisas, as duas pequenas de propósito:
 *
 * 1. Deriva contínua — a câmera translada alguns pixels em senos lentos e
 *    incomensuráveis. Como é translação (não giro), o que está perto se mexe
 *    mais que o que está longe: a Terra no fundo quase não anda, o foguete
 *    anda um pouco, e é essa diferença que dá profundidade.
 *
 * 2. Push-in — o FOV fecha alguns por cento na ignição do foguete e na
 *    explosão do planeta, e reabre em seguida. É o "dolly" de cinema: a
 *    câmera se aproxima do que importa e depois recua.
 *
 * Só o FOV muda; `camera.position.z` fica intacto, então toda a régua de
 * tamanhos (halfWidth, visibleHalfHeight) continua valendo. O push é um
 * zoom óptico por cima da composição, não uma mudança dela.
 */

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)
const smooth = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

export type CameraMotionInput = {
  time: number
  /** Unidades de mundo por pixel CSS no plano z = 0: a deriva é medida em pixels. */
  pixel: number
  /** Empuxo e subida do foguete, já amortecidos. */
  thrust: number
  lift: number
  /** Quanto o planeta-alvo já se despedaçou (0 inteiro, 1 sumiu), só na fase de planeta. */
  explode: number
  /** prefers-reduced-motion: nada se mexe. */
  still: boolean
}

export function createCameraMotion(camera: THREE.PerspectiveCamera) {
  let baseFov = camera.fov

  return {
    /** Chamar sempre que o FOV base for recalculado (redimensionamento). */
    setBaseFov(fov: number) {
      baseFov = fov
    },
    update({ time, pixel, thrust, lift, explode, still }: CameraMotionInput) {
      if (still) {
        camera.position.x = 0
        camera.position.y = 0
        if (camera.fov !== baseFov) {
          camera.fov = baseFov
          camera.updateProjectionMatrix()
        }
        return
      }

      /* Deriva: dois senos por eixo em frequências que não batem, para o
         caminho não se repetir. Amplitude total de ~4px no plano do foguete. */
      camera.position.x = (Math.sin(time * 0.21) * 2.6 + Math.sin(time * 0.53) * 1.1) * pixel
      camera.position.y = (Math.cos(time * 0.17) * 2.2 + Math.sin(time * 0.41) * 0.9) * pixel

      /* Ignição: fecha com o empuxo e reabre conforme o foguete sobe. */
      const launchPush = thrust * (1 - clamp01(lift * 1.4))
      /* Explosão: fecha nos primeiros pedaços e reabre com os detritos. */
      const boomPush = smooth(0, 0.35, explode) * (1 - smooth(0.45, 1, explode))
      const push = Math.max(launchPush * 0.07, boomPush * 0.06)

      const fov = baseFov * (1 - push)
      if (Math.abs(camera.fov - fov) > 1e-4) {
        camera.fov = fov
        camera.updateProjectionMatrix()
      }
    },
  }
}
