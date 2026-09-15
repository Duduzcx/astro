import * as THREE from 'three'

/**
 * Um punhado de estrelas brilhantes: as poucas que numa foto de longa
 * exposição ganham halo colorido e espículas de difração compridas. São
 * sprites (um quad cada), porque o tamanho que elas precisam passa do
 * limite de gl_PointSize de muita GPU de celular. Três temperaturas de
 * cor, cada uma assada uma vez num canvas; o núcleo fica branco em todas.
 * Descem com o scroll na mesma régua do campo de estrelas e dão a volta.
 *
 * A distribuição é estratificada, não sorteada: cada estrela ganha uma
 * faixa de altura e uma faixa de largura (em fração da tela, não em
 * mundo), e só o jitter é aleatório. Sorteio puro empilha duas ou três na
 * mesma coluna e a página inteira parece ter uma só estrela repetida.
 */
export type BrightStarsState = { progress: number; opacity: number }

const SPREAD_Y = 3.5
const WRAP = SPREAD_Y * 2
const SIZE = 256

/* Halo: azul-branca, marfim quente, dourada. */
const TONES: Array<[string, string]> = [
  ['150, 190, 255', '200, 220, 255'],
  ['255, 225, 190', '255, 240, 220'],
  ['255, 200, 140', '255, 225, 180'],
]

/* Tamanhos em mundo, do gigante ao discreto: uma protagonista, duas ou
   três médias e o resto pequeno, para o céu ter hierarquia. */
const SIZES = [1.35, 0.6, 0.95, 0.5, 1.1, 0.55, 0.8, 0.65]

function paint(halo: string, spike: string) {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const c = SIZE / 2
  ctx.globalCompositeOperation = 'lighter'
  /* Halo colorido, largo e fraco; núcleo branco e pequeno. */
  const g = ctx.createRadialGradient(c, c, 0, c, c, c)
  g.addColorStop(0, 'rgba(255, 255, 255, 1)')
  g.addColorStop(0.035, 'rgba(255, 255, 255, 0.85)')
  g.addColorStop(0.09, `rgba(${halo}, 0.4)`)
  g.addColorStop(0.24, `rgba(${halo}, 0.1)`)
  g.addColorStop(0.5, `rgba(${halo}, 0.025)`)
  g.addColorStop(1, `rgba(${halo}, 0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, SIZE, SIZE)
  /* Espículas: quatro traços finos até a borda, com um brilho mais largo
     por baixo, e duas diagonais curtas e fracas. */
  const ray = (angle: number, length: number, width: number, alpha: number) => {
    ctx.save()
    ctx.translate(c, c)
    ctx.rotate(angle)
    const lg = ctx.createLinearGradient(0, 0, length, 0)
    lg.addColorStop(0, `rgba(${spike}, ${alpha})`)
    lg.addColorStop(0.25, `rgba(${spike}, ${alpha * 0.55})`)
    lg.addColorStop(1, `rgba(${spike}, 0)`)
    ctx.fillStyle = lg
    ctx.beginPath()
    ctx.moveTo(0, -width)
    ctx.lineTo(length, -0.3)
    ctx.lineTo(length, 0.3)
    ctx.lineTo(0, width)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  for (let i = 0; i < 4; i += 1) {
    const a = (i * Math.PI) / 2
    ray(a, c, 3.5, 0.28)
    ray(a, c * 0.95, 1.1, 0.9)
  }
  for (let i = 0; i < 4; i += 1) {
    ray(Math.PI / 4 + (i * Math.PI) / 2, c * 0.42, 0.9, 0.4)
  }
  return canvas
}

export type BrightStarsOptions = {
  /** Em tela larga o texto mora à esquerda: as brilhantes ficam à direita. */
  rightBias?: boolean
  /** A vista, para colocar cada estrela por fração da largura da tela. */
  view?: { halfWidth: number; cameraZ: number }
}

export function createBrightStars(count: number, options: BrightStarsOptions = {}) {
  const object = new THREE.Group()
  const textures = TONES.map(([halo, spike]) => {
    const texture = new THREE.CanvasTexture(paint(halo, spike))
    texture.colorSpace = THREE.NoColorSpace
    return texture
  })
  const stars: Array<{
    sprite: THREE.Sprite
    material: THREE.SpriteMaterial
    y: number
    size: number
    seed: number
    weight: number
  }> = []
  /* Faixas de largura, em fração da tela (-1 a 1): à direita do texto no
     desktop, a tela toda no celular. As estrelas percorrem as faixas numa
     ordem embaralhada fixa, para vizinhas na altura não serem vizinhas na
     largura. */
  const [xMin, xMax] = options.rightBias ? [0.08, 0.96] : [-0.88, 0.88]
  const order = [0, 3, 1, 4, 2, 5, 6, 7]
  const bands = Math.min(count, order.length)
  const halfWidth = options.view?.halfWidth ?? 4
  const cameraZ = options.view?.cameraZ ?? 6
  for (let i = 0; i < count; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: textures[(i * 2 + 1) % TONES.length],
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    })
    const sprite = new THREE.Sprite(material)
    const z = -2 - Math.random() * 1.6
    const band = order[i % order.length] % bands
    const fx = xMin + ((band + 0.15 + Math.random() * 0.7) / bands) * (xMax - xMin)
    /* Da fração da tela para o mundo, nessa profundidade. */
    const x = fx * halfWidth * ((cameraZ - z) / cameraZ)
    sprite.position.set(x, 0, z)
    sprite.renderOrder = -8
    const size = SIZES[i % SIZES.length] * (0.9 + Math.random() * 0.2)
    stars.push({
      sprite,
      material,
      y: (i + 0.2 + Math.random() * 0.6) * (WRAP / count) - SPREAD_Y,
      size,
      seed: Math.random() * 10,
      weight: 0.7 + Math.random() * 0.3,
    })
    object.add(sprite)
  }

  return {
    object,
    update(state: BrightStarsState, time: number) {
      const offset = state.progress * 3.0
      for (const star of stars) {
        /* Mesma descida e volta do campo de estrelas. */
        const y = ((((star.y - offset + SPREAD_Y) % WRAP) + WRAP) % WRAP) - SPREAD_Y
        star.sprite.position.y = y
        /* Cintila devagar: o brilho respira e a cruz cresce um pouco junto. */
        const twinkle = 0.82 + 0.18 * Math.sin(time * (0.5 + star.seed * 0.08) + star.seed)
        star.material.opacity = state.opacity * star.weight * twinkle
        star.sprite.scale.setScalar(star.size * (0.94 + 0.06 * twinkle))
      }
    },
    dispose() {
      for (const star of stars) star.material.dispose()
      for (const texture of textures) texture.dispose()
    },
  }
}
