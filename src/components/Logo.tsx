import { AstroMark } from './brand/AstroMark'

/**
 * Assinatura da marca: símbolo, ASTRO em caixa alta e "soluções" em script.
 * `markOnly` esconde o texto onde não cabe.
 */
export function Logo({
  className = '',
  markOnly = false,
}: {
  className?: string
  markOnly?: boolean
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <AstroMark className="h-9 w-9 shrink-0" title={markOnly ? 'Astro Soluções' : undefined} />
      {markOnly ? null : (
        <span className="flex flex-col leading-none">
          <span className="font-impact text-[19px] tracking-[0.04em] text-ivory">ASTRO</span>
          <span className="-mt-1 self-end text-[15px] text-[#8db4f5] [font-family:'Allura',cursive]">
            soluções
          </span>
        </span>
      )}
    </span>
  )
}
