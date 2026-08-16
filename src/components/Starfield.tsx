import { useEffect, useRef } from 'react'

type Star = {
  x: number
  /** Position in page space, not viewport space, so scroll parallax is a subtraction. */
  y: number
  size: number
  alpha: number
  /** 0.15 = far and slow, 1 = near and fast. */
  depth: number
  twinkle: number
}

const DENSITY = 1 / 9000 // stars per square page-pixel

/**
 * Ambient starfield behind the whole page. Fixed canvas, parallax driven by scroll,
 * so the page reads as one continuous sky rather than a stack of sections.
 */
export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let stars: Star[] = []
    let width = 0
    let height = 0
    let pageHeight = 0
    let frame = 0
    let clock = 0

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      pageHeight = Math.max(document.body.scrollHeight, height)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.round(width * pageHeight * DENSITY)
      stars = Array.from({ length: count }, () => {
        const depth = 0.15 + Math.random() * 0.85
        return {
          x: Math.random() * width,
          y: Math.random() * pageHeight,
          size: 0.4 + depth * 1.1,
          alpha: 0.15 + Math.random() * 0.6,
          depth,
          twinkle: Math.random() * Math.PI * 2,
        }
      })
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      const scroll = window.scrollY

      for (const star of stars) {
        const y = star.y - scroll * star.depth
        // Wrap through page space so the field never runs out at the bottom.
        const wrapped = ((y % pageHeight) + pageHeight) % pageHeight
        if (wrapped > height) continue

        const flicker = reduceMotion ? 1 : 0.72 + Math.sin(clock * 0.9 + star.twinkle) * 0.28
        ctx.globalAlpha = star.alpha * flicker
        ctx.fillStyle = star.depth > 0.75 ? '#edf3ff' : '#5aa9ff'
        ctx.fillRect(star.x, wrapped, star.size, star.size)
      }
      ctx.globalAlpha = 1
    }

    const loop = () => {
      clock += 0.016
      draw()
      frame = requestAnimationFrame(loop)
    }

    const onResize = () => {
      build()
      draw()
    }

    build()
    if (reduceMotion) {
      draw()
      window.addEventListener('scroll', draw, { passive: true })
    } else {
      loop()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', draw)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  )
}
