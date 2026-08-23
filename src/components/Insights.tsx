import { LineReveal, Reveal } from './ui/Primitives'

/** Editorial shelf — invented posts that show how the team thinks. */
const posts = [
  {
    tag: 'Automação',
    title: 'O checklist dos processos que valem a pena automatizar primeiro',
    excerpt:
      'Nem tudo que é repetitivo dá retorno rápido. O filtro que usamos: frequência × dor × risco de erro humano.',
    date: 'Ago 2026',
    read: '6 min',
    image: '/media/insight-code.jpg',
    alt: 'Tela com código em ambiente escuro',
  },
  {
    tag: 'IoT',
    title: 'Do sensor ao dashboard: anatomia de um projeto de telemetria',
    excerpt:
      'O caminho do dado da câmara fria até o alerta no celular — e onde os projetos de IoT costumam travar.',
    date: 'Jul 2026',
    read: '8 min',
    image: '/media/insight-circuit.jpg',
    alt: 'Placa de circuito em close',
  },
  {
    tag: 'Engenharia',
    title: 'Por que entregamos em produção desde a primeira sprint',
    excerpt:
      'Homologação eterna esconde risco. Software só aprende no mundo real — o nosso vai pra lá em duas semanas.',
    date: 'Jul 2026',
    read: '5 min',
    image: '/media/insight-server.jpg',
    alt: 'Corredor de racks de servidores',
  },
] as const

export function Insights() {
  return (
    <section id="insights" aria-label="Tech insights" className="relative z-10 py-24 md:py-32">
      <div className="shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <LineReveal text="Tech insights" className="text-[clamp(2.2rem,4.6vw,3.6rem)]" />
            <Reveal delay={0.12}>
              <p className="mt-6 max-w-md text-ash">
                Como a gente pensa tecnologia e operação — sem jargão, com opinião.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.18}>
            <p className="label-voice text-[11px]">Novos artigos toda quinzena</p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {posts.map((post, index) => (
            <Reveal key={post.title} delay={0.08 * index}>
              <article className="graphite-card group h-full !p-0">
                <div className="overflow-hidden rounded-t-xl">
                  <img
                    src={post.image}
                    alt={post.alt}
                    loading="lazy"
                    className="aspect-[3/2] w-full object-cover opacity-80 [filter:saturate(0.55)_brightness(0.75)] transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="p-6">
                  <p className="flex items-center gap-3 text-[11px] text-slate">
                    <span className="font-[480] tracking-[0.08em] text-cobalt uppercase">
                      {post.tag}
                    </span>
                    {post.date} · {post.read} de leitura
                  </p>
                  <h3 className="mt-3 text-[1.15rem] leading-[1.3]">{post.title}</h3>
                  <p className="mt-3 text-[14px] leading-[1.6] text-ash">{post.excerpt}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
