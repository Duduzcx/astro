import { motion } from 'framer-motion'
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
        <motion.ul
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={{ show: { transition: { staggerChildren: 0.045 } } }}
          className="mt-8 flex flex-wrap justify-center gap-3"
        >
          {tools.map((tool) => (
            <motion.li
              key={tool}
              variants={{
                hidden: { opacity: 0, y: 14, scale: 0.92 },
                show: { opacity: 1, y: 0, scale: 1 },
              }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-full bg-obsidian px-5 py-2.5 text-[14px] text-ash transition-colors hover:text-ivory"
            >
              {tool}
            </motion.li>
          ))}
        </motion.ul>
        <Reveal delay={0.18}>
          <p className="mt-8 text-center text-[14px] text-slate">
            — e qualquer sistema com API que a sua operação precisar.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
