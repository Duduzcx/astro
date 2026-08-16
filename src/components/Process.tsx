import { Reveal, Section, SectionHead } from './ui/Primitives'

/** Numbered because the order is real: no step starts before the one above it lands. */
const steps = [
  {
    id: '01',
    title: 'Diagnóstico',
    duration: '1 conversa, 45 min',
    body: 'Entendemos a operação, o gargalo e o que já existe. Você sai com escopo, prazo e preço fechados — ou com a resposta honesta de que não precisa de software para isso.',
  },
  {
    id: '02',
    title: 'Blueprint',
    duration: '3 a 5 dias',
    body: 'Fluxos, telas e modelo de dados no papel antes de qualquer linha de código. É aqui que mudança custa barato.',
  },
  {
    id: '03',
    title: 'Construção',
    duration: 'entregas a cada 2 semanas',
    body: 'Você acompanha o sistema crescendo em ambiente real, testa e corrige o rumo no meio do caminho. Nada de sumir por três meses e voltar com surpresa.',
  },
  {
    id: '04',
    title: 'Órbita',
    duration: 'contínuo',
    body: 'No ar, com monitoramento, backup e suporte. A gente continua evoluindo o produto conforme a operação muda.',
  },
]

export function Process() {
  return (
    <Section id="processo" className="bg-deep">
      <SectionHead
        label="Como trabalhamos"
        title="Quatro etapas, nessa ordem."
        lead="Software atrasa quando ninguém combinou o que era para ser feito. Nosso processo gasta tempo no começo justamente para não gastar depois."
      />

      <ol className="mt-16 border-t border-slate/25">
        {steps.map((step, index) => (
          <li key={step.id} className="border-b border-slate/25">
            <Reveal
              delay={index * 0.06}
              className="grid gap-6 py-10 md:grid-cols-[auto_1fr_1.4fr] md:items-start md:gap-12"
            >
              <span className="font-mono text-[11px] tracking-[0.16em] text-slate md:pt-2">
                {step.id}
              </span>
              <div>
                <h3 className="text-3xl">{step.title}</h3>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[#5aa9ff]">
                  {step.duration}
                </p>
              </div>
              <p className="text-silver md:pt-2">{step.body}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  )
}
