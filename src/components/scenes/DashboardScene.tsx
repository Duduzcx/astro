import { useEffect, useMemo, useRef, useState } from 'react'
import { useInView } from 'framer-motion'

const ROWS = [
  { id: '#48210', client: 'Distribuidora Vale', value: 'R$ 12.480', state: 'Faturado' },
  { id: '#48209', client: 'Clínica Norte', value: 'R$ 3.120', state: 'Em rota' },
  { id: '#48208', client: 'Marcenaria Sul', value: 'R$ 7.940', state: 'Separando' },
  { id: '#48207', client: 'Ótica Central', value: 'R$ 1.260', state: 'Faturado' },
  { id: '#48206', client: 'Padaria Aurora', value: 'R$ 890', state: 'Faturado' },
]

const STATE_TONE: Record<string, string> = {
  Faturado: 'text-[#7ef7c8] border-[#7ef7c8]/40',
  'Em rota': 'text-[#5aa9ff] border-[#5aa9ff]/40',
  Separando: 'text-[#ffd479] border-[#ffd479]/40',
}

/** Counts to a target once the panel is on screen. Gives the numbers a heartbeat. */
function useCountUp(target: number, active: boolean, duration = 1400) {
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
      // Ease-out so the last digits settle instead of snapping.
      setValue(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, active, duration])

  return value
}

function buildPath(points: number[], width: number, height: number) {
  const step = width / (points.length - 1)
  return points
    .map((point, index) => {
      const x = index * step
      const y = height - (point / 100) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/**
 * A working panel, not a picture of one: the chart advances, the counters count,
 * and the queue highlights a different order every couple of seconds.
 */
export function DashboardScene({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: false, margin: '-10%' })
  const [series, setSeries] = useState<number[]>(() =>
    Array.from({ length: 26 }, (_, i) => 32 + Math.sin(i * 0.55) * 18 + Math.random() * 14),
  )
  const [activeRow, setActiveRow] = useState(0)

  const orders = useCountUp(1284, inView)
  const hours = useCountUp(37, inView)
  const uptime = useCountUp(99.9, inView)

  useEffect(() => {
    if (!inView) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const chart = window.setInterval(() => {
      setSeries((current) => {
        const last = current[current.length - 1]
        // Random walk, clamped, so the line keeps moving without leaving the box.
        const next = Math.min(96, Math.max(12, last + (Math.random() - 0.45) * 22))
        return [...current.slice(1), next]
      })
    }, 1500)

    const rows = window.setInterval(() => {
      setActiveRow((index) => (index + 1) % ROWS.length)
    }, 2200)

    return () => {
      clearInterval(chart)
      clearInterval(rows)
    }
  }, [inView])

  const path = useMemo(() => buildPath(series, 560, 150), [series])
  const area = `${path} L560,150 L0,150 Z`

  return (
    <div
      ref={ref}
      className={`overflow-hidden rounded-[16px] border border-slate/30 bg-[#050f24]/92 backdrop-blur-md ${className}`}
    >
      {/* Browser chrome sells this as a product screen without pretending to be a photo. */}
      <div className="flex items-center gap-3 border-b border-slate/25 px-4 py-3">
        <span className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
          <span className="h-2 w-2 rounded-full bg-[#ffbd2e]" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]" />
        </span>
        <span className="flex-1 truncate rounded-full border border-slate/25 px-3 py-1 text-center font-mono text-[10px] tracking-[0.08em] text-slate">
          app.suaempresa.com.br/pedidos
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.12em] text-[#7ef7c8] uppercase">
          <span className="h-1.5 w-1.5 animate-[astro-pulse_1.6s_ease-in-out_infinite] rounded-full bg-[#7ef7c8]" />
          ao vivo
        </span>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-3">
        {[
          { label: 'Pedidos no mês', value: Math.round(orders).toLocaleString('pt-BR') },
          { label: 'Horas poupadas', value: `${Math.round(hours)}h` },
          { label: 'Disponibilidade', value: `${uptime.toFixed(1)}%` },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-[12px] border border-slate/25 p-4">
            <p className="label-voice text-[9px]">{kpi.label}</p>
            <p className="mt-2 font-mono text-2xl text-phosphor tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="px-5">
        <svg viewBox="0 0 560 150" className="h-[150px] w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="astro-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5aa9ff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#5aa9ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((line) => (
            <line
              key={line}
              x1="0"
              x2="560"
              y1={line * 37.5}
              y2={line * 37.5}
              stroke="#6c7a96"
              strokeOpacity="0.18"
              strokeDasharray="3 5"
            />
          ))}
          {/* Paths are re-rendered rather than tweened: SVG `d` has no interpolable
              form here, and the step reads correctly as "a new sample arrived". */}
          <path d={area} fill="url(#astro-area)" />
          <path d={path} fill="none" stroke="#cfe2ff" strokeWidth="1.6" />
          <circle
            cx="560"
            cy={150 - (series[series.length - 1] / 100) * 150}
            r="3"
            fill="#cfe2ff"
          />
        </svg>
      </div>

      {/* The queue is the one thing here that cannot compress; let it scroll on its own. */}
      <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[440px] border-collapse text-left">
        <thead>
          <tr className="label-voice text-[9px]">
            <th className="px-5 py-3 font-medium">Pedido</th>
            <th className="px-5 py-3 font-medium">Cliente</th>
            <th className="px-5 py-3 font-medium">Valor</th>
            <th className="px-5 py-3 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, index) => (
            <tr
              key={row.id}
              className={`border-t border-slate/20 font-mono text-[11px] transition-colors duration-500 ${
                index === activeRow ? 'bg-[#5aa9ff]/10 text-mist' : 'text-silver'
              }`}
            >
              <td className="px-5 py-3">{row.id}</td>
              <td className="px-5 py-3">{row.client}</td>
              <td className="px-5 py-3 tabular-nums">{row.value}</td>
              <td className="px-5 py-3">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[9px] tracking-[0.1em] uppercase ${STATE_TONE[row.state]}`}
                >
                  {row.state}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
