import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Reveal, Section, SectionHead } from './ui/Primitives'

const faqs = [
  {
    question: 'Quanto custa um projeto?',
    answer:
      'Depende do escopo, e por isso o diagnóstico existe. Saímos daquela conversa com preço fechado por projeto — não cobramos por hora e não mandamos orçamento aberto que cresce no meio do caminho.',
  },
  {
    question: 'Em quanto tempo fica pronto?',
    answer:
      'A primeira versão útil vai ao ar em cerca de duas semanas depois do blueprint. Projetos maiores continuam em entregas quinzenais, sempre com algo funcionando ao final de cada ciclo.',
  },
  {
    question: 'O código fica comigo?',
    answer:
      'Sim. O repositório é seu desde o primeiro commit, hospedado na sua conta. Você pode levar o projeto para outro time a qualquer momento, sem pedir autorização e sem multa.',
  },
  {
    question: 'Já tenho um sistema. Dá para integrar em vez de trocar tudo?',
    answer:
      'Quase sempre é o melhor caminho. Se o que você tem funciona, construímos em volta: integração, automação e as telas que faltam. Trocar o sistema inteiro é a última opção, não a primeira.',
  },
  {
    question: 'E depois que entra no ar, quem cuida?',
    answer:
      'A gente. O plano de órbita cobre monitoramento, backup, correção de falha e ajustes conforme a operação muda. Você também pode assumir a manutenção com o próprio time — o projeto vai documentado.',
  },
  {
    question: 'Vocês atendem fora de São Paulo?',
    answer:
      'Sim, trabalhamos remoto com clientes de qualquer estado. Reuniões por vídeo, entregas em ambiente de teste e acesso ao progresso a qualquer hora.',
  },
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <Section id="duvidas">
      <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHead
          label="Dúvidas"
          title="O que perguntam antes de fechar."
          className="lg:sticky lg:top-32 lg:self-start"
        />

        <Reveal>
          <ul className="border-t border-slate/25">
            {faqs.map((faq, index) => {
              const isOpen = open === index
              return (
                <li key={faq.question} className="border-b border-slate/25">
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      className="flex w-full items-start justify-between gap-6 py-6 text-left text-lg font-medium text-platinum transition-colors hover:text-mist"
                    >
                      {faq.question}
                      <svg
                        viewBox="0 0 14 14"
                        aria-hidden="true"
                        className={`mt-2 h-3.5 w-3.5 shrink-0 transition-transform duration-300 ${
                          isOpen ? 'rotate-45' : ''
                        }`}
                      >
                        <path d="M7 0v14M0 7h14" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-2xl pb-7 text-silver">{faq.answer}</p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>
        </Reveal>
      </div>
    </Section>
  )
}
