import { useRef } from 'react'
import { motion } from 'framer-motion'
import { LineReveal, Reveal } from './ui/Primitives'
import { useAutoPauseVideo } from '../lib/useAutoPauseVideo'

/** How the team actually works — the engineering culture, in three habits. */
const culture = [
  {
    title: 'Protótipo antes de proposta',
    body: 'Toda ideia grande vira um protótipo navegável na primeira semana. Você decide vendo, não imaginando.',
  },
  {
    title: 'Sprint curto, demo toda sexta',
    body: 'Ciclos de duas semanas com entrega em produção. Sexta-feira tem demo — mesmo quando o avanço é pequeno.',
  },
  {
    title: 'Código limpo e documentado',
    body: 'Testes, revisão em par e documentação de bordo. O sistema precisa sobreviver a qualquer troca de time.',
  },
] as const

export function About() {
  const videoRef = useRef<HTMLVideoElement>(null)
  useAutoPauseVideo(videoRef)

  return (
    <section id="sobre" aria-label="Sobre a Astro Bot" className="relative z-10 py-24 md:py-32">
      <div className="shell">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <LineReveal text={'Por que a Astro Bot\nexiste'} className="text-[clamp(2.2rem,4.6vw,3.6rem)]" />
            <Reveal delay={0.12}>
              <p className="mt-6 max-w-md leading-[1.6] text-ash">
                A Astro Bot nasceu em 2023, dentro de uma operação de logística que vivia refém de
                planilha. Depois de automatizar aquela rotina por conta própria — e ver o time
                ganhar as noites de volta — a pergunta ficou: quantas empresas estão presas no
                mesmo lugar?
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-5 max-w-md leading-[1.6] text-ash">
                A missão é essa até hoje: tirar operação séria do manual, com software sob medida
                que a equipe gosta de usar — e código que pertence ao cliente.
              </p>
            </Reveal>
          </div>

          <motion.div
            initial={{ clipPath: 'inset(12% 12% 12% 12% round 12px)', opacity: 0.4 }}
            whileInView={{ clipPath: 'inset(0% 0% 0% 0% round 12px)', opacity: 1 }}
            viewport={{ once: true, margin: '-120px' }}
            transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <video
              ref={videoRef}
              src="/media/office.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="Equipe trabalhando em um escritório com luz natural"
              className="aspect-[4/3] w-full rounded-xl object-cover opacity-90 [filter:saturate(0.75)_brightness(0.85)]"
            />
          </motion.div>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {culture.map((item, index) => (
            <Reveal key={item.title} delay={0.08 * index}>
              <article className="graphite-card h-full">
                <span className="block h-1 w-8 rounded-full bg-cobalt" aria-hidden="true" />
                <h3 className="mt-5 text-[1.2rem]">{item.title}</h3>
                <p className="mt-3 text-[14px] leading-[1.6] text-ash">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
