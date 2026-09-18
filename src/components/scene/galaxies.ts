import * as THREE from 'three'

/**
 * Galáxias distantes: três manchas com núcleo brilhante presas à esfera do
 * céu, cada uma desenhada uma vez num canvas (uma espiral de frente, uma de
 * perfil com a faixa de poeira, uma elíptica) e mostrada como sprite
 * aditivo. Como são filhas do céu, giram com ele: cada uma entra em cena
 * num trecho da página e sai no seguinte, e é isso que dá a sensação de
 * profundidade sem custo — três draw calls de um quad cada.
 */
type View = { halfWidth: number; halfHeight: number; cameraZ: number }

type Spec = {
  kind: 'spiral' | 'edge' | 'elliptical'
  /** Fração da página em que fica no ponto da tela dado (NDC). */
  at: number
  ndc: [number, number]
  /** Tamanho em mundo, à distância fixa. */
  size: number
  tilt: number
  opacity: number
}

const DISTANCE = 12
/* 512 e não 256. A galáxia é um sprite e chega à tela ampliada: num
   aparelho com razão de pixels alta ela ocupa mais pixels reais do que a
   textura tem, e o que se vê é a interpolação, não o desenho. O custo é
   pintar o canvas uma vez na carga e um megabyte de memória por galáxia. */
const SIZE = 512

const SPECS: Spec[] = [
  /* De frente, alto à direita, na chegada: é a que mais lê no hero. */
  { kind: 'spiral', at: 0.06, ndc: [0.62, 0.55], size: 2.6, tilt: 0.5, opacity: 0.95 },
  /* De perfil no meio da viagem, embaixo à direita. */
  { kind: 'edge', at: 0.4, ndc: [0.55, -0.35], size: 2.8, tilt: -0.45, opacity: 0.9 },
  /* Elíptica pequena mais para o fim, alta e ao centro. */
  { kind: 'elliptical', at: 0.74, ndc: [0.15, 0.6], size: 1.7, tilt: 0.9, opacity: 0.8 },
]

function paint(kind: Spec['kind']) {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const c = SIZE / 2
  ctx.globalCompositeOperation = 'lighter'
  const glow = (x: number, y: number, r: number, rgb: string, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${rgb}, ${a})`)
    g.addColorStop(0.5, `rgba(${rgb}, ${a * 0.35})`)
    g.addColorStop(1, `rgba(${rgb}, 0)`)
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  if (kind === 'spiral') {
    /* Disco achatado e dois braços em espiral logarítmica, feitos de
       muitas bolhas macias, com nós rosados (regiões de formação de
       estrelas) e um bojo quente no centro. */
    ctx.save()
    ctx.translate(c, c)
    ctx.scale(1, 0.72)
    glow(0, 0, 96, '150, 180, 255', 0.16)
    for (let arm = 0; arm < 2; arm += 1) {
      for (let i = 0; i < 70; i += 1) {
        const t = (i / 70) * Math.PI * 2.6
        const r = 10 + 8 * Math.exp(0.32 * t)
        if (r > 108) break
        const a = t + arm * Math.PI
        const x = Math.cos(a) * r + (Math.random() - 0.5) * 8
        const y = Math.sin(a) * r + (Math.random() - 0.5) * 8
        const fade = 1 - r / 118
        glow(x, y, 7 + Math.random() * 9, '170, 200, 255', 0.07 * fade)
        if (i % 9 === 4) glow(x, y, 4, '255, 180, 220', 0.16 * fade)
      }
    }
    ctx.restore()
    glow(c, c, 30, '255, 236, 210', 0.55)
    glow(c, c, 9, '255, 250, 240', 1)
  } else if (kind === 'edge') {
    /* Vista de perfil: um fuso largo com bojo, cortado por uma faixa de
       poeira levemente abaixo do eixo. */
    ctx.save()
    ctx.translate(c, c)
    ctx.scale(1, 0.17)
    glow(0, 0, 118, '160, 190, 255', 0.5)
    glow(0, 0, 70, '210, 220, 255', 0.5)
    ctx.restore()
    ctx.save()
    ctx.translate(c, c)
    ctx.scale(1, 0.55)
    glow(0, 0, 40, '255, 232, 200', 0.6)
    ctx.restore()
    glow(c, c, 8, '255, 250, 240', 1)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.save()
    ctx.translate(c, c + 3)
    ctx.scale(1, 0.05)
    glow(0, 0, 110, '0, 0, 0', 0.85)
    ctx.restore()
  } else {
    /* Elíptica: só um gradiente alongado, mais quente no núcleo. */
    ctx.save()
    ctx.translate(c, c)
    ctx.scale(1, 0.62)
    glow(0, 0, 110, '190, 200, 255', 0.22)
    glow(0, 0, 60, '235, 225, 240', 0.4)
    ctx.restore()
    glow(c, c, 14, '255, 244, 225', 0.9)
  }
  return canvas
}

export function createGalaxies(view: View, rotationAt: (progress: number) => THREE.Euler) {
  const object = new THREE.Group()
  const textures: THREE.Texture[] = []
  const materials: THREE.SpriteMaterial[] = []
  const tilts: number[] = []
  const baseOpacity: number[] = []
  const camera = new THREE.Vector3(0, 0, view.cameraZ)
  const world = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()

  for (const spec of SPECS) {
    const texture = new THREE.CanvasTexture(paint(spec.kind))
    texture.colorSpace = THREE.NoColorSpace
    /* Com níveis e filtragem anisotrópica: a galáxia é vista inclinada e
       encolhe muito ao longo da página, e sem isso a espiral vira chuvisco
       quando ela fica pequena. */
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 4
    textures.push(texture)
    const material = new THREE.SpriteMaterial({
      map: texture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      opacity: spec.opacity,
      rotation: spec.tilt,
    })
    materials.push(material)
    tilts.push(spec.tilt)
    baseOpacity.push(spec.opacity)
    const sprite = new THREE.Sprite(material)
    sprite.scale.setScalar(spec.size)
    sprite.renderOrder = -19
    /* Da tela para o mundo: a direção do ponto NDC a partir da câmera,
       à distância fixa; do mundo para o céu: desfaz o giro que o céu tem
       naquela fração da página. */
    world
      .set(spec.ndc[0] * view.halfWidth, spec.ndc[1] * view.halfHeight, -view.cameraZ)
      .normalize()
      .multiplyScalar(DISTANCE)
      .add(camera)
    quaternion.setFromEuler(rotationAt(spec.at)).invert()
    sprite.position.copy(world.applyQuaternion(quaternion))
    object.add(sprite)
  }

  return {
    object,
    update(time: number) {
      /* Giram devagar, cada uma para um lado: dois minutos por grau, o
         bastante para nunca estarem paradas quando a página para. */
      for (let i = 0; i < materials.length; i += 1) {
        materials[i].rotation = tilts[i] + time * 0.009 * (i % 2 ? -1 : 1)
        /* Respiração de brilho, cada uma no seu período: o céu deixa de ser
           um cenário pintado e passa a ter algo acontecendo nele. */
        materials[i].opacity = baseOpacity[i] * (0.86 + 0.14 * Math.sin(time * (0.11 + i * 0.037) + i))
      }
    },
    dispose() {
      for (const texture of textures) texture.dispose()
      for (const material of materials) material.dispose()
    },
  }
}
