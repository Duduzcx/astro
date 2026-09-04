import Lenis from 'lenis'

/**
 * Scroll suave do site inteiro. O Lenis controla a posição real do scroll, então
 * o useScroll do framer-motion e a cena WebGL continuam funcionando sem mudança.
 * Desligado por completo para quem pede reduced-motion.
 */
let lenis: Lenis | null = null

/**
 * O Lenis fica só no ponteiro fino. Em tela de toque ele intercepta o gesto e
 * roda o scroll por JS, então um arrastão rápido acaba com a página andando
 * atrás do dedo — parece travamento. O scroll nativo do celular já tem inércia
 * própria e é o mais suave que existe ali.
 */
export function initSmoothScroll() {
  if (lenis) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (window.matchMedia('(pointer: coarse)').matches) return

  lenis = new Lenis({ lerp: 0.105 })
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
}

/** Versão programática para o menu mobile: fecha primeiro, rola depois. */
export function scrollToHash(hash: string) {
  const element = document.querySelector(hash)
  if (!element) return
  if (lenis) lenis.scrollTo(element as HTMLElement, { offset: -88 })
  else element.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
