import { motion } from 'framer-motion'
import { DashboardScene } from './scenes/DashboardScene'
import { Label } from './ui/Primitives'

const bullets = [
  {
    title: 'Cada tela nasce de uma rotina sua',
    body: 'Nada de módulo genérico que ninguém usa. A tela existe porque alguém faz aquilo todo dia.',
  },
  {
    title: 'Permissão por pessoa, não por plano',
    body: 'O vendedor vê o pedido dele, o gerente vê a equipe, o financeiro vê o caixa. Sem gambiarra.',
  },
  {
    title: 'O dado entra uma vez só',
    body: 'Lançou no pedido, o estoque baixa e o financeiro recebe. Digitação dupla é bug, não processo.',
  },
]

export function SystemShowcase() {
  return (
    <section className="py-20 md:py-24">
      <div className="shell grid gap-14 lg:grid-cols-12 lg:items-center lg:gap-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-5"
        >
          <Label>Figura 02 — Painel</Label>
          <h2 className="mt-6 text-[clamp(2rem,4.4vw,2.9rem)] leading-[0.9] uppercase">
            O sistema que a sua operação já desenhou.
          </h2>
          <p className="mt-7 text-[clamp(1.02rem,1.5vw,1.25rem)] leading-[1.3] text-mist">
            Você já tem um processo. Ele só está espalhado entre planilha, grupo de WhatsApp e a
            cabeça de duas pessoas. A gente transforma isso em software.
          </p>

          <ul className="mt-10 space-y-7">
            {bullets.map((bullet) => (
              <li key={bullet.title} className="border-t border-dashed border-slate/40 pt-5">
                <h3 className="text-[15px] leading-[1.2] uppercase">{bullet.title}</h3>
                <p className="mt-2.5 text-[15px] text-silver">{bullet.body}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0 lg:col-span-7"
        >
          <DashboardScene />
          <p className="label-voice mt-4 text-[9px]">
            Painel ilustrativo · dados de exemplo atualizando em tempo real
          </p>
        </motion.div>
      </div>
    </section>
  )
}
