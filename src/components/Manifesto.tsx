import { BlurReveal, GiantWord } from './ui/Primitives'

/** Uma declaração em tela cheia sobre o campo de partículas disperso. */
export function Manifesto() {
  return (
    <section id="manifesto" aria-label="Manifesto">
      <div className="relative z-10 flex items-center py-24 lg:min-h-[85svh] lg:py-16">
        <GiantWord word="Manual" />
        <div className="shell">
          <BlurReveal className="mx-auto max-w-4xl">
            <p className="text-center text-[clamp(1.7rem,3.6vw,2.9rem)] leading-[1.25] font-[480] tracking-[-0.01em] text-ivory">
              Hoje o seu negócio funciona na base de planilha, papel e memória.{' '}
              <span className="text-spectrum-animated">A gente troca isso por um sistema que
              trabalha sozinho.</span>
            </p>
          </BlurReveal>
        </div>
      </div>
    </section>
  )
}
