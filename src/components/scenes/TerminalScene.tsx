import { useEffect, useRef, useState } from 'react'

type Line = {
  kind: 'command' | 'out' | 'ok' | 'warn'
  text: string
}

const SCRIPT: Line[] = [
  { kind: 'command', text: 'astro deploy --env production' },
  { kind: 'out', text: 'lendo astro.config.ts' },
  { kind: 'out', text: 'build: 128 módulos · 4.2s' },
  { kind: 'out', text: 'migrations: 3 aplicadas · 0 pendentes' },
  { kind: 'warn', text: 'aviso: índice ausente em pedidos.cliente_id — criado' },
  { kind: 'out', text: 'testes: 84 passaram · 0 falharam' },
  { kind: 'out', text: 'publicando em 3 regiões...' },
  { kind: 'ok', text: '✓ no ar em 41s — app.suaempresa.com.br' },
]

const TONE: Record<Line['kind'], string> = {
  command: 'text-mist',
  out: 'text-silver',
  ok: 'text-[#7ef7c8]',
  warn: 'text-[#ffd479]',
}

/**
 * Standing in for a screen recording: a deploy that types itself and loops.
 * Real DOM instead of a video file — no asset to ship, and it stays sharp at any size.
 */
export function TerminalScene({ className = '' }: { className?: string }) {
  const [visibleLines, setVisibleLines] = useState(0)
  const [typed, setTyped] = useState('')
  const timers = useRef<number[]>([])

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setVisibleLines(SCRIPT.length)
      setTyped(SCRIPT[SCRIPT.length - 1].text)
      return
    }

    let cancelled = false
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, ms)
        timers.current.push(id)
      })

    const run = async () => {
      while (!cancelled) {
        setVisibleLines(0)
        setTyped('')
        await wait(600)

        for (let index = 0; index < SCRIPT.length && !cancelled; index++) {
          const line = SCRIPT[index]
          setVisibleLines(index)
          // Commands are typed out; output lines land whole, like real stdout.
          if (line.kind === 'command') {
            for (let char = 1; char <= line.text.length && !cancelled; char++) {
              setTyped(line.text.slice(0, char))
              await wait(28)
            }
            await wait(380)
          } else {
            setTyped(line.text)
            await wait(line.kind === 'ok' ? 520 : 340)
          }
          setVisibleLines(index + 1)
          setTyped('')
        }

        await wait(2600)
      }
    }

    run()
    return () => {
      cancelled = true
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [])

  const active = SCRIPT[visibleLines]

  return (
    <div
      className={`overflow-hidden rounded-[12px] border border-slate/30 bg-[#04102a]/90 backdrop-blur-md ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-slate/25 px-4 py-3">
        <span className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
          <span className="h-2 w-2 rounded-full bg-[#ffbd2e]" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]" />
        </span>
        <span className="label-voice text-[9px]">astro · deploy</span>
      </div>

      <div className="h-[268px] overflow-hidden p-4 font-mono text-[12px] leading-[1.9]">
        {SCRIPT.slice(0, visibleLines).map((line, index) => (
          <p key={`${line.text}-${index}`} className={TONE[line.kind]}>
            {line.kind === 'command' ? <span className="text-[#5aa9ff]">$ </span> : null}
            {line.text}
          </p>
        ))}
        {active ? (
          <p className={TONE[active.kind]}>
            {active.kind === 'command' ? <span className="text-[#5aa9ff]">$ </span> : null}
            {typed}
            <span className="ml-0.5 inline-block h-[13px] w-[7px] translate-y-[2px] animate-[astro-caret_1s_steps(2)_infinite] bg-mist" />
          </p>
        ) : null}
      </div>
    </div>
  )
}
