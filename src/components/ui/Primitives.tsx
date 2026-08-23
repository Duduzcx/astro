import {
  useEffect,
  useRef,
  useState,
  type MouseEventHandler,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Eyebrow. Bordered mono pill with the triangle glyph — the "technical" voice. */
export function Label({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-mono text-[11px] tracking-[0.14em] text-[#4dd6e8] uppercase backdrop-blur-sm ${className}`}
    >
      <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5 shrink-0">
        <path d="M6 1.5 10.5 10.5H1.5L6 1.5Z" fill="currentColor" />
      </svg>
      {children}
    </span>
  )
}

/** Huge outlined ghost word drifting behind a section heading. */
export function GiantWord({ word, className = '' }: { word: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['14%', '-14%'])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}
    >
      <motion.span
        style={{ y }}
        className="giant-outline text-[clamp(6rem,21vw,19rem)] leading-none whitespace-nowrap"
      >
        {word}
      </motion.span>
    </div>
  )
}

/**
 * The one filled action on the page. Cobalt, pill, never duplicated within a
 * view — and magnetic: it leans a few pixels toward the cursor.
 */
export function IrisButton({
  href,
  children,
  className = '',
  onClick,
}: {
  href: string
  children: ReactNode
  className?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 320, damping: 22, mass: 0.5 })
  const springY = useSpring(y, { stiffness: 320, damping: 22, mass: 0.5 })

  const onPointerMove = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (prefersReducedMotion()) return
    const rect = event.currentTarget.getBoundingClientRect()
    x.set(((event.clientX - rect.left) / rect.width - 0.5) * 14)
    y.set(((event.clientY - rect.top) / rect.height - 0.5) * 10)
  }
  const onPointerLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.a
      href={href}
      onClick={onClick}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ x: springX, y: springY }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full bg-cobalt px-7 py-3.5 text-[15px] font-[420] text-white transition-colors duration-300 hover:bg-[#6377f2] ${className}`}
    >
      {children}
    </motion.a>
  )
}

