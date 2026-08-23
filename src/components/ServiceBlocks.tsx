import type { ReactNode } from 'react'
import { LineReveal, Reveal } from './ui/Primitives'
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
    title: 'Sistemas\nsob medida',
    body: 'Cadastro, agenda, estoque, financeiro e permissões do jeito que a sua operação funciona. Software que espelha o processo real — não o contrário.',
    bullet: 'Menos custo operacional: uma tela no lugar de cinco planilhas',
    tech: ['React', 'Next.js', 'Node.js', 'Postgres'],
    panel: <DashboardPanel />,
  },
  {
    title: 'Sites e\ne-commerce',
    body: 'Presença que converte. Sites rápidos, mensuráveis e ligados ao resto do sistema: o lead que chega vira tarefa, cobrança e relatório sem ninguém copiar e colar.',
    bullet: 'Loja integrada ao estoque físico em tempo real',
    tech: ['React', 'Vite', 'Tailwind', 'Netlify'],
    panel: <StorefrontPanel />,
  },
  {
    title: 'Automações que\nnão dormem',
    body: 'Cobrança, conciliação, follow-up, relatórios. O robô assume o repetitivo e devolve horas pra sua equipe toda semana — sem esquecer, sem errar de linha.',
    bullet: 'Atendimento e agenda resolvidos no WhatsApp',
    tech: ['Node.js', 'WhatsApp API', 'Filas', 'Cron'],
    panel: <ChatPanel />,
  },
  {
    title: 'IoT e dashboards\nde operação',
    body: 'Sensores no chão de fábrica, no frio e na frota alimentando dashboards analíticos em tempo real. O que antes era ronda com prancheta vira alerta no celular.',
    bullet: 'Escala de ponta a ponta: do sensor ao indicador',
    tech: ['MQTT', 'ESP32', 'TimescaleDB', 'Grafana'],
    panel: <TelemetryPanel />,
  },
  {
    title: 'Integrações de\nponta a ponta',
    body: 'ERP, CRM, WhatsApp, planilhas e bancos falando a mesma língua. O dado entra uma vez e aparece em todo lugar — sem redigitação, sem versão desatualizada.',
    bullet: 'O dado entra uma vez, aparece em todo lugar',
    tech: ['REST', 'Webhooks', 'Postgres', 'AWS'],
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
              <LineReveal
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
              {service.panel}
            </Reveal>
          </div>
        </div>
      ))}
    </section>
  )
}
