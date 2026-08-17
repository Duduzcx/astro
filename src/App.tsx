import { Starfield } from './components/Starfield'
import { SerialRail } from './components/SerialRail'
import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { Marquee } from './components/Marquee'
import { VoidReveal } from './components/VoidReveal'
import { OrbitField } from './components/OrbitField'
import { SystemShowcase } from './components/SystemShowcase'
import { Services } from './components/Services'
import { Integrations } from './components/Integrations'
import { Practices } from './components/Practices'
import { Process } from './components/Process'
import { Kinetic } from './components/Kinetic'
import { Results } from './components/Results'
import { Stack } from './components/Stack'
import { Faq } from './components/Faq'
import { Contact } from './components/Contact'
import { Footer } from './components/Footer'
import { DashedRule } from './components/ui/Primitives'

export default function App() {
  return (
    <>
      <Starfield />
      <SerialRail text="Astro · 001 · Sistema" />

      <a
        href="#sistema"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-full focus:bg-orbit focus:px-5 focus:py-2 focus:text-mist"
      >
        Pular para o conteúdo
      </a>

      <Nav />

      <main>
        <Hero />
        <Marquee />

        <VoidReveal
          id="sistema"
          serial="Figura 02 — Objeto"
          heading="Não é só um site."
          body="É o sistema inteiro em volta dele: o cadastro que alimenta a vitrine, a automação que dispara a cobrança, a integração que fecha o ciclo com o ERP. A gente constrói o corpo, não só a superfície."
          footnote="Render em tempo real · sem imagem externa"
          object={<OrbitField className="h-full w-full" />}
        />

        <SystemShowcase />
        <Services />
        <Integrations />
        <Practices />

        <DashedRule className="shell" />
        <Process />

        <Kinetic />
        <Results />
        <Stack />
        <Faq />
        <Contact />
      </main>

      <Footer />
    </>
  )
}
