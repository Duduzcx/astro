import { useEffect, useRef } from 'react'

/**
 * Costura entre seções feita da mesma matéria dos astros: triângulos vazados,
 * pequenos, numa corrente lenta ao longo de um fio. Cada triângulo deriva na
 * horizontal, balança um pouco e gira devagar; de tempos em tempos um pulso
 * de luz percorre o fio e acende quem está perto. Nada estala, nada grita —
 * é o campo de partículas do fundo passando por um estreito.
 *
 * Canvas 2D, só anima enquanto está na tela, para na aba escondida, e vira
 * um frame parado com prefers-reduced-motion.
 */
type Tri = {
  x: number
  y: number
  size: number
  rot: number
  spin: number
  vx: number
  bob: number
  phase: number
  color: string
  alpha: number
}

const COLORS = ['#4d84e0', '#5a8fe8', '#8db4f5', '#f5f7fb', '#b9c2d4']

export function TriangleDrift({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobile = window.innerWidth < 768
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2)

    let width = 0
    let height = 0
    let tris: Tri[] = []
    let lineGrad: CanvasGradient | null = null

    /* Distribuição: a maioria perto do fio, alguns soltos mais longe — uma
       soma de dois aleatórios dá a concentração no meio sem cair em fórmula. */
    const spawn = (x: number): Tri => ({
      x,
      y: height / 2 + ((Math.random() + Math.random() - 1) * height) / 2.4,
      size: 1.5 + Math.random() * Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.6,
      vx: (6 + Math.random() * 14) * (Math.random() < 0.7 ? 1 : -1),
      bob: 2 + Math.random() * 4,
      phase: Math.random() * Math.PI * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 0.1 + Math.random() * 0.26,
    })

    const resize = () => {
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      lineGrad = ctx.createLinearGradient(0, 0, width, 0)
      lineGrad.addColorStop(0, 'rgba(141,180,245,0)')
      lineGrad.addColorStop(0.5, 'rgba(141,180,245,0.22)')
      lineGrad.addColorStop(1, 'rgba(141,180,245,0)')
      const count = Math.round(width / (mobile ? 36 : 26))
      tris = Array.from({ length: count }, () => spawn(Math.random() * width))
    }
    resize()

    let frame = 0
    let running = false
    let last = performance.now()

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const t = now / 1000
      ctx.clearRect(0, 0, width, height)
      ctx.lineWidth = 1
      ctx.lineJoin = 'round'

      /* O fio: uma linha de um pixel que some nas pontas. O gradiente é
         criado no resize, não a cada frame — alocar dois gradientes por frame
         em seis canvases enchia o coletor de lixo durante a rolagem. */
      ctx.strokeStyle = lineGrad!
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.moveTo(0, height / 2 + 0.5)
      ctx.lineTo(width, height / 2 + 0.5)
      ctx.stroke()

      /* O pulso: uma posição que percorre o fio a cada ~7s, com pausa. Quem
         está perto dele acende; o efeito é uma onda de luz, não um objeto. */
      const cycle = (t % 7) / 7
      const pulseX = cycle < 0.6 ? (cycle / 0.6) * (width + 200) - 100 : -1000
      /* O pulso vira três segmentos de alfa crescente: mesma leitura de um
         degradê, sem alocar um objeto por frame. */
      ctx.strokeStyle = '#f5f7fb'
      for (let k = 0; k < 3; k += 1) {
        ctx.globalAlpha = 0.12 + k * 0.16
        ctx.beginPath()
        ctx.moveTo(pulseX - 120 + k * 40, height / 2 + 0.5)
        ctx.lineTo(pulseX - 80 + k * 40, height / 2 + 0.5)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      for (const tri of tris) {
        tri.x += tri.vx * dt
        tri.rot += tri.spin * dt
        if (tri.vx > 0 && tri.x > width + 12) tri.x = -12
        if (tri.vx < 0 && tri.x < -12) tri.x = width + 12
        const y = tri.y + Math.sin(t * 0.8 + tri.phase) * tri.bob
        const near = Math.max(0, 1 - Math.abs(tri.x - pulseX) / 140)
        ctx.globalAlpha = Math.min(1, tri.alpha + near * 0.55)
        ctx.strokeStyle = near > 0.5 ? '#f5f7fb' : tri.color
        ctx.beginPath()
        for (let k = 0; k < 3; k += 1) {
          const a = tri.rot + (k / 3) * Math.PI * 2
          const px = tri.x + Math.cos(a) * tri.size
          const py = y + Math.sin(a) * tri.size
          if (k === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      draw(now)
    }
    const start = () => {
      if (running || reduced) return
      running = true
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(frame)
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !document.hidden) start()
        else stop()
      },
      { rootMargin: '40% 0px' },
    )
    io.observe(canvas)
    const onVisibility = () => {
      if (document.hidden) stop()
      else if (canvas.getBoundingClientRect().top < window.innerHeight * 1.4) start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const ro = new ResizeObserver(() => {
      resize()
      if (reduced) draw(performance.now())
    })
    ro.observe(canvas)
    if (reduced) draw(performance.now())

    return () => {
      stop()
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div aria-hidden="true" className={`relative z-10 -my-6 h-28 w-full overflow-hidden ${className}`}>
      <canvas ref={ref} className="block h-full w-full" />
    </div>
  )
}
