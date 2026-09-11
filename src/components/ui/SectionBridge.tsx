import { motion } from 'framer-motion'

/**
 * Ponte entre duas seções: uma linha de luz que se desenha do centro para as
 * pontas quando a costura entra na tela, um clarão suave por baixo e uma
 * faísca que percorre a linha uma vez. Só transform e opacidade, nada que
 * force layout — pode repetir seis vezes na página sem pesar no celular.
 */
export function SectionBridge({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative z-10 h-px w-full overflow-x-clip ${className}`}
    >
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-12% 0px' }}
        transition={{ duration: 1.2 }}
        className="absolute top-0 left-1/2 h-24 w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cobalt/12 blur-xl animate-[astro-bridge-glow_6s_ease-in-out_infinite]"
      />
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        whileInView={{ scaleX: 1, opacity: 1 }}
        viewport={{ once: true, margin: '-12% 0px' }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-x-[8%] top-0 h-px origin-center bg-gradient-to-r from-transparent via-[#8db4f5]/70 to-transparent"
      />
      <motion.span
        initial={{ x: 0, opacity: 0 }}
        whileInView={{ x: 'calc(100vw - 12rem)', opacity: [0, 1, 1, 0] }}
        viewport={{ once: true, margin: '-12% 0px' }}
        transition={{ duration: 1.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="absolute top-0 left-[8%] h-px w-16 bg-gradient-to-r from-transparent via-ivory to-transparent"
      />
    </div>
  )
}
