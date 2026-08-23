import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowGlyph, BlurReveal, IrisButton } from './ui/Primitives'

/**
 * Mid-page conversion moment over the alpine photograph, with scroll parallax —
 * the Mercury hero treatment reused as a selling band.
 */
export function CtaBand() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const imageY = useTransform(scrollYProgress, [0, 1], ['-12%', '12%'])

  return (
    <section ref={ref} aria-label="Agendar diagnóstico" className="relative z-10 overflow-hidden">
      <motion.img
        style={{ y: imageY }}
        src="/media/alpine.jpg"
        alt=""
        loading="lazy"
        className="absolute inset-0 h-[124%] w-full object-cover opacity-50 [filter:saturate(0.55)_brightness(0.6)]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-onyx via-onyx/40 to-onyx" />

      <div className="relative py-28 md:py-36">
        <div className="shell">
          <BlurReveal className="mx-auto max-w-2xl text-center">
            <p className="font-impact text-[clamp(2.1rem,4.8vw,3.8rem)] leading-[1.06] text-ivory">
              45 minutos. Zero compromisso.
              <br />O mapa do que dá pra automatizar.
            </p>
            <p className="mx-auto mt-5 max-w-lg text-ash">
              Uma conversa de trabalho, não uma ligação de vendas: você sai com uma lista do que dá
              pra tirar do manual — com ou sem a gente.
            </p>
            <div className="mt-9 flex justify-center">
              <IrisButton href="#contato">
                Agendar conversa gratuita <ArrowGlyph />
              </IrisButton>
            </div>
          </BlurReveal>
        </div>
      </div>
    </section>
  )
}
