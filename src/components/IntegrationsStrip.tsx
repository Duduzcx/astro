import { Reveal } from './ui/Primitives'

/** Tools people already run their business on — plain text pills, no logos to license. */
const tools = [
  'WhatsApp Business',
  'Mercado Pago',
  'Bling',
  'Conta Azul',
  'Omie',
  'Shopify',
  'Nuvemshop',
  'Pipedrive',
  'RD Station',
  'Google Sheets',
  'Slack',
  'Postgres',
] as const

export function IntegrationsStrip() {
  return (
    <section aria-label="Integrações" className="relative z-10 py-20 md:py-28">
      <div className="shell">
        <Reveal>
          <p className="label-voice text-center text-[11px]">Conecta com o que você já usa</p>
        </Reveal>
        <Reveal delay={0.1}>
          <ul className="mt-8 flex flex-wrap justify-center gap-3">
            {tools.map((tool) => (
              <li
                key={tool}
                className="rounded-full bg-obsidian px-5 py-2.5 text-[14px] text-ash transition-colors hover:text-ivory"
              >
                {tool}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.18}>
          <p className="mt-8 text-center text-[14px] text-slate">
            — e qualquer sistema com API que a sua operação precisar.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
