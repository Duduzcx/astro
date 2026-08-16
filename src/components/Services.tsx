import { ArrowGlyph, Reveal, Section, SectionHead } from './ui/Primitives'

const services = [
  {
    title: 'Sites e landing pages',
    body: 'Site institucional, página de campanha, catálogo. Feito no código, rápido de carregar, editável por você e indexado de verdade pelo Google.',
    detail: 'Next.js · CMS · SEO técnico',
  },
  {
    title: 'Sistemas web sob medida',
    body: 'Quando a planilha e o sistema de prateleira não dão mais conta. Cadastro, agenda, estoque, financeiro, permissão por usuário — do jeito que a sua operação funciona.',
    detail: 'React · PostgreSQL · autenticação',
  },
  {
    title: 'Automação de processos',
    body: 'Tarefa repetitiva vira rotina automática: relatório que se envia sozinho, cobrança que dispara na data, dado que sai de um lugar e entra em outro sem ninguém digitar.',
    detail: 'Jobs agendados · webhooks · e-mail e WhatsApp',
  },
  {
    title: 'Integrações e APIs',
    body: 'Seu ERP conversando com o e-commerce, com o gateway de pagamento, com o CRM. Construímos a ponte e cuidamos do que fazer quando um dos lados cai.',
    detail: 'REST · GraphQL · filas e reprocessamento',
  },
  {
    title: 'Produtos SaaS',
    body: 'Da ideia ao produto que cobra assinatura: multi-empresa, planos, painel de administração, cobrança recorrente e métricas de uso desde o primeiro cliente.',
    detail: 'Multi-tenant · Stripe · billing',
  },
  {
    title: 'IA aplicada',
    body: 'IA onde ela resolve algo concreto: atendimento que responde com a base da sua empresa, leitura automática de documento, classificação de chamado. Sem enfeite.',
    detail: 'LLMs · RAG · agentes',
  },
]

export function Services() {
  return (
    <Section id="servicos">
      <SectionHead
        label="O que fazemos"
        title="Seis frentes. Um time só."
        lead="Não vendemos hora de programador. Vendemos o problema resolvido — e ficamos junto depois que entra no ar."
      />

      <div className="mt-16 grid gap-px overflow-hidden rounded-[16px] bg-slate/20 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service, index) => (
          <Reveal
            key={service.title}
            delay={(index % 3) * 0.08}
            className="group relative bg-void transition-colors duration-300 hover:bg-orbit"
          >
            <div className="flex h-full flex-col p-9">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-2xl leading-tight">{service.title}</h3>
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-orbit text-mist transition-colors duration-300 group-hover:bg-orbit-soft">
                  <ArrowGlyph />
                </span>
              </div>
              <p className="mt-5 text-[15px] text-silver">{service.body}</p>
              <p className="mt-auto pt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-slate">
                {service.detail}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
