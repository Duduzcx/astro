import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  KEYFRAMES,
  MOBILE_BREAKPOINT,
  holePresence,
  mobileKeyframes,
  novaPresence,
  planetBreak,
  rocketWindow,
  sampleKeyframes,
  takeoffSpan,
} from './keyframes'
import { buildTriangles, makeMaterial } from './triangles'
import { createStars } from './stars'
import { createRocket } from './rocket'
import { createPlanet } from './planet'
import { createSun } from './sun'
import { createExplosion } from './explosion'
import { createBlackHole } from './blackhole'
import { createNova } from './nova'
import { createSatellites } from './satellites'
import { createSpace } from './space'
import { createPostFx } from './postfx'
import { createTrail } from './trail'
import { createMeteors } from './meteors'
import { createBrightStars } from './brightstars'
import { createSunRays } from './sunrays'
import { createCameraMotion } from './cameraMotion'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * Núcleo orbital: uma bola densa de triângulos vazados com três anéis
 * inclinados girando em velocidades diferentes. No scroll ele se espalha e
 * depois volta a se juntar. É um canvas fixo atrás do documento inteiro; cada
 * seção é um estado dessa mesma cena.
 */

/**
 * Faixa que o texto do hero ocupa, em NDC: [centro, raio]. `offsetTop` ignora o
 * transform de parallax do hero, que é o que queremos. Sem o elemento, assume
 * uma dobra típica de celular.
 */
