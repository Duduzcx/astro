import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

/**
 * Oversized section marker. The word drifts with the scroll instead of animating on
 * its own, so the motion is something the reader causes rather than watches.
 */
export function Kinetic() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const x = useTransform(scrollYProgress, [0, 1], ['6%', '-30%'])
  const glow = useTransform(scrollYProgress, [0, 0.5, 1], [0.25, 1, 0.25])

  return (
    <div
      ref={ref}
      className="overflow-hidden border-y border-dashed border-slate/40 py-16 md:py-24"
    >
      <motion.p
        style={{ x, opacity: glow }}
        aria-hidden="true"
        className="bg-gradient-to-r from-[#0d2a63] via-[#5aa9ff] to-[#0d2a63] bg-clip-text text-[clamp(4.5rem,17vw,14rem)] leading-[0.82] font-medium tracking-[-0.055em] whitespace-nowrap text-transparent select-none"
      >
        EM PRODUÇÃO · EM PRODUÇÃO
      </motion.p>
      <p className="shell mt-8 max-w-md text-[11px] leading-relaxed tracking-[0.14em] text-slate uppercase">
        Projeto só conta quando está no ar e alguém está usando.
      </p>
    </div>
  )
}
