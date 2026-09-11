import { useScroll, useSpring, useTransform, useVelocity } from 'framer-motion'

/**
 * Inclinação que acompanha a velocidade do scroll: arrastar rápido inclina o
 * bloco uns graus e a mola devolve quando o dedo para. Só transform.
 */
export function useScrollLean(max = 2.5) {
  const { scrollY } = useScroll()
  const velocity = useVelocity(scrollY)
  return useSpring(useTransform(velocity, [-2400, 2400], [max, -max]), {
    stiffness: 180,
    damping: 30,
    mass: 0.6,
  })
}
