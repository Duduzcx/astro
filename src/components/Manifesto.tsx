import { Reveal } from './ui/Primitives'

/**
 * Reference pattern: full-screen centred statements over the dispersed particle
 * field. The type is the scene here — nothing else on screen.
 */
const statements = [
  'Esse é o seu negócio hoje. Processos críticos espalhados por planilhas, e-mails e sistemas que não conversam entre si.',
  'Ferramentas de prateleira são engessadas e envelhecem rápido. Mais um sistema que a equipe tolera, não usa.',
  'Elas não entendem o que a sua operação precisa. A gente entende — e constrói exatamente o que falta.',
] as const

export function Manifesto() {
  return (
    <section id="manifesto" aria-label="Manifesto">
      {statements.map((statement) => (
        <div key={statement} className="relative z-10 flex min-h-[80svh] items-center">
          <div className="shell">
            <Reveal className="mx-auto max-w-4xl">
              <p className="text-center text-[clamp(1.7rem,3.6vw,2.9rem)] leading-[1.25] font-[480] tracking-[-0.01em] text-ivory">
                {statement}
              </p>
            </Reveal>
          </div>
        </div>
      ))}
    </section>
  )
}
