import { ArrowGlyph, DashedRule, GhostButton, Label, NebulaButton, Reveal } from './ui/Primitives'
import { site } from '../lib/site'

const promises = [
  'Você sai da conversa com escopo, prazo e preço.',
  'Sem apresentação comercial, sem proposta de 30 páginas.',
  'Se não for caso de software, a gente diz na hora.',
]

export function Contact() {
  return (
    <section id="contato" className="py-20 md:py-24">
      <div className="shell">
        <Reveal className="rounded-[16px] border border-dashed border-slate/40 bg-deep/80 px-8 py-14 backdrop-blur-sm md:px-14 md:py-20">
          <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <Label>Próximo passo</Label>
              <h2 className="mt-6 max-w-xl text-[clamp(2.2rem,5.5vw,3.5rem)] leading-[0.9] uppercase">
                Conta o problema.
              </h2>
              <p className="mt-7 max-w-md text-[clamp(1.05rem,1.6vw,1.35rem)] leading-[1.26] text-mist">
                A gente diz na hora se dá para resolver com software — e quanto custa.
              </p>
              <DashedRule className="mt-10" />
              <ul className="mt-8 space-y-3">
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
              <GhostButton href={`mailto:${site.email}`} className="w-full">
                {site.email}
              </GhostButton>
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
