import { motion } from 'framer-motion'
import { OrbitField } from './OrbitField'
import { ArrowGlyph, NebulaButton, SolidButton } from './ui/Primitives'

const rise = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
}

export function Hero() {
  return (
    <section
      id="topo"
      className="relative flex min-h-[100svh] items-center overflow-hidden pt-28 pb-20"
    >
      <OrbitField className="pointer-events-none absolute inset-0 h-full w-full" />
      {/* Fades the shell into the canvas so the section below starts on flat color. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-b from-transparent to-void" />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="shell relative z-10"
      >
        <motion.div variants={rise} className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5aa9ff]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate">
            Astro · Engenharia de software sob medida
          </span>
        </motion.div>

        <motion.h1
          variants={rise}
          className="mt-8 max-w-4xl text-[clamp(2.6rem,7.5vw,5.4rem)] leading-[0.98]"
        >
          A gente constrói a tecnologia que a sua empresa ainda faz na mão.
        </motion.h1>

        <motion.p variants={rise} className="mt-8 max-w-xl text-lg text-silver">
          Sites, sistemas web, automações, integrações e produtos SaaS. Você descreve o problema,
          a Astro entrega o software rodando em produção — com código seu, sem amarra de
          plataforma.
        </motion.p>

        <motion.div variants={rise} className="mt-11 flex flex-wrap items-center gap-4">
          <NebulaButton href="#contato">
            Agendar diagnóstico <ArrowGlyph />
          </NebulaButton>
          <SolidButton href="#servicos">Ver o que fazemos</SolidButton>
        </motion.div>

        <motion.dl
          variants={rise}
          className="mt-20 grid max-w-2xl grid-cols-2 gap-8 border-t border-slate/25 pt-8 sm:grid-cols-3"
        >
          {[
            { value: '2 semanas', label: 'até a primeira entrega em produção' },
            { value: '100%', label: 'do código-fonte é seu, desde o dia um' },
            { value: '0 lock-in', label: 'stack aberta, hospedagem onde você quiser' },
          ].map((item) => (
            <div key={item.value}>
              <dt className="text-2xl text-phosphor">{item.value}</dt>
              <dd className="mt-2 font-mono text-[11px] leading-relaxed tracking-[0.06em] text-slate">
                {item.label}
              </dd>
            </div>
          ))}
        </motion.dl>
      </motion.div>
    </section>
  )
}
