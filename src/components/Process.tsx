import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { GiantWord, Label, Reveal, WordReveal } from './ui/Primitives'

/** As cinco fases do documento de entregáveis. Os marcos de pagamento seguem elas. */
const steps = [
  {
    number: '01',
    title: 'Descoberta & Planejamento',
    body: 'Levantamento de requisitos, definição de escopo, arquitetura da solução e aprovação do cronograma. Marco inicial do projeto.',
  },
  {
    number: '02',
    title: 'Design UI/UX',
    body: 'Protótipo de alta fidelidade no Figma e fluxos de navegação. Você aprova o visual antes da primeira linha de código.',
  },
  {
    number: '03',
    title: 'Desenvolvimento',
    body: 'Construção em ciclos, com ambiente de homologação pra você acompanhar cada funcionalidade conforme fica pronta.',
  },
  {
    number: '04',
    title: 'Testes & Homologação',
    body: 'Bateria de testes em navegadores e dispositivos, correções e validação conjunta antes de qualquer lançamento.',
  },
  {
    number: '05',
    title: 'Lançamento & Transferência',
    body: 'Deploy em produção, migração de acessos e faturamento pro seu nome, Termo de Aceite e início da garantia técnica.',
  },
] as const

function StepCard({ step }: { step: (typeof steps)[number] }) {
  return (
    <article className="graphite-card relative h-full w-full overflow-hidden">
      <span
        aria-hidden="true"
        className="giant-outline pointer-events-none absolute -top-5 -right-3 text-[7rem] leading-none"
      >
        {step.number}
      </span>
      <span className="text-spectrum-animated block text-[13px] font-[480] tracking-[0.08em]">
        {step.number}
      </span>
      <h3 className="mt-4 text-[1.4rem]">{step.title}</h3>
      <p className="mt-3 max-w-[38ch] text-[15px] leading-[1.55] text-ash">{step.body}</p>
    </article>
  )
}

/**
 * A seção trava e os cards andam na horizontal conforme o scroll vertical.
 * Cai para uma grade simples em reduced-motion.
 */
export function Process() {
  const ref = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  /* Decidido no PRIMEIRO render: se o branch travado só aparecesse depois de
     um efeito, o useScroll inicializaria com target nulo e a trilha nunca
     andaria. Trava em qualquer largura; só reduced-motion cai para a grade. */
  const [pinned, setPinned] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [shift, setShift] = useState(1100)

  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPinned(!still.matches)
    still.addEventListener('change', update)
    return () => still.removeEventListener('change', update)
  }, [])

  /* Curso medido: largura da trilha menos a viewport, para o último card
     parar inteiro na tela em qualquer largura de aparelho. */
  useEffect(() => {
    const measure = () => {
      const track = trackRef.current
      if (!track) return
      setShift(Math.max(track.scrollWidth - window.innerWidth + 24, 0))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [pinned])

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const x = useTransform(scrollYProgress, [0.12, 0.92], [0, -shift])

  const header = (
    <>
      <Label>Como a gente trabalha</Label>
      <WordReveal
        text="Do primeiro café ao sistema no ar"
        className="font-impact mt-6 max-w-3xl text-[clamp(2.4rem,5.2vw,4.2rem)]"
      />
      <Reveal delay={0.12}>
        <p className="mt-5 max-w-md text-ash">
          Sem projeto de gaveta: escopo fechado, entregas quinzenais e o código no seu nome desde o
          primeiro dia.
        </p>
      </Reveal>
    </>
  )

  if (!pinned) {
    return (
      <section ref={ref} id="processo" aria-label="Processo" className="relative z-10 py-24 md:py-32">
        <div className="shell">
          {header}
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {steps.map((step, index) => (
              <Reveal key={step.number} delay={0.08 * index}>
                <StepCard step={step} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section ref={ref} id="processo" aria-label="Processo" className="relative z-10 h-[260vh]">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <GiantWord word="Processo" className="opacity-60" />
        <div className="shell relative">{header}</div>
        <motion.div
          ref={trackRef}
          style={{ x }}
          className="mt-10 flex w-max gap-6 pl-[max(24px,calc((100vw-1200px)/2+48px))] md:mt-12"
        >
          {steps.map((step) => (
            <div key={step.number} className="w-[300px] shrink-0 md:w-[380px]">
              <StepCard step={step} />
            </div>
          ))}
          <div className="graphite-card flex w-[300px] shrink-0 items-center justify-center bg-cobalt/10">
            <p className="font-impact text-center text-[1.6rem] leading-[1.1] text-ivory">
              Pronto pra
              <br />
              começar?
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
