import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { WordReveal, Reveal } from './ui/Primitives'

/** Invented answers with realistic ranges — adjust to the real practice. */
const faqs = [
  {
    question: 'Quanto custa um projeto?',
    answer:
      'Depende do escopo. Automações e integrações pontuais partem de R$ 6 mil; sistemas completos costumam ficar entre R$ 25 mil e R$ 80 mil. O diagnóstico é gratuito e sai com uma estimativa fechada.',
  },
  {
    question: 'Quanto tempo leva?',
    answer:
      'A primeira entrega em produção acontece em até 14 dias. Projetos completos rodam em sprints quinzenais — a maioria fecha entre 6 e 12 semanas.',
  },
  {
    question: 'O código é meu?',
    answer:
      'Sim, 100%. Repositório no seu nome desde o primeiro commit, documentação incluída, zero lock-in. Se um dia quiser seguir com outro time, é só seguir.',
  },
  {
    question: 'E depois do lançamento?',
    answer:
      'Todo projeto sai com 30 dias de garantia. Depois, planos de evolução contínua a partir de R$ 1,5 mil/mês — monitoramento, correções e melhorias priorizadas com você.',
  },
  {
    question: 'Com que tecnologias vocês trabalham?',
    answer:
      'React, TypeScript e Node no produto; Postgres nos dados; integrações com ERPs, CRMs, WhatsApp Business e o que a sua operação já usa. Escolhemos ferramenta pelo problema, não pela moda.',
  },
] as const

export function Faq() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq" aria-label="Perguntas frequentes" className="relative z-10 py-24 md:py-32">
      <div className="shell">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <WordReveal text={'Perguntas\nfrequentes'} className="font-impact text-[clamp(2.4rem,5.2vw,4.2rem)]" />
            <Reveal delay={0.12}>
              <p className="mt-6 max-w-sm text-ash">
                O que todo mundo pergunta no primeiro contato. Ficou faltando alguma?{' '}
                <a href="#contato" className="text-ivory underline underline-offset-4 hover:text-white">
                  Fala com a gente.
                </a>
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="graphite-card mt-10 max-w-sm">
                <p className="label-voice text-[10px]">Sem letra miúda</p>
                <ul className="mt-4 flex flex-col gap-3">
                  {[
                    'Resposta em até 1 dia útil',
                    '30 dias de garantia em toda entrega',
                    'Código 100% no seu nome, sem aluguel',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-[14px] text-ash">
                      <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5 shrink-0">
                        <path d="M6 1.5 10.5 10.5H1.5L6 1.5Z" fill="none" stroke="#4dd6e8" strokeWidth="1.4" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          <div className="flex flex-col gap-3">
            {faqs.map((faq, index) => {
              const isOpen = open === index
              return (
                <Reveal key={faq.question} delay={0.05 * index}>
                  <div className="graphite-card !p-0">
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${index}`}
                      className="flex w-full cursor-pointer items-center justify-between gap-6 p-6 text-left text-[1.05rem] font-[480] text-ivory"
                    >
                      <span>
                        <span className="mr-3 font-mono text-[13px] text-[#4dd6e8]">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        {faq.question}
                      </span>
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
                      >
                        <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.4" />
                      </svg>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen ? (
                        <motion.div
                          id={`faq-panel-${index}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="px-6 pb-6 text-[15px] leading-[1.6] text-ash">{faq.answer}</p>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
