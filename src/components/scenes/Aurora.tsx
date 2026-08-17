import { useEffect, useRef } from 'react'

type Blob = {
  hue: [number, number, number]
  radius: number
  /** Elliptical drift, in fractions of the canvas box. */
  ax: number
  ay: number
  speed: number
  phase: number
  cx: number
  cy: number
}

const BLOBS: Blob[] = [
  { hue: [27, 77, 255], radius: 0.62, ax: 0.16, ay: 0.1, speed: 0.11, phase: 0, cx: 0.32, cy: 0.42 },
  { hue: [123, 92, 255], radius: 0.5, ax: 0.2, ay: 0.14, speed: 0.09, phase: 2.1, cx: 0.68, cy: 0.34 },
  { hue: [77, 224, 255], radius: 0.42, ax: 0.13, ay: 0.18, speed: 0.14, phase: 4.2, cx: 0.55, cy: 0.7 },
  { hue: [10, 32, 80], radius: 0.7, ax: 0.1, ay: 0.08, speed: 0.07, phase: 1.2, cx: 0.2, cy: 0.75 },
]

/**
 * Slow colour field behind a section. Overlapping radial gradients drifting on
 * ellipses — the cheapest way to get depth and colour into a dark page without
 * shipping a single image.
 */
export function Aurora({ className = '', intensity = 1 }: { className?: string; intensity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let frame = 0
    let clock = 0

    const resize = () => {
      // Half resolution: the result is pure blur, so the pixels are free to lose.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * 0.5
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'
      const scale = Math.max(width, height)

      for (const blob of BLOBS) {
        const t = clock * blob.speed + blob.phase
        const x = (blob.cx + Math.cos(t) * blob.ax) * width
        const y = (blob.cy + Math.sin(t * 1.3) * blob.ay) * height
        const radius = blob.radius * scale

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        const [r, g, b] = blob.hue
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.3 * intensity})`)
        gradient.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, ${0.09 * intensity})`)
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    const loop = () => {
      clock += 0.006
      draw()
      frame = requestAnimationFrame(loop)
    }

    const onResize = () => {
      resize()
      draw()
    }

    resize()
    if (reduceMotion) draw()
    else loop()
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
    }
  }, [intensity])

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />
}
