import * as THREE from 'three'

/**
 * Carrega uma textura do jeito do TextureLoader (devolve a textura na hora e
 * avisa quando a imagem chega), mas no Chromium decodifica como ImageBitmap
 * já virado. Com <img>, o three sobe a imagem com UNPACK_FLIP_Y ligado e o
 * Chrome a vira na CPU antes de subir: 300 a 500ms por textura de 4k na
 * thread principal, dois segundos seguidos na abertura do desktop, medidos
 * no perfil. Com o bitmap virado na decodificação (fora da thread) e
 * flipY = false, a subida é uma cópia da GPU.
 *
 * Só no Chromium, que é onde navigator.userAgentData existe: o
 * imageOrientation do createImageBitmap chegou tarde ao Safari e uma versão
 * sem ele entregaria a Terra de cabeça para baixo. O iPhone fica no caminho
 * de sempre, que é o que foi validado.
 */
const bitmapOk =
  typeof window !== 'undefined' && 'userAgentData' in navigator && typeof createImageBitmap === 'function'
const imageLoader = new THREE.TextureLoader()
const bitmapLoader = bitmapOk
  ? new THREE.ImageBitmapLoader().setOptions({
      imageOrientation: 'flipY',
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    })
  : null

export function loadTexture(url: string, onLoad: (texture: THREE.Texture) => void): THREE.Texture {
  if (!bitmapLoader) return imageLoader.load(url, onLoad)
  const texture = new THREE.Texture()
  texture.flipY = false
  bitmapLoader.load(url, (bitmap) => {
    texture.image = bitmap
    texture.needsUpdate = true
    /* O three não fecha o bitmap ao descartar a textura; sem isto o degrau
       leve descartado ficava vivo na memória até o coletor passar. */
    texture.addEventListener('dispose', () => bitmap.close())
    onLoad(texture)
  })
  return texture
}
