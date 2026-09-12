import { GiantWord, Label, Reveal, WordReveal } from './ui/Primitives'

/**
 * Grade de portfólio. Só entra aqui projeto publicado e autorizado pelo
 * cliente: nome real, print real da home e card clicável. Não há item de
 * exemplo ou conceito — card sem link é card que não prova nada.
 *
 * Para incluir um projeto: print da home em 1280×800 dentro de
 * `public/media/projects/` (a CSP só aceita imagem do próprio domínio) e uma
 * entrada nesta lista.
 */
type Project = {
  name: string
  sector: string
  year: string
  summary: string
  highlight: string
  highlightLabel: string
  stack: readonly string[]
  url: string
  /** Domínio como o visitante lê, sem protocolo. */
  domain: string
  /** Print da home, 1280×800. */
  shot: string
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
]

/** Seta diagonal dos links que abrem em outra aba. */
function ExternalGlyph() {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 transition-transform duration-300 group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5"
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
          text={'Projetos no ar,\nde setores diferentes'}
          delay={0.06}
          className="font-impact mt-7 max-w-3xl text-[clamp(2.4rem,5.2vw,4.2rem)]"
        />

        <Reveal delay={0.14}>
          <p className="mt-6 max-w-xl text-ash">
            Um cursinho com portal do aluno e uma estética automotiva com agenda própria. Os dois
            estão publicados e rodando — clique e navegue. Aqui só entra projeto real, com nome
            autorizado pelo cliente.
          </p>
        </Reveal>

        {/* Duas colunas no máximo: com poucos cards, três colunas deixam buraco
            na linha e encolhem o print, que é o que prova o trabalho. */}
        <div className="mt-14 grid max-w-5xl gap-5 md:grid-cols-2">
          {projects.map((project, index) => (
            <Reveal key={project.name} delay={0.06 * index}>
              <article className="graphite-card group/card relative flex h-full flex-col overflow-hidden">
                <div className="relative -mx-7 -mt-7 mb-6 h-44 overflow-hidden border-b border-white/8 bg-gradient-to-br from-[#16233d] to-[#0d1526] lg:-mx-8 lg:-mt-8 lg:h-56">
                  <img
                    src={project.shot}
                    alt={`Tela inicial do site ${project.name}`}
                    width={1280}
                    height={800}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover object-top opacity-85 transition duration-700 group-hover/card:scale-[1.04] group-hover/card:opacity-100"
                  />
                  {/* Escurece o pé do print para o selo e a borda não brigarem
                      com o conteúdo da imagem. */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-onyx/70 via-transparent to-onyx/40"
                  />
                  <span className="absolute top-4 right-5 inline-flex items-center gap-1.5 rounded-full border border-[#4ade80]/25 bg-onyx/70 px-2.5 py-0.5 font-mono text-[9px] tracking-[0.12em] text-[#86e8a8] uppercase backdrop-blur-[2px]">
                    <span className="h-1 w-1 rounded-full bg-[#4ade80]" />
                    No ar
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-impact text-[1.6rem] leading-none text-ivory">
                    {/* O link estica um ::after sobre o article inteiro: a área
                        de clique é o card todo, sem aninhar interativos. */}
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-sm transition-colors after:absolute after:inset-0 after:content-[''] hover:text-[#8db4f5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8db4f5]"
                    >
                      {project.name}
                      <ExternalGlyph />
                    </a>
                  </h3>
                  <span className="font-mono text-[11px] text-slate">{project.year}</span>
                </div>

                <p className="mt-2 text-[13px] font-[480] tracking-[0.08em] text-[#8db4f5] uppercase">
                  {project.sector}
                </p>

                <p className="mt-4 text-[14px] leading-[1.6] text-ash">{project.summary}</p>

                {/* Espaçador, não margem: mantém as réguas de métrica alinhadas
                    na linha, por mais longo que seja cada resumo. */}
                <div aria-hidden="true" className="mt-6 flex-1" />

                <p className="mb-4 font-mono text-[11px] break-all text-slate">{project.domain}</p>

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
            Quer ver o seu aqui? A conversa de diagnóstico é gratuita e você sai dela com o escopo
            desenhado — mesmo que decida construir sem a gente.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
