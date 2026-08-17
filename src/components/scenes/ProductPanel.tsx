import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'

const CHIPS = [
  { label: 'Pedidos hoje', value: '312' },
  { label: 'Tempo médio', value: '1m 40s' },
  { label: 'Falhas', value: '0' },
]

/** Smooth curve through the points — Catmull-Rom converted to cubic béziers. */
function smoothPath(points: number[], width: number, height: number) {
  const step = width / (points.length - 1)
  const at = (index: number) => {
    const clamped = Math.min(points.length - 1, Math.max(0, index))
    return { x: clamped * step, y: height - (points[clamped] / 100) * height }
  }

  let d = `M${at(0).x},${at(0).y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

function useCountUp(target: number, active: boolean, duration = 1600) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setValue(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, active, duration])

  return value
}

/**
 * The product, shown as an object rather than as a spreadsheet: one gauge, one
 * curve, three figures. Everything moves once the panel is on screen.
 */
export function ProductPanel({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-10%' })
  const [series, setSeries] = useState<number[]>(() =>
    Array.from({ length: 16 }, (_, i) => 38 + Math.sin(i * 0.7) * 16 + Math.random() * 10),
  )

  const gauge = useCountUp(94, inView)
  const saved = useCountUp(37, inView)

  useEffect(() => {
    if (!inView) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const id = window.setInterval(() => {
      setSeries((current) => {
        const last = current[current.length - 1]
        const next = Math.min(94, Math.max(16, last + (Math.random() - 0.44) * 20))
        return [...current.slice(1), next]
      })
    }, 1800)
    return () => clearInterval(id)
  }, [inView])

  const line = smoothPath(series, 520, 130)
  const circumference = 2 * Math.PI * 52

  return (
    <div ref={ref} className={`relative ${className}`}>
      <span
        className="bloom -top-10 -left-10 h-56 w-56"
        style={{ background: 'rgba(123, 92, 255, 0.35)' }}
      />
      <span
        className="bloom -right-12 -bottom-12 h-64 w-64"
        style={{ background: 'rgba(77, 224, 255, 0.22)' }}
      />

      <div className="glass relative overflow-hidden rounded-[20px] p-7 sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="label-voice text-[9px]">Painel do cliente</p>
            <p className="mt-2 text-[1.05rem] uppercase">Operação em tempo real</p>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-[#7ef7c8]/35 px-3 py-1.5 font-mono text-[9px] tracking-[0.14em] text-[#7ef7c8] uppercase">
            <span className="h-1.5 w-1.5 animate-[astro-pulse_1.8s_ease-in-out_infinite] rounded-full bg-[#7ef7c8]" />
            no ar
          </span>
        </div>

        <div className="mt-9 flex flex-col items-center gap-9 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            <svg viewBox="0 0 130 130" className="h-[130px] w-[130px] -rotate-90">
              <defs>
                <linearGradient id="astro-gauge" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#4de0ff" />
                  <stop offset="100%" stopColor="#7b5cff" />
                </linearGradient>
              </defs>
              <circle cx="65" cy="65" r="52" fill="none" stroke="#6c7a96" strokeOpacity="0.22" strokeWidth="6" />
              <circle
                cx="65"
                cy="65"
                r="52"
                fill="none"
                stroke="url(#astro-gauge)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - gauge / 100)}
              />
            </svg>
            {/* The caption sits below the dial — inside the ring it collides with the figure. */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl text-phosphor tabular-nums">{Math.round(gauge)}%</span>
            </div>
            <p className="label-voice mt-3 text-center text-[8px]">do fluxo automático</p>
          </div>

          <div className="w-full min-w-0">
            <svg viewBox="0 0 520 130" className="h-[130px] w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="astro-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4de0ff" />
                  <stop offset="100%" stopColor="#cfe2ff" />
                </linearGradient>
                <linearGradient id="astro-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4de0ff" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#4de0ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${line} L520,130 L0,130 Z`} fill="url(#astro-fill)" />
              <path
                d={line}
                fill="none"
                stroke="url(#astro-line)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
            <p className="label-voice mt-3 text-[9px]">Pedidos processados · últimas 16 horas</p>
          </div>
        </div>

        <div className="mt-9 grid grid-cols-3 gap-3 border-t border-dashed border-slate/35 pt-6">
          {CHIPS.map((chip) => (
            <div key={chip.label}>
              <p className="text-xl text-mist tabular-nums">{chip.value}</p>
              <p className="label-voice mt-1.5 text-[8px]">{chip.label}</p>
            </div>
          ))}
        </div>

        <p className="mt-7 text-[15px] text-silver">
          {Math.round(saved)} horas de trabalho manual devolvidas para a equipe neste mês.
        </p>
      </div>
    </div>
  )
}
