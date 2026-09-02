import { GiantWord, Label, Reveal, WordReveal } from './ui/Primitives'
import { AstroMark } from './brand/AstroMark'

/**
 * Grade de portfólio. Todo item aqui é CONCEITO, não contrato entregue: nome
 * de cliente só entra na página com autorização. O selo "Projeto conceito" e
 * a nota abaixo do título existem por causa disso. Tire os dois apenas quando
 * o item virar um caso real e autorizado.
 */
const projects = [
  {
    name: 'Pátio Zero',
    sector: 'Indústria',
    year: '2025',
    summary:
      'Apontamento de produção no chão de fábrica: o operador registra pelo tablet e o painel do gerente atualiza na hora, sem planilha no meio.',
    highlight: '-14 dias',
    highlightLabel: 'de atraso no fechamento de OP',
    stack: ['React', 'Node.js', 'Postgres', 'Tablet'],
  },
  {
    name: 'Vitrine Nova',
    sector: 'Imobiliária',
    year: '2025',
    summary:
      'Site próprio publicando o mesmo imóvel nos portais e no CRM de uma vez só — cadastro em um lugar, anúncio em todos.',
    highlight: '1×',
    highlightLabel: 'o imóvel é cadastrado uma vez só',
    stack: ['Next.js', 'CRM', 'Integração portais'],
  },
  {
    name: 'Mesa Cheia',
    sector: 'Restaurantes',
    year: '2024',
    summary:
      'Cardápio digital com pedido pelo WhatsApp caindo direto na comanda da cozinha, sem ninguém redigitando no meio do rush.',
    highlight: '-40%',
    highlightLabel: 'de erro de pedido no salão',
    stack: ['WhatsApp API', 'PWA', 'Impressora fiscal'],
  },
  {
    name: 'Contábil Nexo',
    sector: 'Serviços contábeis',
    year: '2024',
    summary:
      'Robô que baixa extratos, concilia lançamentos e monta o fechamento do mês; o contador entra só onde precisa de decisão humana.',
    highlight: '-11 dias',
    highlightLabel: 'no fechamento mensal',
    stack: ['Python', 'Open Finance', 'Painel BI'],
  },
  {
    name: 'Obra Certa',
    sector: 'Construção',
    year: '2025',
    summary:
      'Diário de obra no celular do encarregado: medição, foto e efetivo saem do papel e chegam ao escritório no mesmo minuto.',
    highlight: '1×',
    highlightLabel: 'o dado é digitado uma vez só',
    stack: ['React Native', 'Offline-first', 'Postgres'],
  },
  {
    name: 'Fluxo Escola',
    sector: 'Educação',
    year: '2024',
    summary:
      'Matrícula online com contrato assinado digitalmente e cobrança recorrente automática, com régua de inadimplência no WhatsApp.',
    highlight: '+23%',
    highlightLabel: 'de mensalidade paga em dia',
    stack: ['Assinatura digital', 'Pix/Boleto', 'CRM'],
  },
] as const

export function Projects() {
  return (
    <section
      id="projetos"
      aria-label="Projetos"
      className="relative z-10 overflow-hidden py-24 md:py-32"
    >
      <GiantWord word="Projetos" className="opacity-60" />

      <div className="shell relative">
        <Reveal>
          <Label>Portfólio</Label>
        </Reveal>

        <WordReveal
          text={'Alguns projetos\nque saíram do papel'}
          delay={0.06}
          className="font-impact mt-7 max-w-3xl text-[clamp(2.4rem,5.2vw,4.2rem)]"
        />

        <Reveal delay={0.14}>
          <p className="mt-6 max-w-xl text-ash">
            Enquanto os primeiros contratos não liberam o nome do cliente, mostramos os projetos em
            formato de conceito: mesma arquitetura, mesmo escopo, mesma entrega — só o nome é
            fictício. Cada card vira um caso real assim que a empresa autoriza a publicação.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, index) => (
            <Reveal key={project.name} delay={0.06 * index}>
              <article className="graphite-card group/card flex h-full flex-col overflow-hidden">
                {/* Placa: a marca no lugar da arte de capa, enquanto não há imagem real. */}
                <div className="relative -mx-7 -mt-7 mb-6 flex h-32 items-center justify-center overflow-hidden border-b border-white/8 bg-gradient-to-br from-[#16233d] to-[#0d1526] lg:-mx-8 lg:-mt-8">
                  <AstroMark className="h-16 w-16 opacity-25 transition-transform duration-700 group-hover/card:scale-110" />
                  <span className="absolute top-4 left-5 font-mono text-[11px] text-slate">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="absolute top-4 right-5 rounded-full border border-white/12 bg-onyx/60 px-2.5 py-0.5 font-mono text-[9px] tracking-[0.12em] text-slate uppercase">
                    Projeto conceito
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-impact text-[1.5rem] leading-none text-ivory">
                    {project.name}
                  </h3>
                  <span className="font-mono text-[11px] text-slate">{project.year}</span>
                </div>

                <p className="mt-2 text-[13px] font-[480] tracking-[0.08em] text-[#8db4f5] uppercase">
                  {project.sector}
                </p>

                <p className="mt-4 text-[14px] leading-[1.6] text-ash">{project.summary}</p>

                {/* Espaçador, não margem: mantém as réguas de métrica alinhadas na
                    linha, por mais longo que seja cada resumo. */}
                <div aria-hidden="true" className="mt-6 flex-1" />

                <div className="flex items-baseline gap-3 border-t border-white/8 pt-5">
                  <span className="text-spectrum-animated text-[1.75rem] leading-none font-[480]">
                    {project.highlight}
                  </span>
                  <span className="text-[13px] text-ash">{project.highlightLabel}</span>
                </div>

                <ul className="flex flex-wrap gap-2 pt-6">
                  {project.stack.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-obsidian px-3 py-1 text-[11px] text-slate"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-10 max-w-2xl text-[13px] leading-[1.6] text-slate">
            Quer ver o seu no lugar de um destes? A conversa de diagnóstico é gratuita e você sai
            dela com o escopo desenhado — mesmo que decida construir sem a gente.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
