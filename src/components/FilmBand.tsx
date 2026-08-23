import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { BlurReveal } from './ui/Primitives'
import { useAutoPauseVideo } from '../lib/useAutoPauseVideo'

/**
 * Full-bleed footage with scroll parallax: a cyan network of messages finding
 * their way — literal footage of what an automation does. The particle scene
 * fades out behind it (see TriScene keyframes).
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
      <motion.video
        ref={videoRef}
        style={{ y: videoY, scale: videoScale }}
        className="absolute inset-0 h-full w-full object-cover opacity-60 [filter:saturate(0.85)_brightness(0.6)] [mask-image:radial-gradient(130%_105%_at_50%_50%,black_55%,transparent_98%)]"
        src="/media/plexus.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-onyx via-onyx/25 to-onyx" />

      <div className="relative flex h-full items-center">
        <div className="shell">
          <BlurReveal className="max-w-2xl">
            <p className="label-voice text-[11px]">Funcionando agora, de verdade</p>
            <p className="mt-5 text-[clamp(1.8rem,4vw,3.2rem)] leading-[1.15] font-[480] tracking-[-0.01em] text-ivory">
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
