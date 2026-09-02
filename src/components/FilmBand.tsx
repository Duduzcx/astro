import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { BlurReveal } from './ui/Primitives'
import { useAutoPauseVideo } from '../lib/useAutoPauseVideo'

/**
 * Vídeo ocupando a largura toda, com parallax no scroll. A cena de partículas
 * some atrás dele (ver KEYFRAMES em TriScene).
 */
export function FilmBand() {
  const ref = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  useAutoPauseVideo(videoRef)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const videoY = useTransform(scrollYProgress, [0, 1], ['-10%', '10%'])
  const videoScale = useTransform(scrollYProgress, [0, 1], [1.15, 1.02])

  return (
    <section
      ref={ref}
      aria-label="Automação em ação"
      className="relative z-10 h-[72svh] overflow-hidden"
    >
      {/* O vídeo 1440p só roda a partir de md: decodificar isso trava o scroll
          no celular. No mobile fica só o gradiente. */}
      <motion.video
        ref={videoRef}
        style={{ y: videoY, scale: videoScale }}
        className="absolute inset-0 hidden h-full w-full object-cover opacity-45 [mask-image:radial-gradient(130%_105%_at_50%_50%,black_55%,transparent_98%)] md:block"
        src="/media/plexus.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0c1526] via-[#101c38]/60 to-onyx md:hidden" />
      <div className="absolute inset-0 bg-gradient-to-b from-onyx via-onyx/35 to-onyx" />

      <div className="relative flex h-full items-center">
        <div className="shell">
          <BlurReveal className="max-w-2xl">
            <p className="label-voice text-[11px]">Funcionando agora, de verdade</p>
            <p className="font-impact mt-5 text-[clamp(2rem,4.6vw,3.8rem)] leading-[1.06] text-ivory">
              Enquanto você dorme, o robô{' '}
              <span className="text-spectrum-animated">cobra, confere e responde</span>.
            </p>
            <p className="mt-5 max-w-lg text-ash">
              Cada mensagem, cobrança e planilha encontra o caminho sozinha. Sem esquecer, sem
              errar, sem tirar férias.
            </p>
          </BlurReveal>
        </div>
      </div>
    </section>
  )
}
