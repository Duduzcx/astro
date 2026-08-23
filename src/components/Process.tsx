import { motion } from 'framer-motion'
import { WordReveal, Reveal } from './ui/Primitives'

/** Numbered because it IS a sequence — this is the actual order of an engagement. */
const steps = [
  {
    number: '01',
    title: 'Diagnóstico',
    body: 'Uma conversa de 45 minutos. Mapeamos o processo, os sistemas atuais e onde o tempo se perde. Gratuito e sem compromisso.',
  },
  {
    number: '02',
    title: 'Proposta',
    body: 'Escopo fechado com preço e prazo. Você sabe o que recebe, quando recebe e quanto custa — antes de assinar qualquer coisa.',
  },
  {
    number: '03',
    title: 'Sprints',
    body: 'Entregas a cada duas semanas, direto em produção. Você acompanha o avanço de perto e ajusta a rota com a gente.',
  },
  {
    number: '04',
    title: 'Evolução',
    body: 'Depois do lançamento: monitoramento, correções e melhorias contínuas. O sistema cresce junto com a operação.',
  },
] as const

/** Mercury card language: graphite surface, 12px radius, no border, no shadow. */
export function Process() {
  return (
    <section id="processo" aria-label="Processo" className="relative z-10 py-24 md:py-32">
      <div className="shell">
        <WordReveal text="Como a gente trabalha" className="max-w-2xl text-[clamp(2.2rem,4.6vw,3.6rem)]" />
        <Reveal delay={0.12}>
          <p className="mt-6 max-w-md text-ash">
            Sem projeto de gaveta: escopo fechado, entregas quinzenais e o código no seu nome desde
            o primeiro commit.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Reveal key={step.number} delay={0.08 * index}>
              <article className="graphite-card h-full">
                {/* The step line draws itself in sequence — the pipeline filling up. */}
                <motion.span
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.7, delay: 0.15 + 0.14 * index, ease: [0.22, 1, 0.36, 1] }}
                  className="block h-0.5 w-full origin-left rounded-full bg-gradient-to-r from-cobalt to-[#4dd6e8]"
                  aria-hidden="true"
                />
                <span className="text-spectrum-animated mt-5 block text-[13px] font-[480] tracking-[0.08em]">
                  {step.number}
                </span>
                <h3 className="mt-4 text-[1.4rem]">{step.title}</h3>
                <p className="mt-3 text-[15px] leading-[1.55] text-ash">{step.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
