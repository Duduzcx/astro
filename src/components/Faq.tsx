import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { WordReveal, Reveal } from './ui/Primitives'

/** Answers grounded in the real deliverables annex — prices land in the proposal, not here. */
const faqs = [
  {
    question: 'Quanto custa um projeto?',
    answer:
      'Depende do escopo. O diagnóstico é gratuito e sai com uma proposta fechada: preço, prazo e marcos de pagamento atrelados às fases do projeto — sem surpresa no meio do caminho.',
  },
  {
    question: 'Como funciona o projeto?',
    answer:
      'Cinco fases claras: descoberta, design aprovado no Figma, desenvolvimento com ambiente de homologação, bateria de testes e lançamento com transferência total pro seu nome.',
  },
  {
    question: 'O código é meu?',
    answer:
      'Sim, 100%. Repositório com acesso de administrador, chaves e acessos no seu nome e Termo de Cessão de Propriedade Intelectual formalizando tudo. Zero dependência da gente.',
  },
  {
    question: 'E depois do lançamento?',
    answer:
      'Todo projeto sai com garantia técnica de 30 a 90 dias definida em contrato. Depois, suporte e evolução contínua são opcionais — você recebe treinamento e documentação pra operar sozinho.',
  },
  {
    question: 'Que horário vocês atendem?',
    answer:
      'Atendimento 24h: a equipe responde das 8h às 21h, e fora desse horário um assistente de IA registra e resolve o que der — quando você acordar, já tem resposta.',
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
                    'Atendimento 24h — equipe + IA de plantão',
                    'Garantia técnica de 30 a 90 dias em contrato',
                    'Código 100% no seu nome, sem aluguel',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-[14px] text-ash">
                      <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5 shrink-0">
                        <path d="M6 1.5 10.5 10.5H1.5L6 1.5Z" fill="none" stroke="#c9a0ff" strokeWidth="1.4" />
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
                        <span className="mr-3 font-mono text-[13px] text-[#c9a0ff]">
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
