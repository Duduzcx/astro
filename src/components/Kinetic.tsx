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
  const x = useTransform(scrollYProgress, [0, 1], ['8%', '-28%'])

  return (
    <div ref={ref} className="overflow-hidden border-y border-slate/20 py-20 md:py-28">
      <motion.p
        style={{ x }}
        aria-hidden="true"
        className="text-[clamp(5rem,20vw,16rem)] leading-[0.82] font-medium tracking-[-0.055em] whitespace-nowrap text-orbit select-none"
      >
        EM PRODUÇÃO
      </motion.p>
      <p className="shell mt-10 max-w-md font-mono text-[11px] leading-relaxed tracking-[0.14em] text-slate uppercase">
        Projeto só conta quando está no ar e alguém está usando.
      </p>
    </div>
  )
}
