import type { ReactNode } from 'react'
import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Label, LineReveal } from './ui/Primitives'

/**
 * Two-column composition: text on one side, object on the other. `flip` alternates
 * the sides down the page so consecutive sections never repeat the same reading
 * path. The object drifts against the scroll, which is what keeps it feeling
 * placed in space rather than pasted on the page.
 */
export function VoidReveal({
  id,
  label,
  heading,
  body,
  footnote,
  object,
  flip = false,
}: {
  id?: string
  label: string
  heading: string
  body: string
  footnote?: string
  object: ReactNode
  flip?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const objectY = useTransform(scrollYProgress, [0, 1], ['12%', '-12%'])

  return (
    <section ref={ref} id={id} className="relative overflow-hidden py-24 md:py-32">
      <div className="shell grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div className={flip ? 'lg:order-2' : ''}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-15%' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <Label>{label}</Label>
          </motion.div>

          <LineReveal
            text={heading}
            delay={0.08}
            className="mt-7 text-[clamp(2.4rem,5.2vw,4.2rem)] leading-[1.04]"
          />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-15%' }}
            transition={{ duration: 0.8, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 max-w-lg text-[clamp(1rem,1.35vw,1.125rem)] leading-[1.5] text-silver"
          >
            {body}
          </motion.p>

          {footnote ? (
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: '-15%' }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="label-voice mt-10 text-[10px]"
            >
              {footnote}
            </motion.p>
          ) : null}
        </div>

        <motion.div
          style={{ y: objectY }}
          className={`h-[46vh] w-full min-w-0 lg:h-[64vh] ${flip ? 'lg:order-1' : ''}`}
        >
          {object}
        </motion.div>
      </div>
    </section>
  )
}
