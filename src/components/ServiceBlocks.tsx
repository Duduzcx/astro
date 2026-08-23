import type { ReactNode } from 'react'
import { WordReveal, Reveal, Tilt } from './ui/Primitives'
import {
  ChatPanel,
  DashboardPanel,
  PipelinePanel,
  StorefrontPanel,
  TelemetryPanel,
} from './scenes/Panels'

/**
 * Text + product-UI split per service, alternating sides — the Mercury
 * "text-left / image-right" rhythm. The particle field runs dim behind.
 * Each block closes with the benefit line and the stack that delivers it.
 */
const services: Array<{
  title: string
  body: string
  bullet: string
  tech: string[]
  panel: ReactNode
}> = [
  {
    title: 'Um sistema do jeito\nda sua empresa',
    body: 'Cadastro, agenda, estoque e cobrança numa tela só, do jeito que o seu negócio já funciona. Chega de caçar informação em cinco planilhas diferentes.',
    bullet: 'Tudo num lugar só — qualquer pessoa da equipe aprende em um dia',
    tech: ['React', 'Next.js', 'Node.js', 'Postgres'],
    panel: <DashboardPanel />,
  },
  {
    title: 'Um site que\ntraz clientes',
    body: 'Bonito, rápido e ligado ao resto: o pedido que entra já aparece no estoque, na cobrança e no relatório. Ninguém precisa copiar e colar nada.',
    bullet: 'Venda online sem medo de vender o que acabou',
    tech: ['React', 'Vite', 'Tailwind', 'Netlify'],
    panel: <StorefrontPanel />,
  },
  {
    title: 'Robôs que trabalham\npor você',
    body: 'Cobrar quem atrasou, confirmar consulta, mandar relatório toda segunda. O robô faz o repetitivo e devolve horas pra sua equipe toda semana.',
    bullet: 'Seu WhatsApp atende e agenda sozinho, até de madrugada',
    tech: ['Node.js', 'WhatsApp', 'Robôs', 'Agenda'],
    panel: <ChatPanel />,
  },
  {
    title: 'Sensores e painéis\nao vivo',
    body: 'A temperatura da câmara fria, o gasto de energia, a esteira que parou — tudo aparece no celular na hora. A ronda com prancheta vira alerta automático.',
    bullet: 'Você fica sabendo do problema antes de virar prejuízo',
    tech: ['Sensores', 'Alertas', 'Painéis', 'Celular'],
    panel: <TelemetryPanel />,
  },
  {
    title: 'Tudo\nconectado',
    body: 'Seu sistema de gestão, seu site, seu WhatsApp e suas planilhas falando a mesma língua. A informação entra uma vez e aparece em todo lugar, sempre atualizada.',
    bullet: 'Digitou uma vez? Nunca mais digita de novo',
    tech: ['Integrações', 'Planilhas', 'WhatsApp', 'Gestão'],
    panel: <PipelinePanel />,
  },
]

export function ServiceBlocks() {
  return (
    <section id="servicos" aria-label="Serviços" className="relative z-10 py-12 md:py-20">
      {services.map((service, index) => (
        <div key={service.title} className="flex min-h-[70svh] items-center">
          <div className="shell grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
              <WordReveal
                text={service.title}
                className="text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.04]"
              />
              <Reveal delay={0.12}>
                <p className="mt-6 max-w-md text-[clamp(1rem,1.3vw,1.15rem)] leading-[1.6] text-ash">
                  {service.body}
                </p>
              </Reveal>
              <Reveal delay={0.2}>
                <p className="mt-6 flex items-center gap-3 text-[14px] text-ivory">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cobalt" />
                  {service.bullet}
                </p>
              </Reveal>
              <Reveal delay={0.26}>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {service.tech.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-obsidian px-3.5 py-1.5 text-[12px] text-slate"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
            <Reveal delay={0.15} className={index % 2 === 1 ? 'lg:order-1' : ''}>
              <Tilt>{service.panel}</Tilt>
            </Reveal>
          </div>
        </div>
      ))}
    </section>
  )
}
