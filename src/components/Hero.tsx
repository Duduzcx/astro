import { motion } from 'framer-motion'
import { Aurora } from './scenes/Aurora'
import { PlanetStage } from './PlanetStage'
import { ArrowGlyph, GhostButton, NebulaButton } from './ui/Primitives'

const rise = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
}

const telemetry = [
  { label: 'Primeira entrega', value: '14 dias' },
  { label: 'Ciclo de release', value: '2 semanas' },
  { label: 'Código-fonte', value: '100% seu' },
  { label: 'Lock-in', value: 'nenhum' },
]

export function Hero() {
  return (
    <section id="topo" className="relative overflow-hidden">
      <Aurora className="pointer-events-none absolute inset-0 h-full w-full" intensity={0.55} />
      {/* Darkens the left half so the copy keeps its contrast over the colour field. */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,#030a1ce6_0%,#030a1c99_38%,transparent_72%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-void" />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="shell relative z-10 grid min-h-[100svh] grid-cols-1 items-center gap-8 pt-28 pb-16 lg:grid-cols-12 lg:gap-8"
      >
        <div className="lg:col-span-6">
          <motion.p variants={rise} className="label-voice flex items-center gap-3 text-[11px]">
            <span className="h-1.5 w-1.5 animate-[astro-pulse_2s_ease-in-out_infinite] rounded-full bg-[#4de0ff]" />
            Engenharia de software sob medida
          </motion.p>

          <motion.h1
            variants={rise}
            className="mt-6 text-[clamp(3.2rem,8.5vw,6.5rem)] leading-[0.86] uppercase"
          >
            Astro
          </motion.h1>

          <motion.p
            variants={rise}
            className="mt-7 max-w-lg text-[clamp(1.05rem,1.7vw,1.35rem)] leading-[1.3] text-mist"
          >
            A gente constrói a tecnologia que a sua empresa ainda faz na mão. Sites, sistemas,
            automações, integrações e produtos SaaS — no ar, com código seu.
          </motion.p>

          <motion.div variants={rise} className="mt-9 flex flex-wrap items-center gap-3">
            <NebulaButton href="#contato">
              Agendar diagnóstico <ArrowGlyph />
            </NebulaButton>
            <GhostButton href="#sistema">Ver o sistema</GhostButton>
          </motion.div>

          <motion.dl
            variants={rise}
            className="mt-14 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-dashed border-slate/45 pt-7 sm:grid-cols-4"
          >
            {telemetry.map((item) => (
              <div key={item.label}>
                <dt className="label-voice text-[9px]">{item.label}</dt>
                <dd className="mt-2 text-[1.1rem] leading-none text-phosphor uppercase">
                  {item.value}
                </dd>
              </div>
            ))}
          </motion.dl>
        </div>

        {/* The object leads. It is the first thing the page shows and the last thing
            anyone forgets about it. */}
        <motion.div
          variants={rise}
          className="relative min-w-0 lg:col-span-6 lg:-mr-[6vw]"
        >
          <PlanetStage className="h-[42vh] w-full lg:h-[74vh]" />
        </motion.div>
      </motion.div>
    </section>
  )
}
