/** Wordmark + orbital mark. The mark repeats the hero's ring-around-a-core idea at 1:100 scale. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
        <circle cx="12" cy="12" r="3.4" fill="#cfe2ff" />
        <ellipse
          cx="12"
          cy="12"
          rx="10.6"
          ry="4.6"
          stroke="#5aa9ff"
          strokeWidth="1.1"
          transform="rotate(-28 12 12)"
        />
        <circle cx="20.2" cy="8.1" r="1.5" fill="#ffffff" />
      </svg>
      <span className="text-[17px] font-medium tracking-[-0.02em] text-platinum">Astro</span>
    </span>
  )
}
