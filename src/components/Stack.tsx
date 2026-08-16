import { Reveal, Section, SectionHead } from './ui/Primitives'

const groups = [
  {
    title: 'Interface',
    items: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Astro', 'React Native'],
  },
  {
    title: 'Servidor e dados',
    items: ['Node.js', 'PostgreSQL', 'Supabase', 'Redis', 'Prisma', 'Python'],
  },
  {
    title: 'Infra e operação',
    items: ['Vercel', 'AWS', 'Docker', 'Cloudflare', 'GitHub Actions', 'Sentry'],
  },
  {
    title: 'Integrações',
    items: ['Stripe', 'Pagar.me', 'WhatsApp Cloud API', 'Google Workspace', 'n8n', 'OpenAI'],
  },
]

export function Stack() {
  return (
    <Section id="stack" className="bg-deep">
      <SectionHead
        label="Stack"
        title="Ferramenta é escolha nossa. Conta é sua."
        lead="Trabalhamos com tecnologia aberta e amplamente adotada. Se um dia você trocar de time, qualquer desenvolvedor pega o projeto de onde paramos."
      />

      <div className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((group, index) => (
          <Reveal key={group.title} delay={index * 0.07}>
            <h3 className="border-b border-slate/25 pb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[#5aa9ff]">
              {group.title}
            </h3>
            <ul className="mt-6 space-y-3">
              {group.items.map((item) => (
                <li key={item} className="text-mist">
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
