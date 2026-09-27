import { useRef, type RefObject } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { BlurReveal } from './ui/Primitives'
import { useAutoPauseVideo } from '../lib/useAutoPauseVideo'
import { rolagemNativa } from '../lib/rolagem'

/* O vídeo 1440p só roda a partir de md: decodificar isso trava o scroll no
   celular. No mobile fica só o gradiente. */
const VIDEO =
  'absolute inset-0 hidden h-full w-full object-cover opacity-45 [mask-image:radial-gradient(130%_105%_at_50%_50%,black_55%,transparent_98%)] md:block'

/**
 * Vídeo ocupando a largura toda, com parallax no scroll. A cena de partículas
 * some atrás dele (ver KEYFRAMES em TriScene). O parallax — 10% para cada
 * lado, encolhendo de 1,15 para 1,02 — é uma animação guiada pela linha do
 * tempo da seção (.palco-filme e .rola-filme, no index.css), sem JavaScript
 * medindo nada; onde não há o recurso, o framer-motion mede a seção e move
 * o vídeo, como antes.
 */
export function FilmBand() {
  const ref = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  useAutoPauseVideo(videoRef)

  return (
    <section
      ref={ref}
      aria-label="Automação em ação"
      className="palco-filme relative z-10 h-[72svh] overflow-hidden"
    >
      {rolagemNativa ? (
        <video
          ref={videoRef}
          className={`${VIDEO} rola-filme`}
          data-src="/media/plexus.mp4"
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
        />
      ) : (
        <VideoComMola alvo={ref} videoRef={videoRef} />
      )}
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

/** O vídeo medido por JavaScript, para navegadores sem animação guiada pela rolagem. */
function VideoComMola({
  alvo,
  videoRef,
}: {
  alvo: RefObject<HTMLElement | null>
  videoRef: RefObject<HTMLVideoElement | null>
}) {
  const { scrollYProgress } = useScroll({ target: alvo, offset: ['start end', 'end start'] })
  const videoY = useTransform(scrollYProgress, [0, 1], ['-10%', '10%'])
  const videoScale = useTransform(scrollYProgress, [0, 1], [1.15, 1.02])

  return (
    <motion.video
      ref={videoRef}
      style={{ y: videoY, scale: videoScale }}
      className={VIDEO}
      data-src="/media/plexus.mp4"
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
    />
  )
}
