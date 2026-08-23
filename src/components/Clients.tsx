import { WordReveal, Reveal } from './ui/Primitives'

/**
 * Reference pattern: "Our investors" — names scattered across the field, each
 * tagged with a triangle. Here: the invented client roster, in the cool
 * monochrome palette with cobalt punctuation.
 */
const clients = [
  { name: 'Vetra Logística', segment: 'Operação de frota e entregas', color: '#8434ce', tilt: -12 },
  { name: 'Clínica Áurea', segment: 'Agenda e prontuário integrados', color: '#fffcf3', tilt: 18 },
  { name: 'Mercado Bonfim', segment: 'E-commerce e estoque', color: '#a86ce8', tilt: -25 },
  { name: 'Escala Fitness', segment: 'Cobrança recorrente automatizada', color: '#cfc4dd', tilt: 8 },
  { name: 'NovaEdu', segment: 'Portal do aluno e matrículas', color: '#a58fc0', tilt: -6 },
  { name: 'Grupo Litoral', segment: 'ERP integrado ao financeiro', color: '#8434ce', tilt: 22 },
] as const

/** Desktop scatter: column start + vertical push per item, echoing the reference. */
const scatter = [
  'md:col-start-7 md:mt-0',
  'md:col-start-2 md:mt-10',
  'md:col-start-8 md:mt-6',
  'md:col-start-3 md:mt-14',
  'md:col-start-6 md:mt-2',
  'md:col-start-1 md:mt-12',
] as const

export function Clients() {
  return (
    <section id="clientes" aria-label="Clientes" className="relative z-10 py-24 md:py-36">
      <div className="shell">
        <div className="max-w-lg">
          <WordReveal text="Quem confia" className="font-impact text-[clamp(2.6rem,6vw,5rem)]" />
          <Reveal delay={0.12}>
            <p className="mt-6 text-ash">
              Operações reais que trocaram planilha e retrabalho por sistema rodando — do varejo à
              saúde.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-12 md:gap-y-16">
          {clients.map((client, index) => (
            <Reveal
              key={client.name}
              delay={0.08 * index}
              className={`md:col-span-5 ${scatter[index]}`}
            >
              <div className="flex items-center gap-4">
                <svg
                  viewBox="0 0 40 40"
                  aria-hidden="true"
                  className="h-10 w-10 shrink-0"
                  style={{ transform: `rotate(${client.tilt}deg)` }}
                >
                  <path
                    d="M20 4 36 34H4L20 4Z"
                    stroke={client.color}
                    strokeWidth="2.4"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
                <div>
                  <p className="text-[1.4rem] leading-tight font-[480] tracking-[-0.01em] text-ivory">
                    {client.name}
                  </p>
                  <p className="mt-1 text-[14px] text-slate">{client.segment}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
