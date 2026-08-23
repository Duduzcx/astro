import { ArrowGlyph, BlurReveal, IrisButton } from './ui/Primitives'
import { Logo } from './Logo'
import { footerLinks, site } from '../lib/site'

/**
 * Full-screen send-off over the regrouped particle swirl, then a Mercury-style
 * utility footer: brand + link map + contact columns and a quiet legal strip.
 */
export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="relative z-10">
      <div className="flex min-h-[80svh] items-center">
        <div className="shell">
          <BlurReveal className="mx-auto max-w-3xl text-center">
            <p className="font-impact text-[clamp(2.2rem,5vw,4rem)] leading-[1.06] text-ivory">
              A sua operação tem a resposta.
              <br />
              Peça pra Astro Soluções construir.
            </p>
            <div className="mt-10 flex justify-center">
              <IrisButton href={site.whatsapp.href}>
                Agendar diagnóstico <ArrowGlyph />
              </IrisButton>
            </div>
            <p className="mt-8 text-[15px] text-ash [text-shadow:0_1px_10px_rgba(23,23,33,0.9)]">
              Ou escreva pra{' '}
              <a href={`mailto:${site.email}`} className="text-ivory underline underline-offset-4 hover:text-white">
                {site.email}
              </a>
            </p>
          </BlurReveal>
        </div>
      </div>

      <div className="border-t border-white/10 bg-graphite/70 backdrop-blur-sm">
        <div className="shell grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-[14px] leading-[1.6] text-ash">
              Sistemas, sites, automações e integrações sob medida para empresas que querem parar
              de operar no manual.
            </p>
            {/* Social links go here as soon as the profiles exist. */}
          </div>

          <nav aria-label="Mapa do site">
            <p className="label-voice text-[11px]">Navegação</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-[14px] text-ash transition-colors hover:text-ivory"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="label-voice text-[11px]">Contato</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-[14px] text-ash">
              <li>
                <a href={`mailto:${site.email}`} className="transition-colors hover:text-ivory">
                  {site.email}
                </a>
              </li>
              <li>
                <a href={site.whatsapp.href} className="transition-colors hover:text-ivory">
                  {site.whatsapp.label} (WhatsApp)
                </a>
              </li>
              <li className="text-slate">{site.hours}</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="shell flex flex-col gap-2 py-5 md:flex-row md:items-center md:justify-between">
            <p className="text-[12px] font-[420] tracking-[0.01em] text-slate">
              © {year} {site.name} · CNPJ {site.cnpj} · {site.city}
            </p>
            <p className="text-[12px] font-[420] tracking-[0.01em] text-slate">
              Feito com software que trabalha de madrugada.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
