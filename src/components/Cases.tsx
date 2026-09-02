import { AnimatedNumber, GiantWord, Reveal, WordReveal } from './ui/Primitives'

/**
 * Cenários por segmento, sem nome de cliente. Trocar por casos reais conforme
 * os contratos permitirem.
 */
const cases = [
  {
    client: 'Logística',
    metric: '-6h',
    metricLabel: 'de planilha por dia',
    problem: 'Rotas montadas à mão numa planilha que só uma pessoa sabe operar.',
    solution: 'Roteirização automática integrada ao sistema de gestão, com app simples pro motorista.',
    result: 'Rota pronta de manhã cedo, antes do primeiro caminhão sair do pátio.',
    tech: ['Node.js', 'Postgres', 'App do motorista'],
  },
  {
    client: 'Saúde',
    metric: '24h',
    metricLabel: 'de agenda funcionando',
    problem: 'Recepção afogada em ligações; paciente desiste antes de conseguir marcar.',
    solution: 'Portal do paciente e agenda automática no WhatsApp, ligados ao prontuário.',
    result: 'Marcações acontecem a qualquer hora — sem depender do telefone tocar.',
    tech: ['WhatsApp', 'Agenda', 'Portal'],
  },
  {
    client: 'Varejo',
    metric: '1×',
    metricLabel: 'o dado entra uma vez só',
    problem: 'Loja online vende produto em falta e o estoque físico nunca bate.',
    solution: 'E-commerce ligado ao estoque em tempo real, com catálogo que se atualiza sozinho.',
    result: 'Acabou a venda furada — e a conferência de madrugada.',
    tech: ['E-commerce', 'Estoque', 'Integração'],
  },
] as const

export function Cases() {
  return (
    <section id="resultados" aria-label="Resultados" className="relative z-10 overflow-hidden py-24 md:py-32">
      <GiantWord word="Prova" className="opacity-70" />
      <div className="shell relative">
        <WordReveal text="O que a gente resolve" className="font-impact max-w-2xl text-[clamp(2.4rem,5.2vw,4.2rem)]" />
        <Reveal delay={0.12}>
          <p className="mt-6 max-w-md text-ash">
            Três cenários típicos de quem opera no manual — a dor, o que a gente constrói e o que
            muda no dia seguinte. Todo projeto começa com uma métrica combinada em contrato.
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
