import { useEffect, useState, type MouseEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Logo } from './Logo'
import { NebulaButton } from './ui/Primitives'
import { navLinks, site } from '../lib/site'

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // The mobile sheet covers the page; the page behind it must not scroll.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /**
   * Closing the sheet and letting the browser follow the hash in the same tick races
   * the `overflow: hidden` cleanup, so the jump gets swallowed. Close first, scroll after.
   */
  const goToSection = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault()
    setMenuOpen(false)
    requestAnimationFrame(() => {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'border-b border-slate/20 bg-void/80 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <nav className="shell flex h-20 items-center justify-between" aria-label="Principal">
        <a href="#topo" className="shrink-0" aria-label="Astro — ir para o topo">
          <Logo />
        </a>

        <ul className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-silver transition-colors hover:text-platinum"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden lg:block">
          <NebulaButton href="#contato">Agendar diagnóstico</NebulaButton>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          className="flex h-10 w-10 items-center justify-center rounded-[6px] border border-slate/30 text-mist lg:hidden"
        >
          <span className="relative block h-3 w-4">
            <span
              className={`absolute left-0 block h-px w-4 bg-current transition-transform duration-200 ${
                menuOpen ? 'top-1.5 rotate-45' : 'top-0'
              }`}
            />
            <span
              className={`absolute left-0 block h-px w-4 bg-current transition-transform duration-200 ${
                menuOpen ? 'top-1.5 -rotate-45' : 'top-3'
              }`}
            />
          </span>
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 top-20 bg-void px-6 pt-8 lg:hidden"
          >
            <ul className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(event) => goToSection(event, link.href)}
                    className="block border-b border-slate/20 py-5 text-2xl text-platinum"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <NebulaButton
              href="#contato"
              className="mt-10 w-full"
              onClick={(event) => goToSection(event, '#contato')}
            >
              Agendar diagnóstico
            </NebulaButton>
            <a
              href={`mailto:${site.email}`}
              className="mt-6 block text-center font-mono text-[12px] tracking-[0.08em] text-silver"
            >
              {site.email}
            </a>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
