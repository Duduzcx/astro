import { AnimatedNumber, Reveal, WordReveal } from './ui/Primitives'

/** Invented case studies: pain → build → number, plus the stack that shipped it. */
const cases = [
  {
    client: 'Vetra Logística',
    metric: '-38%',
    metricLabel: 'custo por entrega',
    problem: 'Rotas montadas à mão numa planilha que só um analista sabia operar.',
    solution: 'Roteirização automática integrada ao ERP, com app simples pro motorista.',
    result: 'Rota pronta às 6h da manhã, antes do primeiro caminhão sair do pátio.',
    tech: ['Node.js', 'Postgres', 'AWS', 'React Native'],
  },
  {
    client: 'Clínica Áurea',
    metric: '3×',
    metricLabel: 'mais agendamentos',
    problem: 'Recepção afogada em ligações; paciente desistia antes de conseguir marcar.',
    solution: 'Portal do paciente e bot de agenda no WhatsApp, ligados ao prontuário.',
    result: '70% das marcações acontecem fora do horário comercial, sozinhas.',
    tech: ['Next.js', 'WhatsApp API', 'Postgres'],
  },
  {
    client: 'Mercado Bonfim',
    metric: '+52%',
    metricLabel: 'receita online',
    problem: 'Loja online vendia produto em falta e o estoque físico nunca batia.',
    solution: 'E-commerce ligado ao estoque em tempo real, com catálogo que se atualiza só.',
    result: 'Acabou a venda furada — e o time parou de conferir estoque de madrugada.',
    tech: ['React', 'Tailwind', 'Node.js', 'Redis'],
  },
] as const

export function Cases() {
  return (
    <section id="resultados" aria-label="Resultados" className="relative z-10 py-24 md:py-32">
      <div className="shell">
        <WordReveal text="Resultados medidos" className="max-w-2xl text-[clamp(2.2rem,4.6vw,3.6rem)]" />
        <Reveal delay={0.12}>
          <p className="mt-6 max-w-md text-ash">
            Todo projeto começa com uma métrica combinada. Três histórias completas: a dor, o que a
            gente construiu e o número que ficou.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {cases.map((item, index) => (
            <Reveal key={item.client} delay={0.08 * index}>
              <article className="graphite-card flex h-full flex-col">
                <p className="text-[13px] font-[480] tracking-[0.08em] text-slate uppercase">
                  {item.client}
                </p>
                <p className="text-spectrum-animated mt-5 text-[3rem] leading-none font-[480] tracking-[-0.01em]">
                  <AnimatedNumber value={item.metric} />
                </p>
                <p className="mt-1 text-[14px] text-ivory">{item.metricLabel}</p>

                <dl className="mt-6 flex flex-col gap-4 text-[14px] leading-[1.55]">
                  <div>
                    <dt className="label-voice text-[10px]">O problema</dt>
                    <dd className="mt-1.5 text-ash">{item.problem}</dd>
                  </div>
                  <div>
                    <dt className="label-voice text-[10px]">A solução</dt>
                    <dd className="mt-1.5 text-ash">{item.solution}</dd>
                  </div>
                  <div>
                    <dt className="label-voice text-[10px]">O resultado</dt>
                    <dd className="mt-1.5 text-ash">{item.result}</dd>
                  </div>
                </dl>

                <ul className="mt-auto flex flex-wrap gap-2 pt-6">
                  {item.tech.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-obsidian px-3 py-1 text-[11px] text-slate"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
