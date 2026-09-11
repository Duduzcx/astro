import { useEffect, useRef } from 'react'

/**
 * Divisor de energia entre seções: um feixe de plasma horizontal que ondula,
 * com raios que estalam a partir dele e pulsos de dados correndo ao longo.
 *
 * Canvas 2D de propósito. SVG não dá conta de raios gerados a cada frame com
 * três passadas de brilho, e WebGL seria um segundo contexto disputando GPU
 * com a cena de fundo. Um canvas de 160px de altura com ~80 traços por frame
 * custa quase nada — e só roda enquanto está na tela (IntersectionObserver),
 * para na aba escondida, e vira um frame estático com prefers-reduced-motion.
 *
 * `intensity` controla a frequência dos raios e a quantidade de pulsos.
 * `hue` desloca a paleta para cada costura ter a própria temperatura.
 */
type Props = {
  intensity?: 'calm' | 'storm'
  hue?: 'cobalt' | 'ice' | 'violet'
  className?: string
}

const PALETTE = {
  cobalt: { core: '#f5f7fb', beam: '#8db4f5', glow: '#4d84e0', field: '#2b4d8f' },
  ice: { core: '#ffffff', beam: '#bfe3ff', glow: '#5fbaec', field: '#2f6f9c' },
  violet: { core: '#fbf6ff', beam: '#c9b3ff', glow: '#8d6bff', field: '#4b3a9c' },
} as const

type Point = { x: number; y: number }
type Bolt = { path: Point[]; branches: Point[][]; born: number; life: number }
type Pulse = { x: number; v: number; len: number; w: number }

/** Deslocamento de ponto médio: a forma clássica de um raio convincente. */
function jaggedLine(a: Point, b: Point, jitter: number, depth: number, out: Point[]) {
  if (depth === 0) {
    out.push(b)
    return
  }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  /* Empurra o meio na perpendicular; o jitter cai pela metade a cada nível. */
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const off = (Math.random() - 0.5) * jitter
  mid.x += (-dy / len) * off
  mid.y += (dx / len) * off
  jaggedLine(a, mid, jitter / 2, depth - 1, out)
  jaggedLine(mid, b, jitter / 2, depth - 1, out)
}

function makeBolt(x: number, y: number, up: boolean, reach: number): Bolt {
  const end = {
    x: x + (Math.random() - 0.5) * reach * 1.4,
    y: y + (up ? -1 : 1) * reach * (0.6 + Math.random() * 0.6),
  }
  const path: Point[] = [{ x, y }]
  jaggedLine({ x, y }, end, reach * 0.9, 4, path)

  /* Um ou dois galhos saindo do tronco, mais curtos e mais tortos. */
  const branches: Point[][] = []
  const count = 1 + Math.floor(Math.random() * 2)
  for (let i = 0; i < count; i += 1) {
    const from = path[2 + Math.floor(Math.random() * (path.length - 4))]
    const tip = {
      x: from.x + (Math.random() - 0.5) * reach * 1.2,
      y: from.y + (up ? -1 : 1) * reach * (0.3 + Math.random() * 0.4),
    }
    const branch: Point[] = [from]
    jaggedLine(from, tip, reach * 0.6, 3, branch)
    branches.push(branch)
  }
  return { path, branches, born: performance.now(), life: 160 + Math.random() * 140 }
}

function strokePath(ctx: CanvasRenderingContext2D, pts: Point[]) {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
}

