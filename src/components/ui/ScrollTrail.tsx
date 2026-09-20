import { useRef } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'

/**
 * Trilha de energia: um fio de um pixel na calha à esquerda do conteúdo que
 * acende de cima para baixo conforme a seção atravessa a tela, com um ponto
 * de luz na frente. Guia a leitura sem pedir atenção.
 *
 * Só transform: a parte acesa é um scaleY com origem no topo e o ponto anda
 * por translate, então a rolagem não mede nem repinta nada. O progresso vem
 * do useScroll com a própria trilha como alvo (ela ocupa a altura toda da
 * seção), passado por uma mola curta para não tremer com o scroll do Lenis.
 * Fica escondida abaixo de lg: no celular a calha não existe.
 */
export function ScrollTrail({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 78%', 'end 45%'] })
  const progresso = useSpring(scrollYProgress, { stiffness: 110, damping: 26, mass: 0.5 })
  const cabeca = useTransform(progresso, (v) => `${(v - 1) * 100}%`)

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute top-0 bottom-0 left-3 hidden w-px lg:block ${className}`}
    >
      <div className="absolute inset-0 bg-white/[0.07]" />
      <motion.div
        style={{ scaleY: progresso }}
        className="absolute inset-0 origin-top bg-gradient-to-b from-cobalt/30 via-[#8db4f5] to-[#cfe0ff] shadow-[0_0_10px_rgba(141,180,245,0.55)]"
      />
      <motion.div style={{ y: cabeca }} className="absolute inset-0">
        <div className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#e2edff] shadow-[0_0_14px_4px_rgba(141,180,245,0.65)]" />
      </motion.div>
    </div>
  )
}
