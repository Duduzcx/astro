import * as THREE from 'three'

/**
 * O ambiente que ilumina os objetos de metal e tinta (o foguete).
 *
 * Metal sem mapa de ambiente é preto: o que desenha um cilindro de aço é o
 * reflexo do mundo em volta dele. O que havia aqui era o `RoomEnvironment`
 * do three — uma sala com luminárias, feita para produto em estúdio. Além
 * de errado para o espaço (o casco refletia uma sala), o prefiltro dela
 * custava 2,2 s de thread principal na carga, e era a maior parte da
 * demora até a cena aparecer.
 *
 * Esta é a mesma ideia com o mundo certo e quase de graça: um equirretangular
 * de 64×32 pintado na CPU — céu preto, o sol como um disco quente de um
 * lado, o azul da Terra subindo por baixo, e um halo frio do outro lado para
 * a sombra não fechar. São 2.048 texels; o prefiltro sai em poucos
 * milissegundos e o reflexo no casco fica coerente com a cena.
 */
export function createSpaceEnvironment(renderer: THREE.WebGLRenderer) {
  const width = 64
  const height = 32
  const data = new Float32Array(width * height * 4)

  /* Direções em espaço de mundo, iguais às luzes de TriScene: sol no alto à
     esquerda e à frente, contorno frio atrás à direita. */
  const sun = new THREE.Vector3(-2, 1.6, 3).normalize()
  const rim = new THREE.Vector3(2.5, 0.5, -2).normalize()
  const direction = new THREE.Vector3()

  for (let y = 0; y < height; y += 1) {
    /* v de 0 (topo) a 1 (base) vira latitude; u vira longitude. */
    const phi = ((y + 0.5) / height) * Math.PI
    for (let x = 0; x < width; x += 1) {
      const theta = ((x + 0.5) / width) * Math.PI * 2
      direction.set(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      )
      /* Fundo: o preto do espaço com um azul muito fraco, para o metal na
         sombra não virar um buraco. */
      let r = 0.012
      let g = 0.016
      let b = 0.028

      /* O sol: um disco pequeno e muito brilhante, com halo. */
      const toSun = Math.max(direction.dot(sun), 0)
      const disc = Math.pow(toSun, 900) * 26
      const halo = Math.pow(toSun, 12) * 0.5
      r += disc + halo * 1.0
      g += disc * 0.95 + halo * 0.86
      b += disc * 0.85 + halo * 0.62

      /* A Terra por baixo: azul forte no hemisfério de baixo, como o
         albedo que ilumina qualquer coisa em órbita baixa. */
      const below = Math.max(-direction.y, 0)
      const earth = Math.pow(below, 1.6) * 0.5
      r += earth * 0.18
      g += earth * 0.42
      b += earth * 0.9

      /* Contorno frio do lado oposto: separa o casco do fundo. */
      const toRim = Math.max(direction.dot(rim), 0)
      const cool = Math.pow(toRim, 3) * 0.08
      r += cool * 0.4
      g += cool * 0.6
      b += cool

      const i = (y * width + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 1
    }
  }

  const source = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType)
  source.mapping = THREE.EquirectangularReflectionMapping
  source.colorSpace = THREE.LinearSRGBColorSpace
  source.needsUpdate = true

  const pmrem = new THREE.PMREMGenerator(renderer)
  const target = pmrem.fromEquirectangular(source)
  pmrem.dispose()
  source.dispose()
  return target
}