function heroCopyBand(): [number, number] {
  const copy = document.getElementById('hero-copy')
  if (!copy) return [-0.35, 0.55]
  let node: HTMLElement | null = copy
  let top = 0
  while (node) {
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  const viewport = window.innerHeight
  const start = top / viewport
  const end = (top + copy.offsetHeight) / viewport
  /* Fração da tela (0 no topo) para NDC (1 no topo), com folga de 18%. */
  return [1 - (start + end), (end - start) * 1.18]
}

export function TriScene() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    /* Mesma cena em todo lugar, dimensionada pelo hardware: celular e máquina
       fraca recebem menos triângulos e menos pixels para preencher. */
    const cores = navigator.hardwareConcurrency ?? 8
    const weakDevice = cores <= 4
    const lightweight = window.innerWidth < 1024

    const renderer = new THREE.WebGLRenderer({
      antialias: !weakDevice,
      alpha: true,
      powerPreference: 'high-performance',
    })
    /* Celular a 1,5 de razão de pixels: a 1,0 a cena era esticada quase
       três vezes e virava desenho borrado. A taxa de 30fps segura o custo. */
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, weakDevice ? 1.25 : lightweight ? 1.5 : 1.25),
    )
    /* Tone mapping de filme para os materiais iluminados (o foguete): sem
       isso o metal estoura em branco. Os shaders próprios ignoram. */
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    /**
     * O palco tem a altura da MAIOR tela já vista, e só cresce.
     *
     * A barra de URL do celular recolhe e volta o tempo todo durante o scroll.
     * Qualquer coisa amarrada a `innerHeight` — projeção da câmera, tamanho do
     * buffer, `maxScroll` — muda junto, e o objeto pula de tamanho de um frame
     * para o outro. Congelando a altura do palco, a barra some e a tela apenas
     * revela mais de um canvas que já estava desenhado ali. Nada reprojetá.
     */
    /**
     * A altura inicial do palco vem de `100lvh` — o viewport GRANDE, com a
     * barra de URL já recolhida. Assim o palco nasce no tamanho máximo e a
     * barra recolhendo nunca o faz crescer; sem crescimento, sem reprojeção.
     * Onde `lvh` não existe, cai para `innerHeight`.
     */
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100lvh;pointer-events:none;visibility:hidden'
    document.body.appendChild(probe)
    const large = probe.offsetHeight
    /* E a menor: com a barra de URL à vista. A diferença entre as duas é
       exatamente o quanto o palco passa da tela no celular. */
    probe.style.height = '100svh'
    const small = probe.offsetHeight || large
    probe.remove()
    let stageHeight = Math.max(window.innerHeight, large || 0)
    renderer.setSize(window.innerWidth, stageHeight, false)
    mount.style.height = `${stageHeight}px`
    /* O canvas se estica com o container, então nem no intervalo entre o
       resize e o próximo frame sobra pedaço de tela sem desenho. */
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    /* Desmontou: as filas de aquecimento param onde estiverem. */
    let disposed = false
    const scene = new THREE.Scene()
    /* Mapa de ambiente gerado uma vez: é o que faz metal parecer metal. Sem
       reflexo, metalness alto é só preto.
       A 256 (o padrão) o prefiltro custava 2,2 s de thread principal na
       carga — era a maior parte da demora até a cena aparecer. A 32 sai em
       poucos milissegundos, e num reflexo borrado de propósito ninguém vê
       diferença. Um ambiente de espaço de verdade (sol, Terra, preto) foi
       testado e recusado: metal só reflete o que existe em volta, e no
       vácuo isso deixa o casco quase preto. A sala mente, mas é ela que faz
       o aço parecer aço. */
    /* E o mapa é gerado DEPOIS da primeira pintura: o custo não está na
       resolução (a 32 ou a 256 dá quase no mesmo), está em compilar os
       shaders do próprio prefiltro, e eram dois segundos travados antes de
       qualquer coisa aparecer. O foguete, único objeto que depende do
       reflexo, só chega depois disso de qualquer forma. */
    let environmentTarget: THREE.WebGLRenderTarget | null = null
    const buildEnvironment = () => {
      if (disposed || environmentTarget) return
      const pmrem = new THREE.PMREMGenerator(renderer)
      environmentTarget = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: 32 })
      scene.environment = environmentTarget.texture
      pmrem.dispose()
    }
    /* Luz de verdade para o foguete: uma direcional vinda de cima à
       esquerda, a mesma direção da luz dos planetas, e uma hemisférica azul
       para o lado da sombra não virar breu. */
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.2)
    sun.position.set(-2, 1.6, 3)
    scene.add(sun)
    /* Luz de contorno azul vinda de trás: separa o casco do fundo. */
    const rimLight = new THREE.DirectionalLight(0x6fa8ff, 0.7)
    rimLight.position.set(2.5, 0.5, -2)
    scene.add(rimLight)
    scene.add(new THREE.HemisphereLight(0x8db4f5, 0x1a2340, 0.5))
    /* Luz de recorte só para o veículo: no hero ele é o assunto, e contra
       uma nebulosa clara o casco de aço sumia. Vem de frente e um pouco de
       cima, na direção da câmera, para acender a face que olha para nós. */
    const key = new THREE.DirectionalLight(0xfff6e8, 1.1)
    key.position.set(0.6, 1.2, 4)
    scene.add(key)
    /* A luz do motor: laranja, presa ao bocal, acende com o empuxo e bate
       na saia e nas aletas. */
    const engineLight = new THREE.PointLight(0xff9a3c, 0, 3.5, 1.6)
    scene.add(engineLight)
    const BASE_FOV = 50
    const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / stageHeight, 0.1, 20)
    camera.position.z = 3.3
    /* Deriva e push-in da câmera: mexe só em x, y e FOV, nunca em z, então a
       régua de tamanhos abaixo continua valendo. */
    const cameraMotion = createCameraMotion(camera)

    /* Meia altura de mundo com o FOV base: constante, é a régua de todas as
       posições e tamanhos das tabelas. A meia largura acompanha a largura da
       tela e só muda quando a LARGURA muda. */
    const halfHeight = Math.tan((BASE_FOV * Math.PI) / 360) * camera.position.z
    let halfWidth = halfHeight * (window.innerWidth / stageHeight)

    /**
     * Se o palco precisar crescer mesmo assim, a projeção mantém a MESMA
     * largura de mundo visível: o FOV vertical é recalculado para que
     * tan(fov/2)·z·aspect continue igual a halfWidth. Pixels por unidade de
     * mundo não mudam, então o objeto não muda de tamanho — a tela só ganha
     * mundo em cima e embaixo.
     */
    /* Declarado antes do sizeStage, que o usa e roda já na montagem. */
    let postfx: ReturnType<typeof createPostFx> | null = null
    /* Quanto os astros sobem para ficarem no meio da TELA, em unidades de
       mundo. Zero quando o palco tem a altura da tela. */
    let astroShiftY = 0
    const sizeStage = () => {
      stageHeight = Math.max(stageHeight, window.innerHeight)
      mount.style.height = `${stageHeight}px`
      renderer.setSize(window.innerWidth, stageHeight, false)
      camera.aspect = window.innerWidth / stageHeight
      camera.fov = (2 * Math.atan(halfWidth / (camera.position.z * camera.aspect)) * 180) / Math.PI
      camera.updateProjectionMatrix()
      cameraMotion.setBaseFov(camera.fov)
      /* O palco é mais alto que a tela no celular (100lvh contra 100svh),
         e ele é ancorado no topo: um objeto em y = 0 cai no meio do PALCO,
         que fica abaixo do meio da TELA. Quem precisa estar centrado para
         o visitante (Sol, buraco negro, supernova) sobe essa diferença.
         Medido em espaço de tela, não movendo a câmera: a câmera é a régua
         de todo o resto da cena, e mexer nela desenquadraria o horizonte da
         Terra e a plataforma do foguete, que foram ajustados contra ela.
         Onde palco e tela têm a mesma altura (desktop), isto é zero. */
      const visible = Math.min(small, stageHeight)
      astroShiftY = ((stageHeight - visible) / stageHeight) * (halfWidth / camera.aspect)
      postfx?.setSize(window.innerWidth, stageHeight)
    }
    sizeStage()

    const spread = new THREE.Vector3(2.6, 1.7, 1.2)
    const sphereGeometry = buildTriangles(
      /* Menos triângulos no celular: o campo é grão de fundo, e o que
         paga a conta é o brilho dos astros. */
      weakDevice ? 1600 : lightweight ? 1800 : 5600,
      spread,
      true,
    )
    const sphereMaterial = makeMaterial(0.95)
    const sphereField = new THREE.LineSegments(sphereGeometry, sphereMaterial)
    scene.add(sphereField)

    /* Camada ambiente, sempre dispersa: os triângulos fracos flutuando em volta. */
    const ambientGeometry = buildTriangles(
      lightweight ? 120 : 420,
      new THREE.Vector3(3.2, 2.1, 1.6),
      false,
    )
    const ambientMaterial = makeMaterial(0.32)
    ambientMaterial.uniforms.uMix.value = 1
    const ambientField = new THREE.LineSegments(ambientGeometry, ambientMaterial)
    scene.add(ambientField)

    /* Texturas em degraus: 1k primeiro, e o degrau pesado substitui. No
       celular o pesado é 2k; no desktop, 4k. Quatro mil por dois mil em RGB
       com mipmaps são 32 MB de GPU por textura, e o celular não tem isso
       sobrando. */
    /* No celular só a Terra do hero passa de 1k: cada upload de textura
       trava o thread principal por dezenas de milissegundos, e isso vira
       tranco no scroll. */
    const tier = (name: string, ext = 'webp', desktopHigh = '2k') => ({
      low: `/space/${name}-1k.${ext}`,
      high: `/space/${name}-${lightweight ? '2k' : desktopHigh}.${ext}`,
    })
    /* Sem degrau de 8k: subir uma textura dessas para a GPU (8192×4096 com
       mipmaps, ~180 MB) trava o thread principal por quase dois segundos, e
       num planeta que ocupa 600px de tela não há um texel a mais para ver.
       4k é o teto útil aqui. */
    /* Sobe a textura para a GPU assim que chega, fora do caminho do scroll. */
    /* Subir textura para a GPU é síncrono e caro (uma de 4k com mipmaps
       são 45 MB e dezenas de milissegundos). Chegando várias juntas, o
       thread principal sumia por segundos e a página ficava parada — era a
       demora que o cliente via ao entrar. Aqui elas entram numa fila e sobem
       uma por frame, entre um desenho e outro. */
    const warmQueueTextures: THREE.Texture[] = []
    const warm = (texture: THREE.Texture) => warmQueueTextures.push(texture)

    /* O espaço: panorama da Via Láctea atrás de tudo, com as nebulosas
       assadas numa textura (menor no celular) e as galáxias distantes. */
    const space = createSpace(tier('milky-way', 'webp', '2k'), lightweight || weakDevice ? 0.62 : 0.8, warm, {
      renderer,
      bakeSize: lightweight || weakDevice ? [1024, 512] : [1536, 768],
      view: { halfWidth, halfHeight, cameraZ: camera.position.z },
    })
    scene.add(space.object)

    /* O sol do hero: um clarão macio no alto à esquerda, na direção da luz,
       que some com a decolagem. */
    const glareCanvas = document.createElement('canvas')
    glareCanvas.width = 256
    glareCanvas.height = 256
    const glareCtx = glareCanvas.getContext('2d')
    if (glareCtx) {
      const g = glareCtx.createRadialGradient(128, 128, 0, 128, 128, 128)
      g.addColorStop(0, 'rgba(255, 246, 225, 0.9)')
      g.addColorStop(0.12, 'rgba(255, 236, 200, 0.5)')
      g.addColorStop(0.4, 'rgba(180, 200, 255, 0.12)')
      g.addColorStop(1, 'rgba(120, 160, 255, 0)')
      glareCtx.fillStyle = g
      glareCtx.fillRect(0, 0, 256, 256)
    }
    const glareTexture = new THREE.CanvasTexture(glareCanvas)
    const glareMaterial = new THREE.SpriteMaterial({
      map: glareTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0,
    })
    const glare = new THREE.Sprite(glareMaterial)
    glare.scale.setScalar(lightweight ? 2.1 : 3.2)
    glare.renderOrder = -5
    scene.add(glare)
    /* Estria anamórfica: a linha horizontal de luz que toda lente de cinema
       faz numa fonte forte. */
    const streakMaterial = glareMaterial.clone()
    const streak = new THREE.Sprite(streakMaterial)
    streak.scale.set(9, 0.32, 1)
    streak.renderOrder = -5
    scene.add(streak)
    /* Raios do sol, girando devagar atrás do clarão; menor no celular,
       onde um leque largo viraria um quad da tela inteira. */
    const sunRays = createSunRays(lightweight ? 3.8 : 5.4)
    scene.add(sunRays.object)

    /* Bloom só no desktop com máquina razoável, e só depois que a cena já
       está na tela: a cadeia do bloom são uma dúzia de programas para
       compilar, e nenhum deles precisa existir no primeiro frame. */
    /* O bloom vale no celular: é a maior diferença de qualidade por
       milissegundo da cena inteira, e é ele que faz o Sol, o motor e o
       disco de acreção brilharem. Medindo um iPhone com processador de
       aparelho mediano, o custo do quadro estava no DOM animado, não
       aqui: ligar o bloom custou cerca de um milissegundo. */
    const wantsPostFx = !weakDevice
    let postFxFrames = 0
    let downgradedPostFx = false

    /* Estrelas ao fundo, a página inteira. No celular são menos pontos: a
       camada densa assada na nebulosa (space.ts) já dá a profundidade. */
    /* Menos estrelas no celular: numa tela de mão o mesmo número vira
       chuvisco, e o que precisa aparecer é o astro da vez. */
    const stars = createStars(lightweight ? 900 : 3600, renderer.getPixelRatio())
    scene.add(stars.object)
    /* Umas poucas brilhantes de verdade, com halo e espículas. */
    const brightStars = createBrightStars(lightweight ? 3 : 8, {
      rightBias: !lightweight,
      view: { halfWidth, cameraZ: camera.position.z },
    })
    scene.add(brightStars.object)
    /* Meteoros de vez em quando: o detalhe que faz o céu parecer vivo. */
    const meteors = createMeteors(lightweight ? 1 : 3, renderer.getPixelRatio())
    scene.add(meteors.object)

    /* Foguete: altura em mundo pela largura da tela. No celular ele é menor e
       fica no canto inferior direito, abaixo do texto do hero; atrás dos
       botões ele confundia a leitura. */
    /* Esbelto (o modelo tem quase catorze diâmetros de altura), então pode
       ser mais alto sem ocupar largura. */
    const rocketHeight = lightweight ? Math.min(1.35, halfWidth * 1.7) : Math.min(2.6, halfWidth * 1.3)
    /* O modelo do foguete compila os programas e sobe geometria e texturas
       antes de entrar na cena: o primeiro frame dele não pode ser um
       tranco. O desenho num alvo de 2×2, com as luzes da cena (mesmo
       programa), é o que faz a GPU receber os buffers agora. */
    const warmTarget = new THREE.WebGLRenderTarget(2, 2)
    const warmRocket = async (object: THREE.Object3D) => {
      await renderer.compileAsync(object, camera, scene)
      /* Só o foguete é desenhado neste frame de aquecimento: com a cena
         inteira visível, este render forçava a compilação de todos os
         outros astros de uma vez e travava a carga por segundos. */
      const wasVisible = scene.children.map((child) => child.visible)
      for (const child of scene.children) child.visible = false
      scene.add(object)
      object.visible = true
      renderer.setRenderTarget(warmTarget)
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      scene.remove(object)
      scene.children.forEach((child, index) => {
        child.visible = wasVisible[index] ?? child.visible
      })
    }
    const rocket = createRocket({ height: rocketHeight, lightweight, warm: warmRocket })
    rocket.setPixelRatio(renderer.getPixelRatio())
    scene.add(rocket.object)

    /* O alvo é o Sol: mora no mesmo centro e escala do campo de triângulos
       e explode em supernova na Missão; os destroços são outro módulo,
       tocado pelo mesmo relógio. */
    const star = createSun({
      segments: lightweight ? 64 : 112,
      lightweight: lightweight || weakDevice,
    })
    scene.add(star.object)
    const explosion = createExplosion({ lightweight, weakDevice, pixelRatio: renderer.getPixelRatio() })
    scene.add(explosion.object)

    /* A Terra do hero: enorme e longe. Perto da câmera uma esfera desse
       tamanho passaria pela lente; a EARTH_DEPTH ela cabe inteira atrás do
       foguete e o horizonte curva na medida. Tamanho e posição aparentes
       (no plano z = 0) viram tamanho e posição reais por perspectiva. */
    const EARTH_DEPTH = 9.9
    const depthScale = (camera.position.z + EARTH_DEPTH) / camera.position.z
    const earth = createPlanet({
      segments: lightweight ? 112 : 128,
      warm,
      kind: 'earth',
      spin: 0.012,
      maps: {
        map: tier('earth-day', 'webp', '4k'),
        night: tier('earth-night', 'webp', '2k'),
        clouds: tier('earth-clouds', 'webp', '2k'),
        /* Relevo e máscara de água também no celular: são duas amostras a
           mais por pixel, e é o que tira a Terra do ar de adesivo. */
        normal: tier('earth-normal', 'webp', '2k'),
        specular: { low: '/space/earth-specular-1k.webp', high: '/space/earth-specular-2k.webp' },
      },
    })
    /* De pé o que a tela mostra é a calota polar, toda branca. Deitada, o
       horizonte é o equador: oceano, continentes, e o giro leva os
       continentes ao longo do arco. */
    earth.object.rotation.x = Math.PI / 2
    scene.add(earth.object)
    const satellites = createSatellites(lightweight ? 14 : 24, 0.62 * 1.07, renderer.getPixelRatio())
    earth.object.add(satellites.object)
    /* O desfile: três mundos passando em profundidades diferentes durante
       a viagem, entrando por cima e saindo por baixo, cada um na sua janela
       de progresso. Meio cortados nas bordas, para não brigar com os cards. */
    const depthAt = (z: number) => (camera.position.z - z) / camera.position.z
    type World = {
      planet: ReturnType<typeof createPlanet>
      x: number
      z: number
      size: number
      from: number
      to: number
    }
    const worlds: World[] = [
      {
        planet: createPlanet({
          segments: lightweight ? 72 : 112,
          kind: 'gas',
          spin: 0.03,
          ring: true,
          maps: {
            map: tier('saturn', 'webp'),
            ring: { low: '/space/saturn-ring-2k.webp', high: '/space/saturn-ring-2k.webp' },
          },
          warm,
        }),
        x: -0.95,
        z: -3.0,
        size: 1.9,
        from: 0.05,
        to: 0.15,
      },
      {
        planet: createPlanet({
          segments: lightweight ? 56 : 80,
          kind: 'rock',
          spin: 0.09,
          maps: { map: tier('mars', 'webp') },
          warm,
        }),
        /* Maior e um pouco mais para dentro: pequeno demais o relevo não
           lia e o planeta virava uma bolinha de maquete. */
        x: 0.88,
        z: -0.5,
        size: 0.72,
        from: 0.095,
        to: 0.185,
      },
      {
        planet: createPlanet({
          segments: lightweight ? 72 : 112,
          kind: 'gas',
          spin: 0.035,
          maps: { map: tier('jupiter', 'webp') },
          warm,
        }),
        x: 0.75,
        z: -5.5,
        size: 2.6,
        from: 0.14,
        to: 0.25,
      },
      {
        planet: createPlanet({
          segments: lightweight ? 56 : 80,
          kind: 'ice',
          spin: 0.05,
          maps: { map: tier('moon', 'webp') },
          tint: '#c4d6f2',
          warm,
        }),
        x: -0.5,
        z: -1.4,
        size: 0.5,
        from: 0.185,
        to: 0.265,
      },
    ]
    for (const world of worlds) scene.add(world.planet.object)
    /* No celular a viagem é mais curta em fração da página. */
    const worldWindow = (world: World) =>
      narrow
        ? { from: world.from * 0.82, to: world.to * 0.82 }
        : { from: world.from, to: world.to }

    /* O foguete em cruzeiro: pequeno, atravessando o desfile com a chama
       viva, e sumindo quando o planeta-alvo chega. */
    const cruiser = createRocket({ height: rocketHeight * 0.5, lightweight, cruise: true, warm: warmRocket })
    scene.add(cruiser.object)
    /* Rastros: o do lançamento e o do cruzeiro, cada um seguindo a sua
       própria trajetória. */
    const trail = createTrail({ segments: lightweight ? 18 : 40, seed: 1 })
    scene.add(trail.object)
    const cruiseTrail = createTrail({ segments: lightweight ? 14 : 32, seed: 5 })
    scene.add(cruiseTrail.object)
    const nozzlePoint = new THREE.Vector3()
    /* A nave em cruzeiro entra logo que o lançamento sai de cena e cruza
       o desfile inteiro: antes havia um vão entre o foguete sumir e ela
       aparecer, e a página ficava sem assunto bem na virada. */
    const cruiseWindow = () => (narrow ? { from: 0.02, to: 0.24 } : { from: 0.03, to: 0.28 })

    const earthApparent = () => ({
      radius: narrow ? 2.0 : Math.max(2.4, halfWidth * 1.1),
      /* Quanto do planeta sobe acima da borda: pouco, para os botões do
         hero ficarem sobre o céu, não sobre o oceano. */
      reveal: narrow ? 0.34 : 0.5,
    })

    const blackHole = createBlackHole({ segments: lightweight ? 72 : 112, lightweight })
    scene.add(blackHole.object)

    const nova = createNova()
    scene.add(nova.object)
    /* A supernova esquenta a interface: --nova no :root. Cada escrita é um
       recálculo de estilo do documento, então só quando muda de verdade e no
       máximo a cada 80ms. */
    let novaCss = -1
    let novaCssAt = 0

    /* A altura da página fica em cache: ler scrollHeight dentro do loop força
       um layout a cada frame, que era o que travava o scroll em máquina lenta.
       Só recalcula quando o documento muda de verdade. */
    let maxScroll = 1
    /* Medido contra a altura do palco, não contra `innerHeight`: assim o
       progresso não se mexe quando a barra de URL entra e sai — era isso que
       fazia a supernova oscilar de tamanho no fim da página. */
    const measureScroll = () => {
      maxScroll = Math.max(document.documentElement.scrollHeight - stageHeight, 1)
    }
    measureScroll()

    let mobileTable = mobileKeyframes(halfWidth, halfHeight, maxScroll, stageHeight)
    let takeoff = takeoffSpan(stageHeight / maxScroll)
    let narrow = window.innerWidth < MOBILE_BREAKPOINT
    /* A intensidade da clareira é por frame (ela apaga depois do hero, para o
       buraco negro e a supernova aparecerem inteiros); aqui só a faixa. */
    const applyClear = () => {
      const band = heroCopyBand()
      for (const material of [sphereMaterial, ambientMaterial]) {
        material.uniforms.uClearBand.value.set(band[0], band[1])
      }
    }
    /* O estado nasce já na tabela: começando de um chute, o amortecimento
       levava um segundo para chegar lá e o planeta-alvo aparecia no hero e
       sumia, ao carregar. */
    const first = sampleKeyframes(
      narrow ? mobileTable : KEYFRAMES,
      window.scrollY / maxScroll,
    )
    const current = { ...first, lift: 0, thrust: 0 }
    const pointer = { x: 0, y: 0 }
    const visibleHalfHeightNow = () => halfWidth / camera.aspect
    const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    /**
     * Browser de celular dispara resize quando a barra de URL recolhe no meio
     * do scroll, e as duas metades disso precisam de tratamento diferente.
     *
     * O buffer SEMPRE acompanha a viewport: a altura cresce ~60px quando a
     * barra some, e um canvas do tamanho antigo deixa uma faixa sem desenho no
     * pé da tela — era isso que aparecia como uma tira escura ao rolar.
     *
     * Já a remedição de scroll fica atrás da guarda de 180px: `maxScroll`
     * depende de `innerHeight`, então recalcular no recolher da barra move o
     * progresso e o objeto pula na tela. Isso só na mudança real de largura.
     */
    /**
     * Só a LARGURA refaz a cena. Mudança de altura sozinha é a barra de URL
     * indo e voltando: o palco cresce se precisar e nada mais se mexe, então
     * não existe salto de tamanho possível.
     */
    let lastWidth = window.innerWidth
    const onResize = () => {
      const width = window.innerWidth
      if (width === lastWidth) {
        if (window.innerHeight > stageHeight) sizeStage()
        return
      }
      lastWidth = width
      /* Girou o aparelho ou redimensionou a janela: o palco volta a valer a
         tela atual, em vez de guardar a altura da orientação anterior. */
      stageHeight = window.innerHeight
      /* Largura nova: a meia largura de mundo é refeita com o FOV base, e o
         sizeStage a partir daí a preserva. */
      halfWidth = halfHeight * (width / stageHeight)
      sizeStage()
      narrow = width < MOBILE_BREAKPOINT
      measureScroll()
      mobileTable = mobileKeyframes(halfWidth, halfHeight, maxScroll, stageHeight)
      takeoff = takeoffSpan(stageHeight / maxScroll)
      applyClear()
    }
    window.addEventListener('resize', onResize)

    /* O primeiro frame renderizado levanta a opacidade do container, para o canvas não aparecer de supetão. */
    let revealed = false

    /* A tabela do hero depende da altura do texto e da altura da página, que
       mudam quando as fontes carregam e quando o documento cresce. */
    const remeasure = () => {
      measureScroll()
      mobileTable = mobileKeyframes(halfWidth, halfHeight, maxScroll, stageHeight)
      takeoff = takeoffSpan(stageHeight / maxScroll)
      applyClear()
    }
    const pageObserver = new ResizeObserver(remeasure)
    pageObserver.observe(document.body)
    document.fonts?.ready.then(remeasure)

    applyClear()

    let frame = 0
    let previous = performance.now()
    let lastScrollY = window.scrollY
    let rush = 0
    let frameCount = 0

    /* Qualidade adaptativa: mede os primeiros segundos de frames reais e, se a
       máquina não segura a taxa, derruba resolução e camada ambiente uma vez
       só. Seguro barato para notebook velho, que não dá para detectar. */
    let sampled = 0
    let slowFrames = 0
    let downgraded = false
    const considerDowngrade = (delta: number) => {
      if (downgraded || sampled > 150) return
      sampled += 1
      /* Só conta como lento o que é lento de verdade. No celular a régua
         é outra: 33ms é a cadência normal de um aparelho mediano, e com
         o limiar de desktop o rebaixamento disparava sempre — era ele
         que jogava fora o bloom e deixava o Sol e o buraco negro sem
         brilho nenhum. */
      if (delta > (lightweight ? 0.055 : 0.028)) slowFrames += 1
      if (sampled >= 120 && slowFrames > (lightweight ? 80 : 30)) {
        downgraded = true
        renderer.setPixelRatio(1)
        renderer.setSize(window.innerWidth, stageHeight, false)
        ambientField.visible = false
        stars.object.geometry.setDrawRange(
          0,
          Math.floor(stars.object.geometry.getAttribute('position').count / 2),
        )
        rocket.lighten()
        /* A lente é a primeira coisa a cair num aparelho que não segura a
           taxa: o bloom é cinco desfoques por frame. O aparelho perde o
           brilho e ganha fluidez, que é a troca certa quando a régua é o
           deslize. */
        postfx?.dispose()
        postfx = null
        downgradedPostFx = true
      }
    }

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const delta = Math.min((now - previous) / 1000, 0.05)
      previous = now
      considerDowngrade(delta)

      /* Velocidade do scroll vira agitação: sobe rápido no arrasto, decai
         devagar quando o dedo para. Entra no shader como uRush. */
      const scrollNow = window.scrollY
      const speed = Math.abs(scrollNow - lastScrollY) / Math.max(delta, 0.001)
      lastScrollY = scrollNow
      /* Sobe devagar e desce mais devagar ainda: a agitação vira uma maré,
         não um susto. */
      const rushTarget = Math.min(speed / 5200, 1)
      rush += (rushTarget - rush) * (rushTarget > rush ? 0.035 : 0.015)
      const progress = scrollNow / maxScroll
      /* Abaixo do breakpoint roda a tabela presa ao hero, não a de página inteira. */
      const target = sampleKeyframes(narrow ? mobileTable : KEYFRAMES, progress)
      const launch = rocketWindow(progress, takeoff)

      /* Constante de tempo maior no celular: o scroll por toque chega em
         saltos, e amortecer mais tira o solavanco de cada salto. */
      /* No celular o scroll por toque chega em saltos grandes; amortecer
         mais transforma cada salto em movimento contínuo. */
      const damping = reducedMotion ? 1 : 1 - Math.exp(-delta * (narrow ? 2.4 : 4.5))
      current.mix += (target.mix - current.mix) * damping
      current.x += (target.x - current.x) * damping
      current.y += (target.y - current.y) * damping
      current.scale += (target.scale - current.scale) * damping
      current.opacity += (target.opacity - current.opacity) * damping
      current.form += (target.form - current.form) * damping
      /* O foguete também amortece: o scroll por toque chega em saltos. */
      current.lift += (launch.lift - current.lift) * damping
      current.thrust += (launch.thrust - current.thrust) * damping
      /* Tremor de câmera proporcional ao empuxo, some com o foguete. É
         vibração (senos rápidos que não batem), não ruído por frame: o
         ruído puro fazia o foguete pular de posição a 60Hz e lia como bug. */
      const shake = current.thrust * Math.max(0, 1 - current.lift * 1.5) * 0.012
      const shakeX = (Math.sin(now * 0.041) * 0.6 + Math.sin(now * 0.097) * 0.4) * shake
      const shakeY = (Math.cos(now * 0.053) * 0.6 + Math.sin(now * 0.083) * 0.4) * shake

      /* A clareira só existe enquanto o hero está na tela: dali para baixo os
         outros astros aparecem inteiros, sem o miolo apagado. */
      const heroClear = narrow
        ? Math.min(Math.max(1 - window.scrollY / (stageHeight * 0.9), 0), 1)
        : 0
      sphereMaterial.uniforms.uClear.value = heroClear
      ambientMaterial.uniforms.uClear.value = heroClear

      const time = reducedMotion ? 0 : now / 1000
      sphereMaterial.uniforms.uTime.value = time
      sphereMaterial.uniforms.uForm.value = current.form
      ambientMaterial.uniforms.uForm.value = current.form
      sphereMaterial.uniforms.uRush.value = rush
      ambientMaterial.uniforms.uRush.value = rush
      /* O objeto afrouxa um pouco enquanto agitado e volta a fechar depois. */
      sphereMaterial.uniforms.uMix.value = Math.min(1, current.mix + rush * 0.05)
      sphereMaterial.uniforms.uScale.value = current.scale
      sphereMaterial.uniforms.uOpacity.value = 0.95 * current.opacity
      /* Apagado, não desenha. O limiar tem histerese: sem ela, a opacidade
         amortecida oscilava em volta do corte e o campo acendia e apagava
         de um frame para o outro — era isso que lia como tela piscando. */
      sphereField.visible = current.opacity > (sphereField.visible ? 0.002 : 0.01)
      const centerX = current.x * halfWidth + pointer.x * 0.05 + shakeX
      const centerY = current.y + pointer.y * -0.04 + shakeY
      sphereMaterial.uniforms.uCenter.value.set(centerX, centerY)
      ambientMaterial.uniforms.uTime.value = time * 0.6
      ambientMaterial.uniforms.uOpacity.value = narrow ? 0.06 : 0.14
      stars.update({ progress, opacity: narrow ? 0.72 : 0.85 }, time)
      brightStars.update({ progress, opacity: narrow ? 0.7 : 0.9 }, time)
      meteors.update(time, delta, halfWidth, visibleHalfHeightNow())
      space.update(progress, time)
      /* Um pouco mais presente que o campo: em meia luz o Sol ainda
         precisa ler como corpo, não como fantasma. */
      const targetBreak = planetBreak(current.mix, current.form)
      const targetOpacity = Math.min(1, current.opacity * 1.4)
      /* Os astros do centro da narrativa sobem para o meio da tela. */
      const astroY = centerY + astroShiftY
      star.update(
        { x: centerX, y: astroY, scale: current.scale, opacity: targetOpacity, break: targetBreak },
        time,
      )
      /* Os destroços só existem enquanto a forma ainda é o Sol: com o
         buraco negro `break` também vale 1, e o remanescente voltaria. */
      explosion.update(
        {
          x: centerX,
          y: astroY,
          scale: current.scale,
          opacity: targetOpacity * (1 - clamp01(current.form * 2)),
          break: targetBreak,
          pixelsPerUnit: stageHeight / (2 * visibleHalfHeightNow()),
        },
        time,
      )
      blackHole.update(
        {
          x: centerX,
          y: astroY,
          scale: current.scale,
          opacity: current.opacity,
          presence: holePresence(current.form),
          mix: current.mix,
        },
        time,
      )
      const novaLevel = novaPresence(current.form) * current.opacity
      nova.update(
        {
          x: centerX,
          y: astroY,
          scale: current.scale,
          opacity: current.opacity,
          presence: novaPresence(current.form),
          mix: current.mix,
        },
        time,
      )
      if (Math.abs(novaLevel - novaCss) > 0.04 && now - novaCssAt > 80) {
        novaCss = novaLevel
        novaCssAt = now
        document.documentElement.style.setProperty('--nova', novaLevel.toFixed(2))
      }

      /* Meia altura visível de verdade: com o palco maior que a base, o FOV
         muda e a régua não é mais halfHeight. */
      const visibleHalfHeight = halfWidth / camera.aspect

      /* A Terra no pé da tela, recuando e encolhendo com a decolagem. */
      const { radius: earthRadius, reveal } = earthApparent()
      const earthGone = Math.min(Math.max((current.lift - 0.55) / 0.45, 0), 1)
      const apparentRadius = earthRadius * (1 - current.lift * 0.45)
      const apparentCenterY = -visibleHalfHeight - apparentRadius + reveal - current.lift * 1.4
      earth.update(
        {
          x: 0,
          y: apparentCenterY * depthScale,
          z: -EARTH_DEPTH,
          scale: (apparentRadius * depthScale) / 0.62,
          opacity: 1 - earthGone,
          break: 0,
        },
        time,
      )
      satellites.update(1 - earthGone, time)

      for (const world of worlds) {
        const { from, to } = worldWindow(world)
        const t = (progress - from) / (to - from)
        if (t <= 0 || t >= 1) {
          world.planet.update({ x: 0, y: 0, scale: 1, opacity: 0, break: 0 }, time)
          continue
        }
        const fade = Math.min(t / 0.15, 1) * Math.min((1 - t) / 0.15, 1)
        const ds = depthAt(world.z)
        /* No celular a tela é estreita: mundos menores e mais para a borda,
           senão o gigante cobre a largura inteira atrás do texto. */
        const size = world.size * (narrow ? 0.6 : 1)
        const edge = world.x * (narrow ? 1.15 : 1)
        const halfH = visibleHalfHeight + size * 0.62
        world.planet.update(
          {
            x: edge * halfWidth * ds,
            y: (halfH - 2 * halfH * t) * ds,
            z: world.z,
            scale: size * ds,
            opacity: fade,
            break: 0,
          },
          time,
        )
      }

      {
        const { from, to } = cruiseWindow()
        const t = (progress - from) / (to - from)
        const inside = t > 0 && t < 1
        const fade = inside ? Math.min(t / 0.2, 1) * Math.min((1 - t) / 0.2, 1) : 0
        /* Em cruzeiro ele sobe pela tela numa curva suave, no vão entre o
           painel e o texto dos Serviços, tombando para o lado do rumo, e
           balança devagar no tempo, para nunca estar parado. */
        /* Em cruzeiro a nave varre a tela de um lado ao outro entre os
           mundos, subindo, chegando perto e se afastando, com o eixo no
           rumo. Balança devagar no tempo, para nunca estar parada. */
        const cruiseAmp = (narrow ? 0.42 : 0.5) * halfWidth
        const cruiseRise = visibleHalfHeight * 1.5
        const cruiseY0 = -visibleHalfHeight * 0.75
        const turns = Math.PI * 2 * 1.15
        const bobX = Math.sin(time * 0.7) * 0.02
        const bobY = Math.sin(time * 0.9) * 0.04
        const cruiseScale = (u: number) => 0.75 + 0.5 * (0.5 + 0.5 * Math.sin(u * turns + 1.6))
        const cruiseTilt = (u: number) => Math.atan2(-Math.cos(u * turns + 0.4) * turns * cruiseAmp, cruiseRise)
        const cruiseAt = (u: number) => ({
          x: Math.sin(u * turns + 0.4) * cruiseAmp + bobX,
          y: cruiseY0 + u * cruiseRise + bobY,
        })
        const cruisePath = (u: number, out: THREE.Vector3) => {
          const c = clamp01(u)
          const tilt = cruiseTilt(c)
          const at = cruiseAt(c)
          const nozzle = cruiser.nozzleOffset * cruiseScale(c)
          out.set(at.x + nozzle * Math.sin(tilt), at.y - nozzle * Math.cos(tilt), 0)
        }
        const thrust = 0.7 + 0.2 * Math.sin(time * 7.3)
        const tNow = clamp01(t)
        const here = cruiseAt(tNow)
        const scaleNow = cruiseScale(tNow)
        cruiser.object.scale.setScalar(scaleNow)
        cruiser.update(
          {
            visible: inside,
            lift: 0,
            thrust,
            x: here.x / scaleNow,
            yPad: here.y / scaleNow,
            travel: 0,
            opacity: fade,
            tilt: cruiseTilt(tNow) + Math.sin(time * 1.1) * 0.03,
          },
          time,
          delta,
        )
        cruiseTrail.update(
          cruisePath,
          {
            head: t,
            span: 0.3,
            width: rocketHeight * 0.5 * 0.09 * scaleNow,
            opacity: fade * 0.7 * thrust,
            spread: 1.6,
          },
          time,
        )
      }

      /* O foguete sai do horizonte: a plataforma acompanha a curva da Terra
         na coluna onde ele está. */
      /* No celular a tela é estreita e o foguete encostado na borda
         aparecia cortado; quase no meio ele cabe inteiro. */
      /* No celular o foguete fica no eixo da cena. O modelo tem um desvio
         constante para a direita dentro do próprio grupo (medido: cerca de
         um quarto da largura da tela), então com x = 0 ele cai no terço
         direito, inteiro, sem encostar na borda. Empurrar mais para a
         esquerda o jogaria por cima do texto. */
      const rocketX = (narrow ? 0 : 0.52) * halfWidth
      const horizonTop = -visibleHalfHeight + reveal
      const horizonDrop = earthRadius - Math.sqrt(Math.max(earthRadius * earthRadius - rocketX * rocketX, 0))
      const rocketPadY = horizonTop - horizonDrop + rocketHeight * 0.52
      const travel = visibleHalfHeight * 2 + rocketHeight
      /* Curva de gravidade: sobe reto e vai tombando para o centro da
         tela, com o eixo sempre no rumo, como lançador de verdade. No ar
         ainda deriva e balança no tempo, para nunca ficar pregado. */
      const arcAt = (u: number) => -halfWidth * 0.34 * Math.pow(u, 2.2)
      const tiltAt = (u: number) => Math.atan2(halfWidth * 0.34 * 2.2 * Math.pow(u, 1.2), travel)
      const drift = (Math.sin(time * 0.7) * 0.012 + Math.sin(time * 1.9) * 0.005) * current.lift
      const sway = (Math.sin(time * 0.9) * 0.02 + Math.sin(time * 2.3) * 0.01) * current.lift
      const launchPath = (u: number, out: THREE.Vector3) => {
        const c = clamp01(u)
        const tilt = tiltAt(c)
        out.set(
          rocketX + arcAt(c) + drift + rocket.nozzleOffset * Math.sin(tilt),
          rocketPadY + c * travel - rocket.nozzleOffset * Math.cos(tilt),
          0,
        )
      }
      const liftNow = clamp01(current.lift)
      const rocketOn = launch.visible || current.lift < 0.995
      rocket.update(
        {
          visible: rocketOn,
          lift: current.lift,
          thrust: current.thrust,
          x: rocketX + arcAt(liftNow) + drift + shakeX * 2,
          yPad: rocketPadY + shakeY * 2,
          travel,
          opacity: 1,
          tilt: tiltAt(liftNow) + sway,
        },
        time,
        delta,
      )
      /* O rastro nasce no bocal e cobre o trecho já voado; some com o foguete. */
      const trailFade = clamp01((current.lift - 0.015) / 0.07) * (1 - clamp01((current.lift - 0.9) / 0.1))
      trail.update(
        launchPath,
        {
          head: current.lift,
          span: 0.55,
          width: rocketHeight * 0.07,
          opacity: rocketOn ? current.thrust * trailFade : 0,
        },
        time,
      )
      /* Luz do motor no bocal, tremulando com a chama. */
      launchPath(current.lift, nozzlePoint)
      engineLight.position.set(nozzlePoint.x, nozzlePoint.y, 0.25)
      engineLight.intensity = current.thrust * (1.5 + Math.sin(time * 31) * 0.35) * (launch.visible ? 1 : 0)

      /* O sol: alto à esquerda, some com a subida. */
      /* No celular o clarão morava em cima do título: a coluna de texto
         ocupa a largura toda e não há canto livre lá em cima. Ele desce
         para a altura do horizonte, onde só há céu. */
      glare.position.set(
        -halfWidth * (narrow ? 0.62 : 0.78),
        visibleHalfHeight * (narrow ? -0.18 : 0.62),
        -1,
      )
      /* No celular o clarão ocupa proporcionalmente muito mais tela, e
         com bloom por cima ele lavava o título. */
      glareMaterial.opacity = (narrow ? 0.4 : 0.85) * Math.max(0, 1 - current.lift * 1.6)
      streak.position.copy(glare.position)
      streakMaterial.opacity = 0.32 * Math.max(0, 1 - current.lift * 1.6)
      sunRays.update(glare.position, Math.max(0, 1 - current.lift * 1.6), time)

      /* No desktop todo frame desenha: com grão e cintilação no passe de
         filme, pular frames virava um piscar a 30Hz nas partes "paradas" da
         página, e a cadência trocando de 60 para 30 a cada limiar lia como
         engasgo. Só a máquina que já provou não aguentar (rebaixada pela
         qualidade adaptativa) volta a desenhar a 30fps onde a cena está
         quieta: campo só textura, ou apagado. No celular a cena desenha a
         30fps, e a cena andava na metade da cadência do scroll nativo — o
         deslize parecia arrastado. Agora todo frame desenha em todo lugar;
         o custo por frame caiu o bastante para pagar isso. */
      /* Uma textura por frame sobe para a GPU. */
      const pending = warmQueueTextures.shift()
      if (pending) renderer.initTexture(pending)

      /* Depois de alguns frames desenhados, a lente entra. */
      /* A lente entra depois que a cena assentou. No celular ela espera
         mais: compilar a pirâmide do bloom é um tranco, e ele deve cair
         quando o visitante já está lendo, não na primeira dobra. */
      if (wantsPostFx && !postfx && !downgradedPostFx && postFxFrames > (lightweight ? 90 : 4)) {
        postfx = createPostFx(renderer, scene, camera, window.innerWidth, stageHeight, lightweight)
      }
      postFxFrames += 1

      frameCount += 1
      const restful =
        downgraded &&
        current.thrust < 0.01 &&
        current.opacity < 0.3 &&
        (current.mix > 0.85 || current.opacity <= 0.015)
      if (!(restful && frameCount % 2)) {
        /* A câmera se mexe por último, com o estado já amortecido: deriva
           contínua de poucos pixels e push-in na ignição e na explosão. */
        cameraMotion.update({
          time,
          pixel: (2 * halfWidth) / window.innerWidth,
          thrust: current.thrust,
          lift: current.lift,
          explode: planetBreak(current.mix, current.form) * (1 - clamp01(current.form)),
          still: reducedMotion,
        })
        if (postfx) postfx.render(time, 0.006 + rush * 0.014, rush)
        else renderer.render(scene, camera)
      }

      if (!revealed) {
        revealed = true
        mount.style.opacity = '1'
      }
    }
    /**
     * Compilação progressiva dos shaders.
     *
     * Cada astro compila o seu programa no primeiro frame em que aparece, e
     * isso é um tranco no meio do scroll. Compilar tudo de uma vez na carga
     * troca o tranco por uma travada de vários segundos antes da primeira
     * pintura — foi o que aconteceu, e é a demora que o cliente via.
     *
     * Aqui a fila anda um astro por vez, em `requestIdleCallback` (ou um
     * frame ocioso), e só depois que o hero já está desenhando. O
     * `compileAsync` usa KHR_parallel_shader_compile onde existe, então o
     * driver trabalha em outra thread e o que sobra para o thread principal
     * é a ligação final de um programa só.
     *
     * A ordem é a da narrativa: quem aparece antes compila antes.
     */
    const warmQueue: THREE.Object3D[] = [
      sphereField,
      cruiser.object,
      ...worlds.map((world) => world.planet.object),
      trail.object,
      cruiseTrail.object,
      star.object,
      explosion.object,
      blackHole.object,
      nova.object,
      meteors.object,
    ]
    const idle: (callback: () => void) => void =
      'requestIdleCallback' in window
        ? (callback) => window.requestIdleCallback(callback, { timeout: 900 })
        : (callback) => window.setTimeout(callback, 60)
    let warming = false
    const warmNext = () => {
      if (!environmentTarget && !disposed) {
        /* Primeiro da fila: o reflexo do metal. */
        buildEnvironment()
        idle(warmNext)
        return
      }
      if (disposed || warming) return
      const next = warmQueue.shift()
      if (!next) return
      warming = true
      renderer
        .compileAsync(next, camera, scene)
        .catch(() => undefined)
        .finally(() => {
          warming = false
          if (!disposed) idle(warmNext)
        })
    }
    /* Depois do primeiro frame: o hero aparece primeiro, o resto aquece
       enquanto o visitante lê a primeira dobra. */
    window.setTimeout(() => idle(warmNext), 400)
    frame = requestAnimationFrame(tick)

    /* Sem sentido queimar GPU com a aba escondida. */
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame)
      } else {
        previous = performance.now()
        frame = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      pageObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
      sphereGeometry.dispose()
      ambientGeometry.dispose()
      sphereMaterial.dispose()
      ambientMaterial.dispose()
      stars.dispose()
      brightStars.dispose()
      sunRays.dispose()
      meteors.dispose()
      space.dispose()
      rocket.dispose()
      warmTarget.dispose()
      star.dispose()
      explosion.dispose()
      for (const world of worlds) world.planet.dispose()
      cruiser.dispose()
      trail.dispose()
      cruiseTrail.dispose()
      earth.dispose()
      satellites.dispose()
      blackHole.dispose()
      nova.dispose()
      document.documentElement.style.removeProperty('--nova')
      environmentTarget?.dispose()
      postfx?.dispose()
      glareTexture.dispose()
      glareMaterial.dispose()
      streakMaterial.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-0 w-full opacity-0 transition-opacity duration-700"
    />
  )
}
