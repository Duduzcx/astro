import Lenis from 'lenis'

/**
 * Site-wide smooth scroll (Lenis drives the real scroll position, so
 * framer-motion's useScroll and the WebGL scene keep working untouched).
 * Skipped entirely for reduced-motion users.
 */
let lenis: Lenis | null = null

export function initSmoothScroll() {
  if (lenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  lenis = new Lenis({ lerp: 0.105 })
  const raf = (time: number) => {
    lenis?.raf(time)
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)

  /* Anchor clicks glide through Lenis instead of jumping. */
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

/** Programmatic variant for the mobile menu (close first, then glide). */
export function scrollToHash(hash: string) {
  const element = document.querySelector(hash)
  if (!element) return
  if (lenis) lenis.scrollTo(element as HTMLElement, { offset: -88 })
  else element.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
