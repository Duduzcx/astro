import { useEffect, useState, type MouseEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Logo } from './Logo'
import { IrisButton } from './ui/Primitives'
import { navLinks, site } from '../lib/site'

/** Marks the nav item whose section currently owns the viewport. */
function useActiveSection() {
  const [active, setActive] = useState<string>(navLinks[0].href)

  useEffect(() => {
    const sections = navLinks
      .map((link) => document.querySelector(link.href))
      .filter((element): element is Element => Boolean(element))

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActive(`#${visible.target.id}`)
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  return active
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const active = useActiveSection()

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
        scrolled ? 'bg-onyx/70 backdrop-blur-xl' : ''
      }`}
    >
      <nav className="shell flex h-20 items-center justify-between" aria-label="Principal">
        <a href="#topo" className="shrink-0" aria-label="Astro Bot — ir para o topo">
          <Logo />
        </a>

        <ul className="hidden items-center gap-9 lg:flex">
          {navLinks.map((link) => {
            const isActive = active === link.href
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  aria-current={isActive ? 'true' : undefined}
                  className={`block text-[15px] font-[420] transition-colors ${
                    isActive ? 'text-ivory' : 'text-ash hover:text-ivory'
                  }`}
                >
                  {link.label}
                </a>
              </li>
            )
          })}
        </ul>

        <div className="hidden lg:block">
          <IrisButton href="#contato">Agendar diagnóstico</IrisButton>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-ivory/60 text-ivory lg:hidden"
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
            className="fixed inset-0 top-20 bg-onyx px-6 pt-8 lg:hidden"
          >
            <ul>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(event) => goToSection(event, link.href)}
                    className="block border-b border-white/10 py-6 text-3xl font-[480] text-ivory"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <IrisButton
              href="#contato"
              className="mt-10 w-full"
              onClick={(event) => goToSection(event, '#contato')}
            >
              Agendar diagnóstico
            </IrisButton>
            <a
              href={`mailto:${site.email}`}
              className="mt-6 block text-center text-[14px] text-ash"
            >
              {site.email}
            </a>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
