import { useEffect, useState } from 'react'
import { motion, useMotionValueEvent, useScroll, useSpring } from 'framer-motion'

/**
 * Leitor de posição no canto inferior esquerdo, só em tela larga: índice da
 * seção atual sobre o total, o nome dela e o progresso da página em
 * percentual, tudo em mono. O nome vem do próprio DOM (id ou aria-label de
 * cada seção do main), então novas seções entram sozinhas.
 */
export function ScrollHud() {
  /* Escondido por CSS não basta: os observers e a mola continuavam rodando no
     celular. Aqui ele nem monta. */
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  )
  useEffect(() => {
    const q = window.matchMedia('(min-width: 1024px)')
    const on = (e: MediaQueryListEvent) => setWide(e.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])

  if (!wide) return null
  return <Hud />
}

function Hud() {
  const { scrollYProgress } = useScroll()
  const bar = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 })
  const [percent, setPercent] = useState(0)
  const [current, setCurrent] = useState({ index: 1, total: 1, name: 'topo' })

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const next = Math.round(v * 100)
    if (next !== percent) setPercent(next)
  })

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('main > section, footer'))
    const names = sections.map(
      (el) => el.id || el.getAttribute('aria-label') || el.tagName.toLowerCase(),
    )
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        const index = sections.indexOf(visible.target as HTMLElement)
        if (index >= 0) setCurrent({ index: index + 1, total: sections.length, name: names[index] })
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: [0, 0.2, 0.5] },
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-6 left-8 z-40 hidden flex-col gap-2 font-mono text-[10px] tracking-[0.18em] text-slate uppercase lg:flex"
    >
      <div className="flex items-baseline gap-3">
        <span className="text-[#8db4f5]">{String(current.index).padStart(2, '0')}</span>
        <span className="text-white/25">/</span>
        <span>{String(current.total).padStart(2, '0')}</span>
        <span className="ml-2 text-ivory/80">{current.name.replace(/-/g, ' ')}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="relative block h-px w-28 bg-white/10">
          <motion.span style={{ scaleX: bar }} className="absolute inset-0 origin-left bg-[#8db4f5]" />
        </span>
        <span className="tabular-nums">{String(percent).padStart(3, '0')}%</span>
      </div>
    </div>
  )
}
