import { useScroll, useSpring, useTransform, useVelocity } from 'framer-motion'

/**
 * Inclinação que acompanha a velocidade do scroll: arrastar rápido inclina o
 * bloco uns graus e a mola devolve quando o dedo para. Só transform.
 */
export function useScrollLean(max = 2.5) {
  /* Zero no celular: `skewY` obriga o navegador a repintar o bloco inteiro a
     cada frame, e num grid de cards com vidro isso é o suficiente para
     engasgar a rolagem por toque. No desktop o custo é irrelevante. */
  const wide = typeof window !== 'undefined' && window.innerWidth >= 1024
  const { scrollY } = useScroll()
  const velocity = useVelocity(scrollY)
  return useSpring(useTransform(velocity, [-2400, 2400], wide ? [max, -max] : [0, 0]), {
    stiffness: 180,
    damping: 30,
    mass: 0.6,
  })
}
