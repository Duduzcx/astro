import { LineReveal, Reveal } from './ui/Primitives'

/** Invented quotes with names and roles — swap for real ones as they arrive. */
const quotes = [
  {
    text: 'A Astro Bot entregou em seis semanas o que a consultoria anterior não entregou em um ano. Hoje o fechamento do mês leva dois dias, não duas semanas.',
    name: 'Camila Andrade',
    role: 'COO · Vetra Logística',
  },
  {
    text: 'O bot de agendamento atende 70% dos pacientes sem tocar na recepção. Foi o melhor investimento que a clínica fez no ano.',
    name: 'Henrique Vale',
    role: 'Diretor · Clínica Áurea',
  },
  {
    text: 'Primeira empresa de tecnologia que falou a língua do varejo. Desde a integração, o estoque nunca mais furou.',
    name: 'Beatriz Lima',
    role: 'Fundadora · Mercado Bonfim',
  },
] as const

export function Testimonials() {
  return (
    <section aria-label="Depoimentos" className="relative z-10 py-24 md:py-32">
      <div className="shell">
        <LineReveal text="Quem já passou pelo processo" className="max-w-2xl text-[clamp(2.2rem,4.6vw,3.6rem)]" />

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {quotes.map((quote, index) => (
            <Reveal key={quote.name} delay={0.08 * index}>
              <figure className="graphite-card flex h-full flex-col">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
                  <path d="M5 17 9 5h3L9.5 17H5Zm8 0L17 5h3l-2.5 12H13Z" fill="#8434ce" />
                </svg>
                <blockquote className="mt-5 flex-1 text-[15px] leading-[1.6] text-ash">
                  {quote.text}
                </blockquote>
                <figcaption className="mt-6">
                  <p className="text-[15px] font-[480] text-ivory">{quote.name}</p>
                  <p className="mt-0.5 text-[13px] text-slate">{quote.role}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
