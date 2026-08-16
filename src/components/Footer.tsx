import { Logo } from './Logo'
import { navLinks, site } from '../lib/site'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-slate/20 bg-deep">
      <div className="shell grid gap-12 py-20 md:grid-cols-[1.4fr_1fr_1fr] md:py-24">
        <div>
          <Logo />
          <p className="mt-6 max-w-xs text-[15px] text-silver">
            Engenharia de software sob medida para empresas que já sabem o que precisam resolver.
          </p>
        </div>

        <nav aria-label="Rodapé">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate">Site</p>
          <ul className="mt-5 space-y-3">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="text-mist transition-colors hover:text-platinum">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate">Contato</p>
          <ul className="mt-5 space-y-3">
            <li>
              <a
                href={`mailto:${site.email}`}
                className="text-mist transition-colors hover:text-platinum"
              >
                {site.email}
              </a>
            </li>
            <li>
              <a
                href={site.whatsapp.href}
                className="text-mist transition-colors hover:text-platinum"
              >
                {site.whatsapp.label}
              </a>
            </li>
            <li>
              <a
                href={site.linkedin}
                target="_blank"
                rel="noreferrer"
                className="text-mist transition-colors hover:text-platinum"
              >
                LinkedIn
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="shell flex flex-col gap-3 border-t border-slate/20 py-8 font-mono text-[10px] tracking-[0.14em] text-slate uppercase sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {year} {site.name}
        </p>
        <p>{site.city}</p>
      </div>
    </footer>
  )
}
