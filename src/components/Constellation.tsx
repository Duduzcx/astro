import { useEffect, useRef } from 'react'
import { useMotionValueEvent, useScroll } from 'framer-motion'

export type ConstellationNode = {
  label: string
  /** Normalized position inside the canvas box. */
  x: number
  y: number
}

/** Edges reference nodes by index; they light up in array order as the section scrolls. */
const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 0],
  [1, 4],
  [2, 5],
]

/**
 * Scroll-drawn constellation. The lines are not decoration — each node is one of the
 * six practices, and the edges appear in reading order as you move through the section,
 * so the drawing finishes exactly when the list does.
 */
export function Constellation({
  nodes,
  className = '',
}: {
  nodes: ConstellationNode[]
  className?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const progressRef = useRef(0)

  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ['start 0.85', 'end 0.4'],
  })

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    progressRef.current = value
  })

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let frame = 0
    let clock = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = wrap.clientWidth
      height = wrap.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const pointAt = (node: ConstellationNode) => ({
      x: node.x * width,
      y: node.y * height,
    })

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      // Reduced motion skips the scroll choreography and shows the finished figure.
      const progress = reduceMotion ? 1 : progressRef.current
      const litEdges = progress * EDGES.length

      EDGES.forEach(([fromIndex, toIndex], index) => {
        const from = nodes[fromIndex]
        const to = nodes[toIndex]
        if (!from || !to) return

        const amount = Math.min(1, Math.max(0, litEdges - index))
        if (amount <= 0) return

        const a = pointAt(from)
        const b = pointAt(to)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(a.x + (b.x - a.x) * amount, a.y + (b.y - a.y) * amount)
        ctx.strokeStyle = `rgba(90, 169, 255, ${0.2 + amount * 0.45})`
        ctx.lineWidth = 1
        ctx.stroke()
      })

      nodes.forEach((node, index) => {
        const { x, y } = pointAt(node)
        // A node ignites once any edge touching it has been drawn.
        const touched = EDGES.findIndex(([a, b]) => a === index || b === index)
        const active = litEdges > touched
        const pulse = reduceMotion ? 1 : 0.75 + Math.sin(clock * 1.6 + index) * 0.25
        const alpha = active ? 0.35 + pulse * 0.6 : 0.18

        ctx.beginPath()
        ctx.arc(x, y, active ? 3.2 : 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(237, 243, 255, ${alpha})`
        ctx.fill()

        if (active) {
          ctx.beginPath()
          ctx.arc(x, y, 10 + pulse * 5, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(90, 169, 255, ${0.28 * pulse})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      })
    }

    const loop = () => {
      clock += 0.016
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
  }, [nodes])

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0" />
      {nodes.map((node) => (
        <span
          key={node.label}
          className="absolute -translate-x-1/2 font-mono text-[10px] tracking-[0.16em] whitespace-nowrap text-mist uppercase"
          style={{ left: `${node.x * 100}%`, top: `calc(${node.y * 100}% + 18px)` }}
        >
          {node.label}
        </span>
      ))}
    </div>
  )
}
