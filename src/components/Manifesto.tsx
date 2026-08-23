import { Reveal } from './ui/Primitives'

/**
 * One full-screen statement over the dispersed particle field — the landing
 * page pauses for a single breath before showing proof.
 */
export function Manifesto() {
  return (
    <section id="manifesto" aria-label="Manifesto">
      <div className="relative z-10 flex min-h-[85svh] items-center">
        <div className="shell">
          <Reveal className="mx-auto max-w-4xl">
            <p className="text-center text-[clamp(1.7rem,3.6vw,2.9rem)] leading-[1.25] font-[480] tracking-[-0.01em] text-ivory">
              Hoje o seu negócio funciona na base de planilha, papel e memória.{' '}
              <span className="text-spectrum">A gente troca isso por um sistema que trabalha
              sozinho.</span>
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