export function EnergyDivider({ intensity = 'calm', hue = 'cobalt', className = '' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const colors = PALETTE[hue]
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobile = window.innerWidth < 768
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5)
    const storm = intensity === 'storm'

    let width = 0
    let height = 0
    const resize = () => {
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    /* Estado da animação. */
    const bolts: Bolt[] = []
    const pulses: Pulse[] = []
    const pulseCount = (storm ? 7 : 4) * (mobile ? 0.6 : 1)
    for (let i = 0; i < pulseCount; i += 1) {
      pulses.push({
        x: Math.random() * width,
        v: (60 + Math.random() * 160) * (Math.random() < 0.5 ? 1 : -1),
        len: 40 + Math.random() * 90,
        w: 1 + Math.random() * 1.5,
      })
    }
    let nextBolt = performance.now() + 600
    let flash = 0
    let frame = 0
    let running = false
    let last = performance.now()

    /* Altura do feixe em x: três senoides somadas, com fases que andam em
       velocidades diferentes — nunca repete, nunca parece mecânico. */
    const beamY = (x: number, t: number, phase = 0) =>
      height / 2 +
      Math.sin(x * 0.012 + t * 0.9 + phase) * 6 +
      Math.sin(x * 0.031 - t * 1.7 + phase * 2) * 3 +
      Math.sin(x * 0.005 + t * 0.4) * 9

    const drawBeam = (t: number, phase: number, alpha: number, lineWidth: number, color: string) => {
      ctx.strokeStyle = color
      ctx.globalAlpha = alpha
      ctx.lineWidth = lineWidth
      ctx.beginPath()
      for (let x = -4; x <= width + 4; x += 6) {
        const y = beamY(x, t, phase)
        if (x === -4) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const t = now / 1000

      ctx.clearRect(0, 0, width, height)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      /* Campo: dois feixes fracos, acima e abaixo, com fase própria. */
      drawBeam(t, 1.6, 0.16, 1, colors.field)
      drawBeam(t, -2.1, 0.12, 1, colors.field)

      /* O feixe principal em três passadas: halo largo, corpo, núcleo. O
         flash sobe quando um raio estala e decai em seguida. */
      flash = Math.max(0, flash - dt * 4)
      drawBeam(t, 0, 0.18 + flash * 0.25, 9, colors.glow)
      drawBeam(t, 0, 0.55 + flash * 0.3, 2.2, colors.beam)
      drawBeam(t, 0, 0.85 + flash * 0.15, 0.9, colors.core)

      /* Pulsos de dados: traços curtos correndo pelo feixe, cabeça mais
         clara que a cauda. */
      for (const p of pulses) {
        p.x += p.v * dt
        if (p.v > 0 && p.x - p.len > width) p.x = -p.len
        if (p.v < 0 && p.x + p.len < 0) p.x = width + p.len
        const dir = Math.sign(p.v)
        const grad = ctx.createLinearGradient(p.x - dir * p.len, 0, p.x, 0)
        grad.addColorStop(0, 'rgba(255,255,255,0)')
        grad.addColorStop(1, colors.core)
        ctx.strokeStyle = grad
        ctx.globalAlpha = 0.9
        ctx.lineWidth = p.w
        ctx.beginPath()
        for (let i = 0; i <= 10; i += 1) {
          const x = p.x - dir * p.len + (dir * p.len * i) / 10
          const y = beamY(x, t)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      /* Raios: nascem num ponto do feixe, estalam para cima ou para baixo,
         vivem um piscar e somem. Tempestade estala três vezes mais. */
      if (now > nextBolt) {
        const x = width * (0.08 + Math.random() * 0.84)
        const up = Math.random() < 0.5
        bolts.push(makeBolt(x, beamY(x, t), up, mobile ? 34 : 52))
        if (storm && Math.random() < 0.5) {
          const x2 = width * (0.08 + Math.random() * 0.84)
          bolts.push(makeBolt(x2, beamY(x2, t), !up, mobile ? 26 : 40))
        }
        flash = 1
        const gap = storm ? 350 + Math.random() * 700 : 900 + Math.random() * 1600
        nextBolt = now + gap
      }
      for (let i = bolts.length - 1; i >= 0; i -= 1) {
        const b = bolts[i]
        const age = (now - b.born) / b.life
        if (age >= 1) {
          bolts.splice(i, 1)
          continue
        }
        /* Acende rápido, apaga com cauda: o olho registra o pico e o rastro. */
        const a = age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 0.85
        ctx.globalAlpha = a * 0.35
        ctx.strokeStyle = colors.glow
        ctx.lineWidth = 6
        strokePath(ctx, b.path)
        ctx.globalAlpha = a * 0.9
        ctx.strokeStyle = colors.beam
        ctx.lineWidth = 1.8
        strokePath(ctx, b.path)
        ctx.globalAlpha = a
        ctx.strokeStyle = colors.core
        ctx.lineWidth = 0.8
        strokePath(ctx, b.path)
        for (const br of b.branches) {
          ctx.globalAlpha = a * 0.7
          ctx.strokeStyle = colors.beam
          ctx.lineWidth = 1
          strokePath(ctx, br)
        }
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

    /* Só desenha enquanto a costura está na tela, com folga de meia tela. */
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !document.hidden) start()
        else stop()
      },
      { rootMargin: '50% 0px' },
    )
    io.observe(canvas)

    const onVisibility = () => {
      if (document.hidden) stop()
      else if (canvas.getBoundingClientRect().top < window.innerHeight * 1.5) start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const ro = new ResizeObserver(() => {
      resize()
      if (reduced) draw(performance.now())
    })
    ro.observe(canvas)

    /* Reduced motion: um frame parado já mostra o feixe e o campo. */
    if (reduced) draw(performance.now())

    return () => {
      stop()
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intensity, hue])

  return (
    <div aria-hidden="true" className={`relative z-10 -my-8 h-40 w-full overflow-hidden ${className}`}>
      <canvas ref={ref} className="block h-full w-full" />
    </div>
  )
}
