import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { VideoPlate } from './scenes/VideoPlate'
import { ArrowGlyph, GhostButton, IrisButton, LineReveal } from './ui/Primitives'
import { media } from '../lib/media'

const rise = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0 },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.5 } },
}

const telemetry = [
  { label: 'Primeira entrega', value: '14 dias' },
  { label: 'Ciclo de release', value: '2 semanas' },
  { label: 'Código-fonte', value: '100% seu' },
  { label: 'Lock-in', value: 'nenhum' },
]

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  // The field sinks slower than the page: the type leaves, the footage stays a beat longer.
  const videoY = useTransform(scrollYProgress, [0, 1], ['0%', '18%'])
  const videoScale = useTransform(scrollYProgress, [0, 1], [1, 1.12])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '-14%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0])

  return (
    <section ref={ref} id="topo" className="relative min-h-[100svh] overflow-hidden">
      <motion.div style={{ y: videoY, scale: videoScale }} className="absolute inset-0">
        <VideoPlate src={media.particleWave} className="h-full w-full" />
      </motion.div>
      <div className="film-scrim pointer-events-none absolute inset-0" />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 flex min-h-[100svh] items-center pt-28 pb-16"
      >
        <motion.div variants={stagger} initial="hidden" animate="show" className="shell w-full">
          <motion.p
            variants={rise}
            className="flex items-center gap-3 font-mono text-[12px] font-medium tracking-[0.16em] text-amber uppercase"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber" />
            Engenharia de software sob medida
          </motion.p>

          <LineReveal
            as="h1"
            trigger="mount"
            delay={0.6}
            text={'A tecnologia que a sua\nempresa ainda faz na mão.'}
            className="mt-7 max-w-4xl text-[clamp(2.6rem,6.2vw,5.6rem)] leading-[1.02]"
          />

          <motion.p
            variants={rise}
            className="mt-8 max-w-lg text-[clamp(1.05rem,1.4vw,1.15rem)] leading-[1.5] text-silver"
          >
            Sites, sistemas, automações, integrações e produtos SaaS. Você descreve o problema, a
            Astro entrega o software rodando em produção — com o código no seu nome.
          </motion.p>

          <motion.div variants={rise} className="mt-11 flex flex-wrap items-center gap-8">
            <IrisButton href="#contato">
              Agendar diagnóstico <ArrowGlyph />
            </IrisButton>
            <GhostButton href="#sistema">Ver o sistema</GhostButton>
          </motion.div>

          <motion.dl
            variants={rise}
            className="mt-16 grid max-w-4xl grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-4"
          >
            {telemetry.map((item) => (
              <div key={item.label}>
                <dt className="font-mono text-[10px] tracking-[0.16em] text-ash uppercase">
                  {item.label}
                </dt>
                <dd className="mt-2.5 text-[1.3rem] leading-none tracking-[-0.02em] text-platinum">
                  {item.value}
                </dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>
      </motion.div>
    </section>
  )
}
