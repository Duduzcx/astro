import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

/**
 * The signature layout: a full-viewport void with one object centered and text
 * flanking it. Heading left, body right, both left-aligned. Nothing else in frame.
 */
export function VoidReveal({
  id,
  serial,
  heading,
  body,
  footnote,
  object,
}: {
  id?: string
  serial: string
  heading: string
  body: string
  footnote?: string
  object: ReactNode
}) {
  return (
    <section
      id={id}
      className="relative flex min-h-[72svh] flex-col justify-center overflow-hidden py-20"
    >
      {/* Both text columns start on the same line so the row reads as one baseline,
          regardless of how many lines each side runs to. */}
      <div className="shell relative z-10 grid items-start gap-10 lg:grid-cols-[1fr_1.25fr_1fr] lg:gap-[18px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-120px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="order-2 lg:order-1 lg:pt-[6vh]"
        >
          <p className="label-voice text-[10px]">{serial}</p>
          <h2 className="mt-6 text-[clamp(2.2rem,4.6vw,2.9rem)] leading-[0.9] uppercase">
            {heading}
          </h2>
        </motion.div>

        {/* The object gets the middle column and the tallest box on the row. */}
        {/* min-w-0 keeps the renderer's intrinsic size from widening the grid track. */}
        <div className="order-1 h-[42vh] w-full min-w-0 lg:order-2 lg:h-[56vh]">{object}</div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-120px' }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="order-3 lg:pt-[6vh]"
        >
          {/* The system's only mixed-case voice: description, not label. */}
          <p className="text-[clamp(1.05rem,1.6vw,1.35rem)] leading-[1.26] text-mist">{body}</p>
          {footnote ? <p className="label-voice mt-8 text-[10px]">{footnote}</p> : null}
        </motion.div>
      </div>
    </section>
  )
}
