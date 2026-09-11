import { ArrowGlyph, BlurReveal, IrisButton } from './ui/Primitives'
import { Logo } from './Logo'
import { AstroMark } from './brand/AstroMark'
import { footerLinks, site } from '../lib/site'

/**
 * Fechamento em tela cheia sobre as partículas reagrupadas e, embaixo, o
 * rodapé útil: marca, mapa de links, contato e a faixa legal.
 */
export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="relative z-10">
      <div className="relative flex min-h-[80svh] items-center">
        <AstroMark
          className="pointer-events-none absolute top-1/2 left-1/2 h-[62vmin] w-[62vmin] -translate-x-1/2 -translate-y-1/2 opacity-[0.045]"
          tone="negative"
        />
        <div className="shell relative">
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
            <p className="mt-8 text-[15px] text-ash [text-shadow:0_1px_10px_rgba(10,15,30,0.9)]">
              Conectando seu negócio ao futuro.
            </p>
          </BlurReveal>
        </div>
      </div>

      {/* Opaco de propósito: `backdrop-filter` custa caro a cada frame de scroll no
          celular, e deixava a cor da TintLayer vazar por baixo do rodapé. */}
      {/* O rodapé é grafite sobre uma seção transparente: a troca de cor era
          uma borda dura que, na rolagem rápida, varria a tela como uma faixa.
          Este degradê a dissolve em 144px antes da borda. */}
      <div
        aria-hidden="true"
        className="relative z-10 -mb-px h-36 w-full bg-gradient-to-b from-transparent to-graphite"
      />
      <div className="relative z-10 border-t border-white/10 bg-graphite">
        <div className="shell grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-[14px] leading-[1.6] text-ash">
              Sistemas, sites, automações e integrações sob medida para empresas que querem parar
              de operar no manual.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2.5">
              <li>
                <a
                  href={site.instagram.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 px-3.5 py-1.5 text-[13px] text-ash transition-colors hover:border-white/30 hover:text-ivory"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5">
                    <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
                  </svg>
                  {site.instagram.label}
                </a>
              </li>
              <li>
                <a
                  href={site.whatsapp.href}
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 px-3.5 py-1.5 text-[13px] text-ash transition-colors hover:border-white/30 hover:text-ivory"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
                  WhatsApp
                </a>
              </li>
            </ul>
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
                <a href={site.whatsapp.href} className="transition-colors hover:text-ivory">
                  WhatsApp {site.whatsapp.label}
                </a>
              </li>
              <li>
                <a href={site.phone.href} className="transition-colors hover:text-ivory">
                  Ligar {site.phone.label}
                </a>
              </li>
              <li>
                <a href={site.email.href} className="break-all transition-colors hover:text-ivory">
                  {site.email.label}
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
