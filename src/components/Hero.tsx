import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowGlyph, GhostButton, IrisButton, Label, LineReveal } from './ui/Primitives'

const rise = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0 },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.9 } },
}

/**
 * Dala layout, Mercury voice: giant headline left, the particle sphere (drawn
 * by TriScene behind the page) owns the right half. Eyebrow below the
 * headline, then body, then the single cobalt pill plus a ghost secondary.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '-16%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])

  return (
    <section ref={ref} id="topo" className="relative min-h-[100svh] overflow-hidden">
      <div className="aurora" aria-hidden="true" />
      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 flex min-h-[100svh] items-center pt-28 pb-16"
      >
        <motion.div variants={stagger} initial="hidden" animate="show" className="shell w-full">
          <LineReveal
            as="h1"
            trigger="mount"
            delay={0.35}
            text={'Destrave a\nsua operação.'}
            className="max-w-4xl text-[clamp(3.2rem,9vw,7.5rem)] leading-[0.98]"
          />

          <motion.div variants={rise} className="mt-9">
            <Label>Pare de operar no manual. Comece a escalar.</Label>
          </motion.div>

          <motion.p
            variants={rise}
            className="mt-4 max-w-md text-[clamp(1.05rem,1.4vw,1.2rem)] leading-[1.55] text-ash"
          >
            A Astro Bot constrói sistemas, sites, automações e integrações sob medida. Conecte tudo
            que a sua empresa usa e deixe o software trabalhar — com contexto, controle e clareza.
          </motion.p>

          <motion.div variants={rise} className="mt-10 flex flex-wrap items-center gap-4">
            <IrisButton href="#contato">
              Agendar diagnóstico <ArrowGlyph />
            </IrisButton>
            <GhostButton href="#servicos">Conhecer os serviços</GhostButton>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  )
}
