import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { Marquee } from './components/Marquee'
import { Services } from './components/Services'
import { Process } from './components/Process'
import { Kinetic } from './components/Kinetic'
import { Results } from './components/Results'
import { Stack } from './components/Stack'
import { Faq } from './components/Faq'
import { Contact } from './components/Contact'
import { Footer } from './components/Footer'

export default function App() {
  return (
    <>
      <a
        href="#servicos"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-[6px] focus:bg-orbit focus:px-4 focus:py-2 focus:text-mist"
      >
        Pular para o conteúdo
      </a>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Services />
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
