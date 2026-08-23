import { ArrowGlyph, IrisButton, Reveal } from './ui/Primitives'

/**
 * Mid-page conversion moment over the alpine photograph — the Mercury hero
 * treatment (cool, desaturated, dark overlay) reused as a selling band.
 */
export function CtaBand() {
  return (
    <section aria-label="Agendar diagnóstico" className="relative z-10 overflow-hidden">
      <img
        src="/media/alpine.jpg"
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-50 [filter:saturate(0.55)_brightness(0.6)]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-onyx via-onyx/40 to-onyx" />

      <div className="relative py-28 md:py-36">
        <div className="shell">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-[clamp(1.9rem,4.2vw,3.2rem)] leading-[1.15] font-[480] tracking-[-0.01em] text-ivory">
              45 minutos. Zero compromisso.
              <br />O mapa do que dá pra automatizar.
            </p>
            <p className="mx-auto mt-5 max-w-lg text-ash">
              O diagnóstico é uma conversa de trabalho, não uma call de vendas: você sai com uma
              lista priorizada do que travaria de sair do manual — com ou sem a gente.
            </p>
            <div className="mt-9 flex justify-center">
              <IrisButton href="#contato">
                Agendar diagnóstico gratuito <ArrowGlyph />
              </IrisButton>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
