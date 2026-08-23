/** Brand lockup from the manual: ASTRO in impact caps, "soluções" in script. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
        <path d="M12 2.6 21 20H3L12 2.6Z" stroke="#8434ce" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 9.4 16.4 18H7.6L12 9.4Z" fill="#fffcf3" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="font-impact text-[19px] tracking-[0.04em] text-ivory">ASTRO</span>
        <span className="-mt-1 self-end text-[15px] text-[#c9a0ff] [font-family:'Allura',cursive]">
          soluções
        </span>
      </span>
    </span>
  )
}
