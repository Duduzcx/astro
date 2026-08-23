import { useEffect, useState, type MouseEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Logo } from './Logo'
import { ArrowGlyph, IrisButton } from './ui/Primitives'
import { navLinks, site } from '../lib/site'
import { scrollToHash } from '../lib/scroll'

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
      scrollToHash(href)
    })
  }

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-onyx/70 backdrop-blur-xl' : ''
      }`}
    >
      <nav className="shell flex h-14 items-center justify-between md:h-20" aria-label="Principal">
        <a href="#topo" className="shrink-0" aria-label="Astro Soluções — ir para o topo">
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
                  className={`relative block pb-0.5 text-[15px] font-[420] transition-colors ${
                    isActive ? 'text-ivory' : 'text-ash hover:text-ivory'
                  }`}
                >
                  {link.label}
                  {isActive ? (
                    <motion.span
                      layoutId="nav-active"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute right-0 -bottom-0.5 left-0 h-px bg-gradient-to-r from-cobalt to-[#8db4f5]"
                    />
                  ) : null}
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
          className="flex h-9 w-9 items-center justify-center rounded-full border border-ivory/40 text-ivory transition-colors active:bg-ivory/10 lg:hidden"
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
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 top-14 flex flex-col overflow-hidden bg-onyx/95 backdrop-blur-xl md:top-20 lg:hidden"
          >
            <div className="aurora" aria-hidden="true" />

            <motion.ul
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } } }}
              className="relative flex-1 overflow-y-auto px-6 pt-4"
            >
              {navLinks.map((link, index) => (
                <motion.li
                  key={link.href}
                  variants={{ hidden: { opacity: 0, x: -28 }, show: { opacity: 1, x: 0 } }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <a
                    href={link.href}
                    onClick={(event) => goToSection(event, link.href)}
                    className="group flex items-center justify-between border-b border-white/8 py-5"
                  >
                    <span className="flex items-baseline gap-4">
                      <span className="font-mono text-[12px] text-[#8db4f5]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="font-impact text-[2rem] leading-none text-ivory">
                        {link.label}
                      </span>
                    </span>
                    <ArrowGlyph className="h-4 w-4 text-slate transition-colors group-hover:text-ivory" />
                  </a>
                </motion.li>
              ))}
            </motion.ul>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative px-6 pb-10"
            >
              <IrisButton
                href="#contato"
                className="w-full"
                onClick={(event) => goToSection(event, '#contato')}
              >
                Agendar diagnóstico
              </IrisButton>
              <a
                href={site.whatsapp.href}
                className="mt-4 flex items-center justify-center gap-2.5 text-[14px] text-ash"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
                Chamar no WhatsApp
              </a>
              <p className="mt-6 text-center text-[12px] text-slate">
                Conectando seu negócio ao futuro.
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  )
}
