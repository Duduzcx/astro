import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowGlyph, GhostButton, IrisButton, Label, RotatingWord, WordReveal } from './ui/Primitives'
import { AstroMark } from './brand/AstroMark'

const rise = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0 },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.9 } },
}

/**
 * Desktop: título gigante à esquerda; a metade direita é do objeto de
 * partículas, que o TriScene desenha atrás da página.
 *
 * Celular: a cena 3D não monta (ver App.tsx). O vão entre o menu e o título é
 * do símbolo da marca em vetor, nítido em qualquer densidade de tela, e o texto
 * fica no pé da dobra. Nada passa por trás do texto.
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
        className="relative z-10 flex min-h-[100svh] flex-col pt-24 pb-10 lg:justify-center lg:pt-28 lg:pb-16"
      >
        {/* Símbolo no vão entre o menu e o título, só abaixo de lg. A faixa
            ocupa o que sobra da dobra e nunca empurra o texto para baixo: os
            filhos são absolutos, e o SVG se encaixa na caixa pelo viewBox
            (comportamento "contain" nativo do SVG). */}
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative min-h-[7rem] flex-1 lg:hidden"
        >
          <div className="absolute top-1/2 left-1/2 aspect-square w-[min(130vw,60rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(77,132,224,0.24),transparent_72%)]" />
          <AstroMark
            tight
            className="absolute top-3 left-6 h-[calc(100%-1.5rem)] w-[calc(100%-3rem)] animate-[astro-float_7s_ease-in-out_infinite] [filter:drop-shadow(0_0_28px_rgba(141,180,245,0.32))]"
          />
        </motion.div>

        <motion.div variants={stagger} initial="hidden" animate="show" className="shell w-full">
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
            className="mt-4 max-w-md text-[clamp(1rem,1.4vw,1.2rem)] leading-[1.55] text-ash"
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
