import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  KEYFRAMES,
  MOBILE_BREAKPOINT,
  holePresence,
  mobileKeyframes,
  planetBreak,
  rocketWindow,
  sampleKeyframes,
  takeoffSpan,
} from './keyframes'
import { buildTriangles, makeMaterial } from './triangles'
import { createStars } from './stars'
import { createRocket } from './rocket'
import { createPlanet } from './planet'
import { createBlackHole } from './blackhole'

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
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, weakDevice ? 1 : lightweight ? 1 : 1.25),
    )
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

    const scene = new THREE.Scene()
    const BASE_FOV = 50
    const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / stageHeight, 0.1, 20)
    camera.position.z = 3.3

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
    const sizeStage = () => {
      stageHeight = Math.max(stageHeight, window.innerHeight)
      mount.style.height = `${stageHeight}px`
      renderer.setSize(window.innerWidth, stageHeight, false)
      camera.aspect = window.innerWidth / stageHeight
      camera.fov = (2 * Math.atan(halfWidth / (camera.position.z * camera.aspect)) * 180) / Math.PI
      camera.updateProjectionMatrix()
    }
    sizeStage()

    const spread = new THREE.Vector3(2.6, 1.7, 1.2)
    const sphereGeometry = buildTriangles(
      weakDevice ? 2600 : lightweight ? 4000 : 5600,
      spread,
      true,
    )
    const sphereMaterial = makeMaterial(0.95)
    const sphereField = new THREE.LineSegments(sphereGeometry, sphereMaterial)
    scene.add(sphereField)

    /* Camada ambiente, sempre dispersa: os triângulos fracos flutuando em volta. */
    const ambientGeometry = buildTriangles(
      lightweight ? 180 : 420,
      new THREE.Vector3(3.2, 2.1, 1.6),
      false,
    )
    const ambientMaterial = makeMaterial(0.32)
    ambientMaterial.uniforms.uMix.value = 1
    const ambientField = new THREE.LineSegments(ambientGeometry, ambientMaterial)
    scene.add(ambientField)

    /* Estrelas ao fundo, a página inteira. */
    const stars = createStars(lightweight ? 1200 : 2400, renderer.getPixelRatio())
    scene.add(stars.object)

    /* Foguete: altura em mundo pela largura da tela. No celular ele é menor e
       fica no canto inferior direito, abaixo do texto do hero; atrás dos
       botões ele confundia a leitura. */
    const rocketHeight = lightweight ? Math.min(0.6, halfWidth * 0.8) : Math.min(1.0, halfWidth * 1.15)
    const rocket = createRocket({ height: rocketHeight, lightweight })
    rocket.setPixelRatio(renderer.getPixelRatio())
    scene.add(rocket.object)

    /* O planeta mora no mesmo centro e escala do campo de triângulos. */
    const planet = createPlanet({ segments: lightweight ? 40 : 64 })
    scene.add(planet.object)

    const blackHole = createBlackHole({ segments: lightweight ? 72 : 112 })
    scene.add(blackHole.object)

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
    const current = {
      mix: 0.04,
      x: 0.58,
      y: 0.02,
      scale: 1,
      opacity: 1,
      form: 0,
      lift: 0,
      thrust: 0,
    }
    const pointer = { x: 0, y: 0 }

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
      if (delta > 0.028) slowFrames += 1
      if (sampled >= 90 && slowFrames > 30) {
        downgraded = true
        renderer.setPixelRatio(1)
        renderer.setSize(window.innerWidth, stageHeight, false)
        ambientField.visible = false
        stars.object.geometry.setDrawRange(
          0,
          Math.floor(stars.object.geometry.getAttribute('position').count / 2),
        )
        rocket.lighten()
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
      const damping = reducedMotion ? 1 : 1 - Math.exp(-delta * (narrow ? 3.2 : 4.5))
      current.mix += (target.mix - current.mix) * damping
      current.x += (target.x - current.x) * damping
      current.y += (target.y - current.y) * damping
      current.scale += (target.scale - current.scale) * damping
      current.opacity += (target.opacity - current.opacity) * damping
      current.form += (target.form - current.form) * damping
      /* O foguete também amortece: o scroll por toque chega em saltos. */
      current.lift += (launch.lift - current.lift) * damping
      current.thrust += (launch.thrust - current.thrust) * damping
      /* Tremor de câmera proporcional ao empuxo, some com o foguete. */
      const shake = current.thrust * Math.max(0, 1 - current.lift * 1.5) * 0.012
      const shakeX = (Math.random() - 0.5) * 2 * shake
      const shakeY = (Math.random() - 0.5) * 2 * shake

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
      const centerX = current.x * halfWidth + pointer.x * 0.05 + shakeX
      const centerY = current.y + pointer.y * -0.04 + shakeY
      sphereMaterial.uniforms.uCenter.value.set(centerX, centerY)
      ambientMaterial.uniforms.uTime.value = time * 0.6
      ambientMaterial.uniforms.uOpacity.value = narrow ? 0.12 : 0.32
      stars.update({ progress, opacity: narrow ? 0.6 : 0.7 }, time)
      /* Um pouco mais presente que o campo: em meia luz o planeta ainda
         precisa ler como corpo, não como fantasma. */
      planet.update(
        {
          x: centerX,
          y: centerY,
          scale: current.scale,
          opacity: Math.min(1, current.opacity * 1.4),
          break: planetBreak(current.mix, current.form),
        },
        time,
      )
      blackHole.update(
        {
          x: centerX,
          y: centerY,
          scale: current.scale,
          opacity: current.opacity,
          presence: holePresence(current.form),
          mix: current.mix,
        },
        time,
      )

      /* Meia altura visível de verdade: com o palco maior que a base, o FOV
         muda e a régua não é mais halfHeight. */
      const visibleHalfHeight = halfWidth / camera.aspect
      rocket.update(
        {
          visible: launch.visible || current.lift < 0.999,
          lift: current.lift,
          thrust: current.thrust,
          x: (narrow ? 0.5 : 0.58) * halfWidth + shakeX * 2,
          /* Acima da borda o bastante para a chama e o brilho da plataforma
             caberem na dobra. */
          yPad: -visibleHalfHeight + rocketHeight * 0.5 + (narrow ? 0.22 : 0.45) + shakeY * 2,
          travel: visibleHalfHeight * 2 + rocketHeight,
          opacity: 1,
        },
        time,
        delta,
      )

      /* As estrelas estão sempre na tela, então todo frame desenha. Onde o
         campo é só textura, ou está apagado, 30fps bastam: é metade do custo
         em mais da metade da página. */
      frameCount += 1
      const restful =
        current.thrust < 0.01 &&
        current.opacity < 0.3 &&
        (current.mix > 0.85 || current.opacity <= 0.015)
      if (!(restful && frameCount % 2)) {
        renderer.render(scene, camera)
      }

      if (!revealed) {
        revealed = true
        mount.style.opacity = '1'
      }
    }
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
      rocket.dispose()
      planet.dispose()
      blackHole.dispose()
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
