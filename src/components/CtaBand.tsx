import { useRef, type RefObject } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowGlyph, BlurReveal, IrisButton } from './ui/Primitives'
import { rolagemNativa } from '../lib/rolagem'

/* A foto é 24% mais alta que a seção e anda mais devagar que a página: 12%
   para cada lado enquanto a seção atravessa a tela. */
const IMAGEM =
  'absolute inset-0 h-[124%] w-full object-cover opacity-50 [filter:saturate(0.55)_brightness(0.6)]'

/**
 * Bloco de conversão no meio da página, com parallax na foto de fundo. O
 * parallax é uma animação guiada pela linha do tempo da seção (.palco-cta e
 * .rola-cta, no index.css), sem JavaScript medindo nada; onde não há o
 * recurso, o framer-motion mede a seção e move a foto, como antes.
 */
export function CtaBand() {
  const ref = useRef<HTMLElement>(null)

  return (
    <section
      ref={ref}
      aria-label="Agendar diagnóstico"
      className="palco-cta relative z-10 overflow-hidden"
    >
      {rolagemNativa ? (
        <img
          src="/media/alpine.jpg"
          alt=""
          loading="lazy"
          decoding="async"
          className={`${IMAGEM} rola-cta`}
        />
      ) : (
        <FotoComMola alvo={ref} />
      )}
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

/** A foto medida por JavaScript, para navegadores sem animação guiada pela rolagem. */
function FotoComMola({ alvo }: { alvo: RefObject<HTMLElement | null> }) {
  const { scrollYProgress } = useScroll({ target: alvo, offset: ['start end', 'end start'] })
  const imageY = useTransform(scrollYProgress, [0, 1], ['-12%', '12%'])

  return (
    <motion.img
      style={{ y: imageY }}
      src="/media/alpine.jpg"
      alt=""
      loading="lazy"
      decoding="async"
      className={IMAGEM}
    />
  )
}