/** Content that arrives out of focus: blur + rise, then sharp. For big claims. */
export function BlurReveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24, filter: 'blur(12px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-90px' }}
      transition={{ duration: 0.95, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** 3D tilt on hover for the product panels. Perspective lives here. */
export function Tilt({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const springRX = useSpring(rotateX, { stiffness: 220, damping: 24 })
  const springRY = useSpring(rotateY, { stiffness: 220, damping: 24 })

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion()) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    rotateX.set(-(py - 0.5) * 7)
    rotateY.set((px - 0.5) * 9)
  }
  const onPointerLeave = () => {
    rotateX.set(0)
    rotateY.set(0)
  }

  return (
    <div style={{ perspective: 900 }} className={className}>
      <motion.div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={{ rotateX: springRX, rotateY: springRY }}
      >
        {children}
      </motion.div>
    </div>
  )
}

/** Secondary action. Mercury ghost: ivory hairline pill, never chromatic. */
export function GhostButton({
  href,
  children,
  className = '',
  onClick,
}: {
  href: string
  children: ReactNode
  className?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full border border-ivory/80 px-7 py-3.5 text-[15px] font-[420] text-ivory transition-colors duration-300 hover:bg-ivory/10 ${className}`}
    >
      {children}
    </a>
  )
}

export function ArrowGlyph({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`h-3.5 w-3.5 ${className}`}
    >
      <path
        d="M4 12L12 4M12 4H5.5M12 4V10.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="square"
      />
    </svg>
  )
}

/** Shared scroll reveal. One motion vocabulary across every section. */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Headline that rises line by line from behind a mask. Splitting on an explicit
 * separator rather than on words keeps the line breaks the author intended.
 */
export function LineReveal({
  text,
  className = '',
  delay = 0,
  as: Tag = 'h2',
  trigger = 'view',
}: {
  text: string
  className?: string
  delay?: number
  as?: 'h1' | 'h2' | 'h3'
  /**
   * Above the fold there is nothing to scroll into, and a parent driving variants
   * would swallow `whileInView` anyway — so the hero animates on mount instead.
   */
  trigger?: 'view' | 'mount'
}) {
  const lines = text.split('\n')
  const MotionTag = motion[Tag]

  return (
    /**
     * The trigger lives on the heading, never on the masked line. A line sitting
     * at y:110% is fully clipped by its `overflow: hidden` parent, and
     * IntersectionObserver counts ancestor clipping — so observing the line
     * itself yields ratio 0 forever and the reveal never fires.
     */
    <MotionTag
      className={className}
      initial="hidden"
      {...(trigger === 'mount'
        ? { animate: 'show' }
        : { whileInView: 'show', viewport: { once: true, margin: '-12%' } })}
    >
      {lines.map((line, index) => (
        <span key={line + index} className="block overflow-hidden pb-[0.08em]">
          <motion.span
            className="block"
            variants={{ hidden: { y: '110%' }, show: { y: '0%' } }}
            transition={{
              duration: 0.9,
              delay: delay + index * 0.09,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  )
}

/**
 * Headline that assembles word by word — each word rises out of its own mask
 * with a small rotation. Supports explicit line breaks via \n.
 */
export function WordReveal({
  text,
  className = '',
  delay = 0,
  as: Tag = 'h2',
  trigger = 'view',
}: {
  text: string
  className?: string
  delay?: number
  as?: 'h1' | 'h2' | 'h3'
  trigger?: 'view' | 'mount'
}) {
  const MotionTag = motion[Tag]
  let wordIndex = 0

  return (
    <MotionTag
      className={className}
      initial="hidden"
      {...(trigger === 'mount'
        ? { animate: 'show' }
        : { whileInView: 'show', viewport: { once: true, margin: '-12%' } })}
    >
      {text.split('\n').map((line, lineNumber) => (
        <span key={lineNumber} className="block">
          {line.split(' ').map((word, wordNumber, words) => {
            const index = wordIndex
            wordIndex += 1
            return (
              <span key={`${word}-${wordNumber}`}>
                <span className="inline-block overflow-hidden pb-[0.08em] align-top">
                  <motion.span
                    className="inline-block origin-bottom-left"
                    variants={{ hidden: { y: '112%', rotate: 6 }, show: { y: '0%', rotate: 0 } }}
                    transition={{
                      duration: 0.7,
                      delay: delay + index * 0.055,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    {word}
                  </motion.span>
                </span>
                {wordNumber < words.length - 1 ? ' ' : null}
              </span>
            )
          })}
        </span>
      ))}
    </MotionTag>
  )
}

/** One word that keeps cycling — slides up, blurs out, next one arrives. */
export function RotatingWord({ words, className = '' }: { words: readonly string[]; className?: string }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const id = setInterval(() => setIndex((current) => (current + 1) % words.length), 2300)
    return () => clearInterval(id)
  }, [words.length])

  return (
    <span className={`inline-block ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={words[index]}
          initial={{ y: '85%', opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-85%', opacity: 0, filter: 'blur(6px)' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="text-spectrum-animated inline-block font-[480]"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/**
 * "R$ -38%"-style stat that counts from zero when scrolled into view.
 * Splits any prefix and suffix around the first integer in the string.
 */
export function AnimatedNumber({ value, className = '' }: { value: string; className?: string }) {
  const match = value.match(/^([^\d]*)(\d+)(.*)$/)
  const prefix = match ? match[1] : ''
  const target = match ? Number(match[2]) : 0
  const suffix = match ? match[3] : ''
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const motionValue = useMotionValue(0)
  const text = useTransform(motionValue, (current) => `${prefix}${Math.round(current)}${suffix}`)

  useEffect(() => {
    if (!inView) return
    if (prefersReducedMotion()) {
      motionValue.set(target)
      return
    }
    const controls = animate(motionValue, target, { duration: 1.3, ease: 'easeOut' })
    return () => controls.stop()
  }, [inView, target, motionValue])

  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  )
}

/** Section wrapper. Owns vertical rhythm so no child ever sets its own section padding. */
export function Section({
  id,
  children,
  className = '',
}: {
  id?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={`py-24 md:py-32 ${className}`}>
      <div className="shell">{children}</div>
    </section>
  )
}

/** Section header: label, title, optional lead paragraph. */
export function SectionHead({
  label,
  title,
  lead,
  className = '',
}: {
  label: string
  title: string
  lead?: string
  className?: string
}) {
  return (
    <div className={className}>
      <Reveal>
        <Label>{label}</Label>
      </Reveal>
      <LineReveal
        text={title}
        delay={0.08}
        className="mt-7 max-w-3xl text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[1.05]"
      />
      {lead ? (
        <Reveal delay={0.2}>
          <p className="mt-8 max-w-xl text-[clamp(1rem,1.35vw,1.125rem)] leading-[1.5] text-ash">
            {lead}
          </p>
        </Reveal>
      ) : null}
    </div>
  )
}
