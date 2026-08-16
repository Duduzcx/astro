import type { MouseEventHandler, ReactNode } from 'react'
import { motion } from 'framer-motion'

/** Eyebrow. Mono + wide tracking so labels read as instrument panel, not decoration. */
export function Label({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <span className={`label-voice block text-[11px] ${className}`}>{children}</span>
}

/** Dashed hairline. The only separator in the system. */
export function DashedRule({ className = '' }: { className?: string }) {
  return <hr className={`dashed-rule ${className}`} />
}

/** Primary CTA. The gradient appears here and nowhere else. */
export function NebulaButton({
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
      className={`nebula inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#03102e] transition-[filter,transform] duration-200 hover:brightness-110 active:translate-y-px ${className}`}
    >
      {children}
    </a>
  )
}

/** Secondary action. Border does the work — no fill, no gradient. */
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
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-mist/60 px-7 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-mist transition-colors duration-200 hover:border-mist hover:bg-mist/10 ${className}`}
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
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
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
  title: ReactNode
  lead?: string
  className?: string
}) {
  return (
    <Reveal className={className}>
      <Label>{label}</Label>
      <h2 className="mt-6 max-w-2xl text-[clamp(2rem,5vw,3.25rem)] leading-[0.9] uppercase">
        {title}
      </h2>
      {lead ? (
        <p className="mt-7 max-w-xl text-[clamp(1rem,1.5vw,1.2rem)] leading-[1.26] text-mist">
          {lead}
        </p>
      ) : null}
    </Reveal>
  )
}
