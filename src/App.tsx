import { Starfield } from './components/Starfield'
import { SerialRail } from './components/SerialRail'
import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { Marquee } from './components/Marquee'
import { VoidReveal } from './components/VoidReveal'
import { PlanetStage } from './components/PlanetStage'
import { Services } from './components/Services'
import { SystemShowcase } from './components/SystemShowcase'
import { Integrations } from './components/Integrations'
import { FilmBand } from './components/FilmBand'
import { Process } from './components/Process'
import { Results } from './components/Results'
import { Stack } from './components/Stack'
import { Faq } from './components/Faq'
import { Contact } from './components/Contact'
import { Footer } from './components/Footer'

export default function App() {
  return (
    <>
      <Starfield />
      <SerialRail text="Astro · 001 · Sistema" />

      <a
        href="#sistema"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-full focus:bg-iris focus:px-5 focus:py-2 focus:text-platinum"
      >
        Pular para o conteúdo
      </a>

      <Nav />

      <main>
        <Hero />
        <Marquee />

        {/* Manifesto: the object states the argument before the copy does. */}
        <VoidReveal
          id="sistema"
          label="Figura 01 — Objeto"
          heading={'Não é só\num site.'}
          body="É o sistema inteiro em volta dele: o cadastro que alimenta a vitrine, a automação que dispara a cobrança, a integração que fecha o ciclo com o ERP. A gente constrói o corpo, não só a superfície."
          footnote="Render em tempo real · sem imagem externa"
          object={<PlanetStage className="h-full w-full" />}
        />

        <Services />
        <SystemShowcase />
        <Integrations />
        <FilmBand />
        <Process />
        <Results />
        <Stack />
        <Faq />
        <Contact />
      </main>

      <Footer />
    </>
  )
}
