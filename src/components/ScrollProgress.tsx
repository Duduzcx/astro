import { motion, useScroll, useSpring } from 'framer-motion'

/** Thin cobalt→cyan progress line pinned above the nav. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 })

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[2.5px] origin-left bg-gradient-to-r from-cobalt via-[#5a8fe8] to-[#8db4f5]"
    />
  )
}
