import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowGlyph, GhostButton, IrisButton, Label, RotatingWord, WordReveal } from './ui/Primitives'

const rise = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0 },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.9 } },
}

/**
 * Título gigante à esquerda; a metade direita é do objeto de partículas, que o
 * TriScene desenha atrás da página. Abaixo do título vêm o eyebrow, o texto e
 * os dois botões.
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
        className="relative z-10 flex min-h-[100svh] items-center pt-24 pb-10 lg:pt-28 lg:pb-16"
      >
        <motion.div
          id="hero-copy"
          variants={stagger}
          initial="hidden"
          animate="show"
          className="shell relative w-full"
        >
          {/* O objeto passa por trás do texto. Esta placa acompanha o bloco de
              texto, em vez de uma altura fixa de viewport, e é o que mantém o
              contraste em qualquer aparelho. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-16 -bottom-12 -z-10 bg-[radial-gradient(112%_72%_at_30%_50%,color-mix(in_srgb,var(--color-onyx)_58%,transparent)_0%,color-mix(in_srgb,var(--color-onyx)_30%,transparent)_58%,transparent_86%)] lg:hidden"
          />
          <WordReveal
            as="h1"
            trigger="mount"
            delay={0.35}
            text={'Destrave a\nsua operação.'}
            className="font-impact max-w-4xl text-[clamp(3.2rem,11vw,8.6rem)] leading-[0.95]"
          />

          <motion.div variants={rise} className="mt-6 lg:mt-9">
            <Label>Conectando seu negócio ao futuro</Label>
          </motion.div>

          <motion.p
            variants={rise}
            className="mt-4 max-w-md text-[clamp(1rem,1.4vw,1.2rem)] leading-[1.55] text-ash [text-shadow:0_1px_14px_rgba(10,15,30,0.95)] lg:[text-shadow:none]"
          >
            A Astro Soluções cria{' '}
            <RotatingWord words={['sites', 'sistemas', 'robôs', 'painéis', 'integrações']} /> que
            trabalham pela sua empresa. Sua equipe cuida dos clientes — o resto roda no automático.
          </motion.p>

          <motion.div variants={rise} className="mt-7 flex flex-wrap items-center gap-4 lg:mt-10">
            <IrisButton href="#contato">
              Agendar diagnóstico <ArrowGlyph />
            </IrisButton>
            <GhostButton href="#servicos">Conhecer os serviços</GhostButton>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Indicador de scroll: uma gota de luz descendo por um fio. */}
      <motion.a
        href="#servicos"
        aria-label="Rolar para os serviços"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.8 }}
        className="absolute bottom-7 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2.5 lg:flex"
      >
        <span className="font-mono text-[10px] tracking-[0.24em] text-slate uppercase">Role</span>
        <span className="relative block h-10 w-px overflow-hidden bg-white/10">
          <span className="absolute top-0 left-0 h-3.5 w-px bg-ivory/80 animate-[astro-drop_1.9s_ease-in-out_infinite]" />
        </span>
      </motion.a>
    </section>
  )
}
