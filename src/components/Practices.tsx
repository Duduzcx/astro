import { motion } from 'framer-motion'
import { Constellation, type ConstellationNode } from './Constellation'
import { Label } from './ui/Primitives'

/**
 * Node positions are a real constellation figure, not a random scatter: the six
 * practices sit where the edges in Constellation.tsx close a single closed shape.
 */
const nodes: ConstellationNode[] = [
  { label: 'Sites', x: 0.12, y: 0.24 },
  { label: 'Sistemas', x: 0.33, y: 0.62 },
  { label: 'Automações', x: 0.5, y: 0.16 },
  { label: 'Integrações', x: 0.7, y: 0.55 },
  { label: 'SaaS', x: 0.88, y: 0.2 },
  { label: 'IA aplicada', x: 0.62, y: 0.85 },
]

export function Practices() {
  return (
    <section className="relative flex min-h-[78svh] flex-col justify-center py-20">
      <div className="shell grid gap-10 lg:grid-cols-2 lg:items-start">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <Label>Figura 04 — Constelação</Label>
          <h2 className="mt-6 text-[clamp(2rem,4.6vw,2.9rem)] leading-[0.9] uppercase">
            Nenhum problema
            <br />
            chega sozinho.
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-md text-[clamp(1.02rem,1.5vw,1.25rem)] leading-[1.3] text-mist lg:justify-self-end"
        >
          Raramente o problema é só um. O site puxa o sistema, o sistema puxa a integração, a
          integração vira automação. A gente liga os pontos em vez de vender um pedaço.
        </motion.p>
      </div>

      <Constellation nodes={nodes} className="shell mt-16 h-[46vh] w-full lg:h-[52vh]" />

      <p className="sr-only">
        Frentes de atuação: {nodes.map((node) => node.label).join(', ')}.
      </p>
    </section>
  )
}
