import { LineReveal, Reveal } from './ui/Primitives'

/** Invented case studies — one headline metric each, plainly told. */
const cases = [
  {
    client: 'Vetra Logística',
    metric: '-38%',
    metricLabel: 'custo por entrega',
    body: 'Roteirização automática integrada ao ERP. O que era uma manhã de planilha virou um clique às 6h da manhã — rota pronta antes do primeiro caminhão sair.',
  },
  {
    client: 'Clínica Áurea',
    metric: '3×',
    metricLabel: 'mais agendamentos',
    body: 'Portal do paciente e bot de agenda no WhatsApp. 70% das marcações acontecem fora do horário comercial, sem tocar na recepção.',
  },
  {
    client: 'Mercado Bonfim',
    metric: '+52%',
    metricLabel: 'receita online',
    body: 'E-commerce ligado ao estoque físico em tempo real. Acabou a venda de produto em falta — e o catálogo se atualiza sozinho.',
  },
] as const

export function Cases() {
  return (
    <section id="resultados" aria-label="Resultados" className="relative z-10 py-24 md:py-32">
      <div className="shell">
        <LineReveal text="Resultados medidos" className="max-w-2xl text-[clamp(2.2rem,4.6vw,3.6rem)]" />
        <Reveal delay={0.12}>
          <p className="mt-6 max-w-md text-ash">
            Todo projeto começa com uma métrica combinada. Estes são três números que a gente
            entregou.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {cases.map((item, index) => (
            <Reveal key={item.client} delay={0.08 * index}>
              <article className="graphite-card h-full">
                <p className="text-[13px] font-[480] tracking-[0.08em] text-slate uppercase">
                  {item.client}
                </p>
                <p className="mt-5 text-[3rem] leading-none font-[480] tracking-[-0.01em] text-ivory">
                  {item.metric}
                </p>
                <p className="mt-1 text-[14px] text-cobalt">{item.metricLabel}</p>
                <p className="mt-5 text-[15px] leading-[1.55] text-ash">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
