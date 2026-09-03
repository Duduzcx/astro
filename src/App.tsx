import { Suspense, lazy } from 'react'
import { TintLayer } from './components/TintLayer'
import { AuroraBlobs } from './components/AuroraBlobs'
import { ScrollProgress } from './components/ScrollProgress'
import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { Marquee } from './components/Marquee'
import { ServiceBlocks } from './components/ServiceBlocks'
import { IntegrationsStrip } from './components/IntegrationsStrip'
import { Manifesto } from './components/Manifesto'
import { FilmBand } from './components/FilmBand'
import { Mission } from './components/Mission'
import { Cases } from './components/Cases'
import { Projects } from './components/Projects'
import { CtaBand } from './components/CtaBand'
import { Process } from './components/Process'
import { About } from './components/About'
import { Deliverables } from './components/Deliverables'
import { Team } from './components/Team'
import { Insights } from './components/Insights'
import { Faq } from './components/Faq'
import { Contact } from './components/Contact'
import { Footer } from './components/Footer'

/** three.js pesa ~500kB minificado, então a cena vem num chunk separado. */
const TriScene = lazy(() =>
  import('./components/TriScene').then((module) => ({ default: module.TriScene })),
)

/**
 * Ordem da página: promessa, prova, conversão. Duas vezes.
 * Uma cena WebGL fixa atrás de tudo, que muda de forma a cada seção.
 * A ordem daqui e a tabela KEYFRAMES do TriScene andam juntas: mexeu numa,
 * refaça as medidas da outra.
 */
export default function App() {
  return (
    <>
      <TintLayer />
      <AuroraBlobs />
      <Suspense fallback={null}>
        <TriScene />
      </Suspense>
      <ScrollProgress />

      <a
        href="#servicos"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-full focus:bg-cobalt focus:px-5 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <Nav />

      <main>
        <Hero />
        <Marquee />
        <ServiceBlocks />
        <IntegrationsStrip />
        <Manifesto />
        <FilmBand />
        <Mission />
        <Cases />
        <Projects />
        <CtaBand />
        <Process />
        <Deliverables />
        <About />
        <Team />
        <Insights />
        <Faq />
        <Contact />
      </main>

      <Footer />
    </>
  )
}
