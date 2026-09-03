import { useId } from 'react'

/**
 * Símbolo da Astro: anel orbital aberto com uma estrela de quatro pontas na
 * abertura. Mesma geometria dos arquivos em `public/logo/`. Mudou aqui, muda lá.
 */
const RING_PATH = 'M36.7 15.4A22 14.5 -38 1 0 43 36.7'
const STAR_PATH =
  'M51.5 9.2C51.5 16.6 54.1 19.5 60.8 19.5C54.1 19.5 51.5 22.4 51.5 29.8C51.5 22.4 48.9 19.5 42.2 19.5C48.9 19.5 51.5 16.6 51.5 9.2Z'

/**
 * `light` é o padrão do site (fundo escuro). `gradient` é a versão de fundo
 * claro. `mono` herda `currentColor`, para a marca acompanhar o texto.
 */
type Tone = 'light' | 'gradient' | 'navy' | 'mono'

export function AstroMark({
  className = '',
  tone = 'light',
  title,
}: {
  className?: string
  tone?: Tone
  title?: string
}) {
  /* Os ids de gradiente precisam ser únicos: a marca aparece várias vezes na página. */
  const id = useId().replace(/:/g, '')
  const ringId = `ring-${id}`
  const starId = `star-${id}`

  const ringStroke =
    tone === 'gradient' ? `url(#${ringId})` : tone === 'navy' ? '#12294e' : tone === 'mono' ? 'currentColor' : '#f5f7fb'
  const starFill =
    tone === 'gradient' || tone === 'light'
      ? `url(#${starId})`
      : tone === 'navy'
        ? '#12294e'
        : 'currentColor'

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {tone === 'gradient' ? (
        <linearGradient id={ringId} x1="8" y1="50" x2="46" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5c7fa6" />
          <stop offset="1" stopColor="#13294c" />
        </linearGradient>
      ) : null}
      {tone === 'gradient' || tone === 'light' ? (
        <linearGradient id={starId} x1="51.5" y1="9.2" x2="51.5" y2="29.8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={tone === 'light' ? '#4d84e0' : '#2b7fc0'} />
          <stop offset="1" stopColor={tone === 'light' ? '#8db4f5' : '#5fbaec'} />
        </linearGradient>
      ) : null}
      <path d={RING_PATH} fill="none" stroke={ringStroke} strokeWidth="4" strokeLinecap="round" />
      <path d={STAR_PATH} fill={starFill} />
    </svg>
  )
}

/** Só a estrela. Serve de marcador nos eyebrows e nas listas. */
export function AstroStar({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="41 9 20.5 21.3" className={className} aria-hidden="true">
      <path d={STAR_PATH} fill="currentColor" />
    </svg>
  )
}
