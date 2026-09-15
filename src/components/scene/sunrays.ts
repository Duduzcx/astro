import * as THREE from 'three'

/**
 * Raios do sol do hero: um leque de riscos finos e macios saindo do clarão,
 * girando devagar, que some junto com ele na decolagem. Um sprite aditivo
 * com uma textura assada uma vez; a rotação lenta é o que faz o clarão
 * parecer luz, e não um adesivo.
 */
const SIZE = 512

function paint() {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const c = SIZE / 2
  ctx.globalCompositeOperation = 'lighter'
  /* Leque com raios de comprimento e largura variados, sem regularidade
     de roda de bicicleta. */
  let angle = 0
  while (angle < Math.PI * 2) {
    const length = c * (0.45 + Math.random() * 0.55)
    const width = 1.5 + Math.random() * 7
    const alpha = 0.16 + Math.random() * 0.3
    ctx.save()
    ctx.translate(c, c)
    ctx.rotate(angle)
    const g = ctx.createLinearGradient(0, 0, length, 0)
    g.addColorStop(0, `rgba(255, 244, 222, ${alpha})`)
    g.addColorStop(0.35, `rgba(200, 216, 255, ${alpha * 0.45})`)
    g.addColorStop(1, 'rgba(160, 190, 255, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(0, -width)
    ctx.lineTo(length, -0.4)
    ctx.lineTo(length, 0.4)
    ctx.lineTo(0, width)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    angle += 0.09 + Math.random() * 0.2
  }
  /* Apaga o miolo (o clarão já cobre) e as pontas. */
  ctx.globalCompositeOperation = 'destination-in'
  const mask = ctx.createRadialGradient(c, c, 0, c, c, c)
  mask.addColorStop(0, 'rgba(0, 0, 0, 0)')
  mask.addColorStop(0.12, 'rgba(0, 0, 0, 1)')
  mask.addColorStop(0.7, 'rgba(0, 0, 0, 1)')
  mask.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = mask
  ctx.fillRect(0, 0, SIZE, SIZE)
  return canvas
}

export function createSunRays(scale: number) {
  const texture = new THREE.CanvasTexture(paint())
  texture.colorSpace = THREE.NoColorSpace
  const material = new THREE.SpriteMaterial({
    map: texture,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    opacity: 0,
  })
  const object = new THREE.Sprite(material)
  object.scale.setScalar(scale)
  object.renderOrder = -6
  return {
    object,
    update(position: THREE.Vector3, strength: number, time: number) {
      /* Depois da decolagem o leque está apagado: não desenha. É um quad
         quase do tamanho da tela, e no celular esse blend custa. */
      object.visible = strength > 0.01
      if (!object.visible) return
      object.position.copy(position)
      material.rotation = time * 0.012
      material.opacity = 0.4 * strength
    },
    dispose() {
      texture.dispose()
      material.dispose()
    },
  }
}
