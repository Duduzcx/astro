import { motion } from 'framer-motion'
import { OrbitField } from './OrbitField'
import { ArrowGlyph, NebulaButton, GhostButton } from './ui/Primitives'

const rise = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.2 } },
}

export function Hero() {
  return (
    <section id="topo" className="relative min-h-[100svh] overflow-hidden">
      <OrbitField className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-void" />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="shell relative z-10 flex min-h-[100svh] flex-col justify-between pt-32 pb-12"
      >
        <div>
          <motion.p variants={rise} className="label-voice text-[11px]">
            Engenharia de software sob medida
          </motion.p>
          {/* Wordmark as the hero object: display scale, line-height 0.9, stacked as form. */}
          <motion.h1
            variants={rise}
            className="mt-5 text-[clamp(4rem,17vw,13rem)] leading-[0.86] uppercase"
          >
            Astro
          </motion.h1>
          <motion.p
            variants={rise}
            className="mt-8 max-w-md text-[clamp(1.05rem,1.8vw,1.35rem)] leading-[1.26] text-mist"
          >
            A gente constrói a tecnologia que a sua empresa ainda faz na mão. Sites, sistemas,
            automações, integrações e produtos SaaS — no ar, com código seu.
          </motion.p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.15fr_auto] lg:items-end">
          {/* Attribution card: uppercase heading, dashed divider, mixed-case body. */}
          <motion.div
            variants={rise}
            className="max-w-lg rounded-[12px] border border-slate/30 bg-deep/70 p-6 backdrop-blur-md"
          >
            <p className="text-[13px] leading-[1.2] uppercase">
              Estúdio de engenharia com base em São Paulo, atendendo o Brasil inteiro.
            </p>
            <hr className="dashed-rule my-5" />
            <p className="text-[15px] leading-[1.4] text-silver">
              Você descreve o problema. A gente entrega o software rodando — sem amarra de
              plataforma e sem depender da gente para sempre.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <NebulaButton href="#contato">
                Agendar diagnóstico <ArrowGlyph />
              </NebulaButton>
              <GhostButton href="#sistema">Ver o sistema</GhostButton>
            </div>
          </motion.div>

          <motion.div
            variants={rise}
            className="flex w-fit items-center gap-4 rounded-[12px] border border-slate/30 bg-deep/70 p-3 pr-6 backdrop-blur-md"
          >
            {/* Second, quieter instance of the same object — a live readout, not a video still. */}
            <OrbitField
              className="h-16 w-16 shrink-0"
              points={260}
              satelliteCount={2}
              glow={false}
            />
            <div>
              <p className="text-[11px] leading-[1.2] uppercase">Sinal ativo</p>
              <p className="label-voice mt-1.5 text-[9px]">Astro · 001 · São Paulo</p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
