import Lenis from 'lenis'

/**
 * Scroll suave do site inteiro. O Lenis controla a posição real do scroll
 * (window.scrollY), então o useScroll/whileInView do framer-motion, o
 * IntersectionObserver e a cena WebGL — que lê scrollY a cada frame —
 * continuam funcionando sem mudança, só recebendo valores já suavizados.
 * Desligado por completo para quem pede reduced-motion.
 */
let lenis: Lenis | null = null

/** Onde o scroll suave vale: tela larga com ponteiro fino, sem reduced-motion. */
const wantsSmoothScroll = () =>
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  !window.matchMedia('(pointer: coarse)').matches &&
  window.matchMedia('(min-width: 1024px)').matches

/**
 * O Lenis fica só no desktop. Em tela de toque ele intercepta o gesto e
 * roda o scroll por JS, então um arrastão rápido acaba com a página andando
 * atrás do dedo — parece travamento. O scroll nativo do celular já tem inércia
 * própria e é o mais suave que existe ali. Abaixo de 1024px, mesmo com mouse,
 * a cena roda no modo leve e não ganha nada com a inércia.
 */
export function initSmoothScroll() {
  if (lenis) return
  if (!wantsSmoothScroll()) return

  /* lerp baixo e curva expo: a página segue a roda com peso, como um dolly
     de cinema, e assenta sem quicar. O easing só vale para scrollTo. */
  lenis = new Lenis({
    lerp: 0.09,
    wheelMultiplier: 1,
    duration: 1.4,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
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
