import { GiantWord, Label, Reveal, WordReveal } from './ui/Primitives'
import { AstroMark } from './brand/AstroMark'

/**
 * Grade de portfólio, em duas naturezas misturadas na mesma grade:
 *
 * - com `url`: projeto NO AR. Nome real, print real, card clicável. Só entra
 *   aqui o que o cliente já publicou e autorizou.
 * - sem `url`: CONCEITO. Mesma arquitetura e escopo do que entregamos, nome
 *   fictício, porque nome de cliente sem autorização não vai para a página.
 *   O selo "Projeto conceito" existe por isso — tire só quando virar caso real.
 *
 * Os que estão no ar vêm primeiro: é o que o visitante quer clicar.
 */
type Project = {
  name: string
  sector: string
  year: string
  summary: string
  highlight: string
  highlightLabel: string
  stack: readonly string[]
  /** Presente = está no ar; o card vira link e o selo muda. */
  url?: string
  /** Print da home, 1280×800. Sem ele, o card mostra a marca. */
  shot?: string
  /** Domínio como o visitante lê, sem protocolo. */
  domain?: string
}

const projects: readonly Project[] = [
  {
    name: 'Compromisso',
    sector: 'Educação',
    year: '2026',
    summary:
      'Cursinho de ENEM e ETEC com portal do aluno: simulados, correção de redação por IA e evolução por matéria em um painel só. Instala como aplicativo e chama o aluno por notificação.',
    highlight: '500+',
    highlightLabel: 'aprovações reais, número do próprio cursinho',
    stack: ['Next.js', 'Portal do aluno', 'Correção com IA', 'PWA + push'],
    url: 'https://compromissose.com',
    domain: 'compromissose.com',
    shot: '/media/projects/compromisso.jpg',
  },
  {
    name: 'Neve na Nave',
    sector: 'Estética automotiva',
    year: '2026',
    summary:
      'Estética automotiva com agendamento online: o cliente escolhe serviço e horário sozinho, e o painel do dono abre o dia já montado — sem combinar horário por mensagem.',
    highlight: '24h',
    highlightLabel: 'agenda aberta, sem ninguém respondendo mensagem',
    stack: ['React', 'Supabase', 'Agendamento', 'Painel do dono'],
    url: 'https://nevenanave.netlify.app',
    domain: 'nevenanave.netlify.app',
    shot: '/media/projects/neve-na-nave.jpg',
  },
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
]

/** Seta diagonal dos links que abrem em outra aba. */
function ExternalGlyph() {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className="h-3 w-3 shrink-0 transition-transform duration-300 group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5 8.5 3.5M4.4 3.5h4.1v4.1" />
    </svg>
  )
}

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
            Os primeiros estão no ar agora — clique e navegue. Os marcados como conceito têm a
            mesma arquitetura e o mesmo escopo do que entregamos, só com nome fictício: nome de
            cliente só entra aqui com autorização, e cada um vira caso real assim que a empresa
            libera.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, index) => (
            <Reveal key={project.name} delay={0.06 * index}>
              <article className="graphite-card group/card relative flex h-full flex-col overflow-hidden">
                {/* Capa: print de verdade quando o projeto está no ar; a marca
                    quando é conceito e não existe tela para mostrar. */}
                <div className="relative -mx-7 -mt-7 mb-6 h-40 overflow-hidden border-b border-white/8 bg-gradient-to-br from-[#16233d] to-[#0d1526] lg:-mx-8 lg:-mt-8">
                  {project.shot ? (
                    <>
                      <img
                        src={project.shot}
                        alt={`Tela inicial do site ${project.name}`}
                        width={1280}
                        height={800}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover object-top opacity-85 transition duration-700 group-hover/card:scale-[1.04] group-hover/card:opacity-100"
                      />
                      {/* Escurece o pé do print para o selo e a borda não
                          brigarem com o conteúdo da imagem. */}
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-onyx/70 via-transparent to-onyx/40"
                      />
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <AstroMark className="h-16 w-16 opacity-25 transition-transform duration-700 group-hover/card:scale-110" />
                    </div>
                  )}

                  {project.url ? (
                    <span className="absolute top-4 right-5 inline-flex items-center gap-1.5 rounded-full border border-[#4ade80]/25 bg-onyx/70 px-2.5 py-0.5 font-mono text-[9px] tracking-[0.12em] text-[#86e8a8] uppercase backdrop-blur-[2px]">
                      <span className="h-1 w-1 rounded-full bg-[#4ade80]" />
                      No ar
                    </span>
                  ) : (
                    <span className="absolute top-4 right-5 rounded-full border border-white/12 bg-onyx/60 px-2.5 py-0.5 font-mono text-[9px] tracking-[0.12em] text-slate uppercase">
                      Projeto conceito
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-impact text-[1.5rem] leading-none text-ivory">
                    {project.url ? (
                      /* O link cobre o card inteiro (o ::after esticado), então
                         não há outro elemento clicável dentro do article. */
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-sm transition-colors after:absolute after:inset-0 after:content-[''] hover:text-[#8db4f5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8db4f5]"
                      >
                        {project.name}
                        <ExternalGlyph />
                      </a>
                    ) : (
                      project.name
                    )}
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

                {project.domain ? (
                  <p className="mb-4 font-mono text-[11px] break-all text-slate">
                    {project.domain}
                  </p>
                ) : null}

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
