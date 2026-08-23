import { AnimatedNumber, Reveal, WordReveal } from './ui/Primitives'

/** Invented numbers, plainly presented — the fictional track record of the startup. */
const stats = [
  { label: 'Projetos entregues', value: '40+' },
  { label: 'Horas automatizadas por ano', value: '12 mil' },
  { label: 'Clientes que seguem com a gente', value: '98%' },
  { label: 'Dias até a primeira entrega', value: '14' },
] as const

/**
 * Reference pattern: "Build a better world of work" — left column beside the
 * regrouped core, with italic cobalt emphasis inside the running text.
 */
export function Mission() {
  return (
    <section aria-label="Missão" className="relative z-10 flex min-h-[100svh] items-center overflow-hidden">
      <div className="aurora" aria-hidden="true" />
      <div className="shell">
        <div className="max-w-lg">
          <WordReveal
            text={'Um jeito melhor\nde operar'}
            className="font-impact text-[clamp(2.6rem,5.6vw,4.6rem)] leading-[1.0]"
          />

          <Reveal delay={0.12}>
            <p className="mt-8 text-[clamp(1rem,1.3vw,1.15rem)] leading-[1.6] text-ash">
              Nossa missão é tornar o trabalho mais coerente — reprogramando a produtividade de{' '}
              <em className="text-cobalt">fazer mais</em> para{' '}
              <em className="text-cobalt">operar melhor</em>.
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mt-6 text-[clamp(1rem,1.3vw,1.15rem)] leading-[1.6] text-ash">
              Os melhores momentos de um time acontecem quando ele está em fluxo: criando valor pro
              cliente, não caçando informação nem redigitando planilha.
            </p>
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
