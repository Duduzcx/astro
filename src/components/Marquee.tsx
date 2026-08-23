import { motion, useScroll, useSpring, useTransform, useVelocity } from 'framer-motion'

/** Infinite capability ticker under the hero — plain words, no tech jargon. */
const capabilities = [
  'Sites que vendem',
  'Sistemas sob medida',
  'Robôs de WhatsApp',
  'Cobrança automática',
  'Painéis em tempo real',
  'Tudo conectado',
] as const

export function Marquee() {
  /* The strip shears with scroll velocity — fast scrolling bends it. */
  const { scrollY } = useScroll()
  const velocity = useVelocity(scrollY)
  const skewX = useSpring(useTransform(velocity, [-1600, 1600], [6, -6]), {
    stiffness: 220,
    damping: 32,
  })

  const row = capabilities.map((capability) => (
    <span key={capability} className="flex items-center gap-8 pr-8 whitespace-nowrap">
      <span className="text-[15px] tracking-[0.02em] text-ash">{capability}</span>
      <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5 opacity-70">
        <path d="M6 1.5 10.5 10.5H1.5L6 1.5Z" fill="none" stroke="#8434ce" strokeWidth="1.4" />
      </svg>
    </span>
  ))

  return (
    <div className="relative z-10 overflow-hidden border-y border-white/5 bg-onyx/40 py-4 backdrop-blur-sm">
      <motion.div style={{ skewX }} className="flex w-max animate-[astro-marquee_36s_linear_infinite]">
        <div aria-hidden="true" className="flex">{row}</div>
        <div className="flex">{row}</div>
      </motion.div>
      <p className="sr-only">Capacidades da Astro Soluções: {capabilities.join(', ')}.</p>
    </div>
  )
}
