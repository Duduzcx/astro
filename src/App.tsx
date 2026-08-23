import { Suspense, lazy } from 'react'
import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { ServiceBlocks } from './components/ServiceBlocks'
import { Manifesto } from './components/Manifesto'
import { Mission } from './components/Mission'
import { Process } from './components/Process'
import { Cases } from './components/Cases'
import { Team } from './components/Team'
import { Clients } from './components/Clients'
import { Testimonials } from './components/Testimonials'
import { Faq } from './components/Faq'
import { Footer } from './components/Footer'

/** three.js is ~500kB minified — the scene lazy-loads and fades in under the hero. */
const TriScene = lazy(() =>
  import('./components/TriScene').then((module) => ({ default: module.TriScene })),
)

/**
 * One fixed WebGL scene behind everything; the sections scroll over it and the
 * particle field morphs per section (see TriScene KEYFRAMES). Section order and
 * the keyframe table are coupled — reorder both together.
 */
export default function App() {
  return (
    <>
      <Suspense fallback={null}>
        <TriScene />
      </Suspense>

      <a
        href="#servicos"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-full focus:bg-cobalt focus:px-5 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <Nav />

      <main>
        <Hero />
        <ServiceBlocks />
        <Manifesto />
        <Mission />
        <Process />
        <Cases />
        <Team />
        <Clients />
        <Testimonials />
        <Faq />
      </main>

      <Footer />
    </>
  )
}
