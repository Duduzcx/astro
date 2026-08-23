import { AnimatedNumber, Reveal, WordReveal } from './ui/Primitives'

/** Real commitments from the deliverables annex — verifiable, not vanity metrics. */
const stats = [
  { label: 'Frentes de entrega em todo projeto', value: '12' },
  { label: 'Propriedade do código é sua', value: '100%' },
  { label: 'Dias de garantia técnica (SLA)', value: '30–90' },
  { label: 'Atendimento por dia, com IA de plantão', value: '24h' },
] as const

/**
 * Reference pattern: "Build a better world of work" — left column beside the
 * regrouped core, with italic cobalt emphasis inside the running text.
 */
export function Mission() {
  return (
    <section aria-label="Missão" className="relative z-10 flex items-center overflow-hidden py-20 lg:min-h-[100svh] lg:py-16">
      <div className="aurora" aria-hidden="true" />
      <div className="shell">
        <div className="max-w-lg">
          <WordReveal
            text={'Seu negócio em\nnovas órbitas'}
            className="font-impact text-[clamp(2.6rem,5.6vw,4.6rem)] leading-[1.0]"
          />

          <Reveal delay={0.12}>
            <p className="mt-8 text-[clamp(1rem,1.3vw,1.15rem)] leading-[1.6] text-ash">
              Trabalhamos só com empresas (B2B) — e do nosso jeito de ver, os{' '}
              <em className="text-cobalt">Astros são os clientes</em>. A gente é o combustível
              tecnológico que impulsiona cada um a alcançar novas órbitas no seu mercado.
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mt-6 text-[clamp(1rem,1.3vw,1.15rem)] leading-[1.6] text-ash">
              A missão: transformar processos manuais em operações eficientes e escaláveis, com
              software sob medida que resolve problemas reais de gestão, vendas e operação.
            </p>
          </Reveal>

          <Reveal delay={0.26}>
            <ul className="mt-8 flex flex-wrap gap-2">
              {[
                'Impacto real',
                'Parceria, não fornecimento',
                'Transparência',
                'Excelência técnica',
                'Simplicidade que resolve',
              ].map((value) => (
                <li
                  key={value}
                  className="rounded-full bg-obsidian px-4 py-2 text-[13px] text-ash transition-colors hover:text-ivory"
                >
                  {value}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.28}>
            <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-8">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dd className="text-spectrum-animated text-[2rem] leading-none font-[480] tracking-[-0.01em]">
                    <AnimatedNumber value={stat.value} />
                  </dd>
                  <dt className="mt-2 text-[13px] leading-[1.4] text-slate">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
