import { motion, useScroll, useSpring, useTransform, useVelocity } from 'framer-motion'
import { AstroStar } from './brand/AstroMark'

/** Faixa infinita de capacidades embaixo do hero, em português comum. */
const capabilities = [
  'Sites que vendem',
  'Sistemas sob medida',
  'Robôs de WhatsApp',
  'Cobrança automática',
  'Painéis em tempo real',
  'Tudo conectado',
] as const

export function Marquee() {
  /* A faixa inclina conforme a velocidade do scroll. */
  const { scrollY } = useScroll()
  const velocity = useVelocity(scrollY)
  const skewX = useSpring(useTransform(velocity, [-1600, 1600], [6, -6]), {
    stiffness: 220,
    damping: 32,
  })

  const row = capabilities.map((capability) => (
    <span key={capability} className="flex items-center gap-8 pr-8 whitespace-nowrap">
      <span className="text-[15px] tracking-[0.02em] text-ash">{capability}</span>
      <AstroStar className="h-2.5 w-2.5 text-cobalt opacity-80" />
    </span>
  ))

  return (
    <div className="relative z-10 overflow-hidden border-y border-white/5 bg-onyx/60 py-4">
      <motion.div style={{ skewX }} className="flex w-max animate-[astro-marquee_36s_linear_infinite]">
        <div aria-hidden="true" className="flex">{row}</div>
        <div className="flex">{row}</div>
      </motion.div>
      <p className="sr-only">Capacidades da Astro Soluções: {capabilities.join(', ')}.</p>
    </div>
  )
}
