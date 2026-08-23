import { Reveal } from './ui/Primitives'

/**
 * Full-bleed footage under a scrim — the one photographic-motion moment on the
 * page. Desaturated and darkened to sit inside the Mercury palette; the
 * particle scene fades out behind it (see TriScene keyframes).
 */
export function FilmBand() {
  return (
    <section aria-label="O sistema trabalhando" className="relative z-10 h-[72svh] overflow-hidden">
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-70 [filter:saturate(0.4)_brightness(0.55)]"
        src="/media/pulse.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-onyx via-onyx/30 to-onyx" />

      <div className="relative flex h-full items-center">
        <div className="shell">
          <Reveal className="max-w-2xl">
            <p className="label-voice text-[11px]">Rodando agora, em produção</p>
            <p className="mt-5 text-[clamp(1.8rem,4vw,3.2rem)] leading-[1.15] font-[480] tracking-[-0.01em] text-ivory">
              Enquanto você dorme, o sistema cobra, concilia e responde.
            </p>
            <p className="mt-5 max-w-lg text-ash">
              Automação não tira férias, não esquece follow-up e não erra de linha na planilha. É
              isso que a gente constrói.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
