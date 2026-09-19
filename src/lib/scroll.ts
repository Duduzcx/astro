import Lenis from 'lenis'

/**
 * Scroll suave do site inteiro. O Lenis controla a posição real do scroll
 * (window.scrollY), então o useScroll/whileInView do framer-motion, o
 * IntersectionObserver e a cena WebGL — que lê scrollY a cada frame —
 * continuam funcionando sem mudança, só recebendo valores já suavizados.
 * Desligado por completo para quem pede reduced-motion.
 */
let lenis: Lenis | null = null

/** Em qualquer tela, menos para quem pede menos movimento. */
const wantsSmoothScroll = () =>
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isTouch = () => window.matchMedia('(pointer: coarse)').matches

/**
 * Scroll suave também no toque.
 *
 * A versão anterior deixava o Lenis só no desktop, com o argumento de que em
 * tela de toque ele intercepta o gesto e a página anda atrás do dedo. Isso
 * vale para o modo padrão, que roda a rolagem inteira por JavaScript. Com
 * `syncTouch` o dedo continua mandando na posição — o Lenis só suaviza a
 * inércia depois que o gesto termina, e é aí que a cena 3D ganha: sem os
 * saltos bruscos do scroll nativo, o astro não engasga entre um quadro e
 * outro. O `touchInertiaMultiplier` baixo evita que um arrastão longo
 * dispare meia página de deslizamento.
 */
export function initSmoothScroll() {
  if (lenis) return
  if (!wantsSmoothScroll()) return

  /* lerp baixo e curva expo: a página segue a roda com peso, como um dolly
     de cinema, e assenta sem quicar. O easing só vale para scrollTo. */
  const touch = isTouch()
  lenis = new Lenis({
    /* No toque, mais devagar e mais macio, sem custo de atraso. Vale a pena
       saber por que isso não briga com "a cena fica atrás do dedo": com
       `syncTouch`, o Lenis força `lerp: 1` enquanto o dedo está na tela e só
       usa `syncTouchLerp` no `touchend`. Ou seja, durante o arrasto a página
       segue o dedo um para um, e estes números governam apenas o deslize que
       vem depois que ele sai.

       `touchMultiplier` de 1,6 para 1,25 é o que faz a página andar menos
       por gesto — é o "mais devagar". `syncTouchLerp` de 0,085 para 0,06
       alonga o assentamento em vez de cortá-lo. E `touchInertiaExponent`,
       que estava no comentário mas nunca tinha sido passado de verdade,
       desce do padrão 1,7 para 1,5: o impulso final vira um deslize e não
       um arremesso. */
    lerp: touch ? 0.11 : 0.09,
    wheelMultiplier: 1,
    duration: 1.4,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    syncTouch: touch,
    syncTouchLerp: 0.06,
    touchInertiaExponent: 1.5,
    touchMultiplier: touch ? 1.25 : 1,
  })
  const raf = (time: number) => {
    lenis?.raf(time)
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)

  /* Clique em âncora passa pelo Lenis em vez de pular. */
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const anchor = target.closest?.('a[href^="#"]') as HTMLAnchorElement | null
    if (!anchor) return
    const hash = anchor.getAttribute('href')
    if (!hash || hash.length < 2) return
    const element = document.querySelector(hash)
    if (!element) return
    event.preventDefault()
    lenis?.scrollTo(element as HTMLElement, { offset: -88 })
  })

  /* Chegou com #secao na URL: o browser já pulou para lá antes do Lenis
     existir; ele só precisa saber onde está para não puxar de volta ao topo. */
  if (window.location.hash.length > 1) {
    window.addEventListener('load', () => scrollToHash(window.location.hash, true), { once: true })
  }
}

/** Versão programática para o menu mobile: fecha primeiro, rola depois. */
export function scrollToHash(hash: string, immediate = false) {
  const element = document.querySelector(hash)
  if (!element) return
  if (lenis) lenis.scrollTo(element as HTMLElement, { offset: -88, immediate })
  else element.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth', block: 'start' })
}
