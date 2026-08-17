import type { MouseEventHandler, ReactNode } from 'react'
import { motion } from 'framer-motion'

/** Eyebrow. Amber is the emphasis colour and appears nowhere else. */
export function Label({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`block font-mono text-[12px] font-medium tracking-[0.16em] text-amber uppercase ${className}`}
    >
      {children}
    </span>
  )
}

/** Dashed hairline. The only separator in the system. */
export function DashedRule({ className = '' }: { className?: string }) {
  return <hr className={`dashed-rule ${className}`} />
}

/**
 * The one filled action on the page. Violet, pill, never duplicated within a
 * view — its scarcity is what makes it read as *the* next step.
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
  return (
    <motion.a
      href={href}
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full bg-iris px-7 py-4 text-[14px] font-medium tracking-[0.02em] text-platinum uppercase shadow-[0_0_0_0_rgba(128,82,255,0.5)] transition-shadow duration-300 hover:shadow-[0_0_40px_-6px_rgba(128,82,255,0.85)] ${className}`}
    >
      {children}
    </motion.a>
  )
}

/** Secondary action. Bare text with a rule under it — no container competes with the pill. */
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
      className={`group inline-flex items-center gap-2.5 py-4 text-[14px] font-normal tracking-[0.02em] text-silver uppercase transition-colors duration-300 hover:text-platinum ${className}`}
    >
      {children}
      <span className="block h-px w-6 bg-current transition-all duration-300 group-hover:w-10" />
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
          <p className="mt-8 max-w-xl text-[clamp(1rem,1.35vw,1.125rem)] leading-[1.5] text-silver">
            {lead}
          </p>
        </Reveal>
      ) : null}
    </div>
  )
}
