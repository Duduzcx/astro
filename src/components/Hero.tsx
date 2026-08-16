import { motion } from 'framer-motion'
import { OrbitField } from './OrbitField'
import { TerminalScene } from './scenes/TerminalScene'
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
      {/* The orb sits behind the right column, not behind the headline. */}
      <OrbitField className="pointer-events-none absolute -top-[8%] right-[-30%] h-[125%] w-[110%] opacity-80 lg:right-[-14%] lg:w-[72%]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-void" />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="shell relative z-10 grid min-h-[100svh] grid-cols-1 items-center gap-12 pt-32 pb-16 lg:grid-cols-12 lg:gap-10"
      >
        <div className="lg:col-span-7">
          <motion.p variants={rise} className="label-voice flex items-center gap-3 text-[11px]">
            <span className="h-1.5 w-1.5 animate-[astro-pulse_2s_ease-in-out_infinite] rounded-full bg-[#5aa9ff]" />
            Engenharia de software sob medida
          </motion.p>

          <motion.h1
            variants={rise}
            className="mt-6 text-[clamp(3.2rem,9vw,7rem)] leading-[0.86] uppercase"
          >
            Astro
          </motion.h1>

          <motion.p
            variants={rise}
            className="mt-7 max-w-xl text-[clamp(1.05rem,1.7vw,1.35rem)] leading-[1.3] text-mist"
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

          {/* Telemetry strip: four facts on one baseline, dashed rule above. */}
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

        <motion.div variants={rise} className="lg:col-span-5">
          <TerminalScene />
          <p className="label-voice mt-4 text-[9px]">
            Deploy real de um projeto Astro · reproduzido em loop
          </p>
        </motion.div>
      </motion.div>
    </section>
  )
}
