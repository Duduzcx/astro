import { motion } from 'framer-motion'
import { PipelineScene } from './scenes/PipelineScene'
import { Label } from './ui/Primitives'

const facts = [
  { value: '1 fonte', label: 'de verdade para cada dado' },
  { value: 'retry', label: 'automático quando um lado cai' },
  { value: 'log', label: 'de tudo que entrou e saiu' },
]

export function Integrations() {
  return (
    <section className="border-y border-dashed border-slate/40 bg-deep/70 py-20 md:py-24">
      <div className="shell">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-15%' }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6"
          >
            <Label>Figura 03 — Fluxo</Label>
            <h2 className="mt-6 text-[clamp(2rem,4.4vw,2.9rem)] leading-[0.9] uppercase">
              Seus sistemas param de se ignorar.
            </h2>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-15%' }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-[clamp(1.02rem,1.5vw,1.25rem)] leading-[1.3] text-mist lg:col-span-6"
          >
            A Astro fica no meio: recebe do ERP, do site e do WhatsApp, normaliza, e entrega pronto
            para o financeiro, o BI e o estoque. Quando um lado sai do ar, a fila segura e
            reprocessa.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14"
        >
          <PipelineScene className="w-full" />
        </motion.div>

        <dl className="mt-14 grid gap-8 border-t border-dashed border-slate/40 pt-8 sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.value}>
              <dt className="text-2xl leading-none text-phosphor uppercase">{fact.value}</dt>
              <dd className="label-voice mt-3 text-[10px]">{fact.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
