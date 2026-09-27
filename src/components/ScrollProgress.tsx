import { motion, useScroll, useSpring } from 'framer-motion'
import { rolagemNativa } from '../lib/rolagem'

const BARRA =
  'fixed inset-x-0 top-0 z-[60] h-[2.5px] origin-left bg-gradient-to-r from-cobalt via-[#5a8fe8] to-[#8db4f5]'

/**
 * Linha fina de progresso presa acima do menu. Cresce com a página inteira
 * por uma animação guiada pela rolagem (.rola-progresso, no index.css);
 * onde não há o recurso, o framer-motion a move com uma mola.
 */
export function ScrollProgress() {
  if (rolagemNativa) return <div aria-hidden="true" className={`${BARRA} rola-progresso`} />
  return <BarraComMola />
}

function BarraComMola() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 })

  return <motion.div aria-hidden="true" style={{ scaleX }} className={BARRA} />
}
