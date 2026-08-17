import { CoverArt } from './scenes/CoverArt'
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

      <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service, index) => (
          <Reveal
            key={service.title}
            delay={(index % 3) * 0.08}
            className="group glass relative overflow-hidden rounded-[20px] transition-colors duration-500 hover:border-[#4de0ff]/45"
          >
            <div className="flex h-full flex-col">
              {/* Each card opens on its own illustration — the grid reads as plates
                  in a catalogue rather than as six boxes of text. */}
              <div className="relative overflow-hidden">
                <CoverArt
                  variant={index}
                  className="h-[150px] w-full transition-transform duration-700 group-hover:scale-[1.06]"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-[#04102a]" />
              </div>

              <div className="flex flex-1 flex-col p-7">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-[1.3rem] leading-[1.1] uppercase">{service.title}</h3>
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate/40 text-mist transition-colors duration-300 group-hover:border-[#4de0ff] group-hover:bg-[#4de0ff]/10">
                    <ArrowGlyph className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
                <p className="mt-4 text-[15px] text-silver">{service.body}</p>
                <p className="label-voice mt-auto pt-8 text-[9px]">{service.detail}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
