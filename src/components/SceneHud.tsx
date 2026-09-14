import { useEffect, useState } from 'react'

/**
 * Telemetria da missão, canto inferior direito, só em tela larga: altitude,
 * velocidade e fase, em mono, com cantoneiras finas nos quatro cantos da
 * tela. A cena emite `astro:telemetry` no máximo dez vezes por segundo.
 */
export type Telemetry = { altitude: number; velocity: number; stage: string }

export function SceneHud() {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  )
  const [data, setData] = useState<Telemetry>({ altitude: 0, velocity: 0, stage: 'PLATAFORMA' })

  useEffect(() => {
    const q = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches)
    q.addEventListener('change', onChange)
    const onTelemetry = (e: Event) => setData((e as CustomEvent<Telemetry>).detail)
    window.addEventListener('astro:telemetry', onTelemetry)
    return () => {
      q.removeEventListener('change', onChange)
      window.removeEventListener('astro:telemetry', onTelemetry)
    }
  }, [])

  if (!wide) return null
  const corner = 'pointer-events-none fixed h-5 w-5 border-white/25'
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 hidden lg:block">
      <span className={`${corner} top-24 left-8 border-t border-l`} />
      <span className={`${corner} top-24 right-8 border-t border-r`} />
      <span className={`${corner} bottom-6 left-8 border-b border-l`} />
      <span className={`${corner} right-8 bottom-6 border-r border-b`} />
      <div className="fixed right-8 bottom-6 flex flex-col items-end gap-1 pr-4 pb-3 font-mono text-[10px] tracking-[0.18em] text-slate uppercase">
        <span className="text-[#8db4f5]">{data.stage}</span>
        <span>
          ALT <span className="text-ivory/80 tabular-nums">{data.altitude.toFixed(1).padStart(6, '0')}</span> KM
        </span>
        <span>
          VEL <span className="text-ivory/80 tabular-nums">{Math.round(data.velocity).toString().padStart(5, '0')}</span> M/S
        </span>
      </div>
    </div>
  )
}
