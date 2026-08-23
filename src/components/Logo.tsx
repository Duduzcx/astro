/** Wordmark + triangle mark. The mark quotes the particle field at glyph scale. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
        <path d="M12 2.6 21 20H3L12 2.6Z" stroke="#5266eb" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 9.4 16.4 18H7.6L12 9.4Z" fill="#ededf3" />
      </svg>
      <span className="text-[17px] font-[480] tracking-[-0.01em] text-ivory">Astro Soluções</span>
    </span>
  )
}
