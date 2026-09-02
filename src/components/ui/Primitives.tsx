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
import { AstroStar } from '../brand/AstroMark'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Eyebrow: pílula com borda, texto em mono e a estrela da marca. */
export function Label({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-mono text-[10px] tracking-[0.1em] text-[#8db4f5] uppercase sm:text-[11px] sm:tracking-[0.14em] ${className}`}
    >
      <AstroStar className="h-2.5 w-2.5 shrink-0" />
      {children}
    </span>
  )
}

/** Palavra gigante vazada, derivando atrás do título da seção. */
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
 * A única ação preenchida da página: cobalto, pílula, nunca repetida na mesma
 * tela. Inclina alguns pixels na direção do cursor.
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
      className={`group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-full bg-cobalt px-7 py-3.5 text-[15px] font-[420] text-white transition-colors duration-300 hover:bg-[#5d92ea] ${className}`}
    >
      {children}
      {/* Brilho passando por cima no hover. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
      />
    </motion.a>
  )
}

/** Conteúdo que chega desfocado: blur mais subida e depois nitidez. Para as frases grandes. */
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

/** Inclinação 3D no hover dos painéis de produto. A perspectiva mora aqui. */
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

/** Ação secundária: pílula de contorno ivory, nunca colorida. */
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

/** Reveal de scroll compartilhado. Um só vocabulário de movimento no site inteiro. */
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
 * Título que sobe linha por linha de trás de uma máscara. Quebrar por separador
 * explícito, e não por palavra, preserva as quebras que o autor quis.
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
   * Acima da dobra não há nada para rolar, e um pai controlando variants
   * engoliria o `whileInView`. Por isso o hero anima no mount.
   */
  trigger?: 'view' | 'mount'
}) {
  const lines = text.split('\n')
  const MotionTag = motion[Tag]

  return (
    /**
     * O gatilho fica no título, nunca na linha mascarada. Uma linha em y:110%
     * está inteiramente cortada pelo `overflow: hidden` do pai, e o
     * IntersectionObserver conta o corte do ancestral: observar a própria linha
     * daria ratio 0 para sempre e o reveal nunca dispararia.
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
 * Título que se monta palavra por palavra, cada uma saindo da própria máscara
 * com uma leve rotação. Aceita quebra explícita com \n.
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

/** Uma palavra que fica trocando: sobe, desfoca e a próxima chega. */
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
 * Número que conta do zero quando entra na tela. Separa prefixo e sufixo em
 * volta do primeiro inteiro da string.
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

/** Wrapper de seção. Dono do ritmo vertical: nenhum filho define o próprio padding. */
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

/** Cabeçalho de seção: label, título e parágrafo opcional. */
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
