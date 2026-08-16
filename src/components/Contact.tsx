import { ArrowGlyph, Label, NebulaButton, Reveal, SolidButton } from './ui/Primitives'
import { site } from '../lib/site'

const promises = [
  'Você sai da conversa com escopo, prazo e preço.',
  'Sem apresentação comercial, sem proposta de 30 páginas.',
  'Se não for caso de software, a gente diz na hora.',
]

export function Contact() {
  return (
    <section id="contato" className="py-24 md:py-32">
      <div className="shell">
        <Reveal className="rounded-[16px] bg-deep px-8 py-20 md:px-16 md:py-28">
          <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <Label>Próximo passo</Label>
              <h2 className="mt-6 max-w-xl text-[clamp(2.2rem,5.5vw,3.75rem)]">
                Conta o problema. A gente diz se dá para resolver com software.
              </h2>
              <ul className="mt-10 space-y-3">
                {promises.map((promise) => (
                  <li key={promise} className="flex gap-3 text-silver">
                    <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-[#5aa9ff]" />
                    {promise}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-4">
              <NebulaButton href={site.whatsapp.href} className="w-full">
                Falar no WhatsApp <ArrowGlyph />
              </NebulaButton>
              <SolidButton href={`mailto:${site.email}`} className="w-full">
                {site.email}
              </SolidButton>
              <p className="mt-2 font-mono text-[11px] leading-relaxed tracking-[0.08em] text-slate">
                Respondemos em até um dia útil. Atendimento remoto para todo o Brasil, base em{' '}
                {site.city}.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
