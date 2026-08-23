import { LineReveal, Reveal } from './ui/Primitives'

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
  return (
    <section id="faq" aria-label="Perguntas frequentes" className="relative z-10 py-24 md:py-32">
      <div className="shell">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <LineReveal text={'Perguntas\nfrequentes'} className="text-[clamp(2.2rem,4.6vw,3.6rem)]" />
            <Reveal delay={0.12}>
              <p className="mt-6 max-w-sm text-ash">
                O que todo mundo pergunta no primeiro contato. Ficou faltando alguma?{' '}
                <a href="#contato" className="text-ivory underline underline-offset-4 hover:text-white">
                  Fala com a gente.
                </a>
              </p>
            </Reveal>
          </div>

          <div className="flex flex-col gap-3">
            {faqs.map((faq, index) => (
              <Reveal key={faq.question} delay={0.05 * index}>
                <details className="group graphite-card !p-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 p-6 text-[1.05rem] font-[480] text-ivory [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-45"
                    >
                      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  </summary>
                  <p className="px-6 pb-6 text-[15px] leading-[1.6] text-ash">{faq.answer}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
