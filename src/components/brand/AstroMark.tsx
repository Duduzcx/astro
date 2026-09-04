/**
 * Símbolo da Astro: um disco recortado em quatro pétalas, e o vão entre elas
 * desenha uma estrela de quatro pontas. As fendas têm largura constante do
 * centro à borda, então a marca fica idêntica em qualquer escala.
 *
 * Uma pétala só; as outras três são a mesma path girada em 90°. Mudou a
 * geometria aqui, mudou nos arquivos de `public/logo/` também.
 */
const PETAL =
  'M 71.84 50.99 Q 79.31 57.61 91.00 60.00 Q 79.31 62.39 71.84 69.01 L 93.91 91.08 A 46 46 0 0 0 93.91 28.92 Z'

/** Ordem de desenho: topo, direita, base, esquerda. */
const PETAL_ANGLES = [-90, 0, 90, 180] as const

/* Paleta da marca. O azul lidera, o marinho fecha. */
const BLUE = '#1E86CF'
const STEEL = '#2E5A87'
const NAVY = '#0B2545'
const SLATE = '#5B7A99'

/**
 * `tonal` é a versão cheia para fundo claro: as quatro peças giram em tom, do
 * claro no topo ao marinho embaixo, uma volta de luz e não quatro cores soltas.
 * `duo` alterna só dois tons, mais gráfica e mais barata de imprimir. `mono` é
 * a de traço único, indicada abaixo de 32px, onde as fendas somam e o disco
 * fecha. `negative` e `night` são as de fundo escuro — esta última guarda o
 * azul da marca, que o branco puro perde.
 */
type Tone = 'tonal' | 'duo' | 'mono' | 'negative' | 'night'

const TONES: Record<Tone, readonly [string, string, string, string]> = {
  tonal: [BLUE, STEEL, NAVY, SLATE],
  duo: [BLUE, NAVY, BLUE, NAVY],
  mono: [NAVY, NAVY, NAVY, NAVY],
  negative: ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'],
  night: ['#FFFFFF', BLUE, '#FFFFFF', BLUE],
}

export function AstroMark({
  className = '',
  tone = 'night',
  title,
}: {
  className?: string
  tone?: Tone
  title?: string
}) {
  const fills = TONES[tone]

  return (
    <svg
      viewBox="-8 -8 136 136"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {PETAL_ANGLES.map((angle, index) => (
        <path key={angle} d={PETAL} fill={fills[index]} transform={`rotate(${angle} 60 60)`} />
      ))}
    </svg>
  )
}

/**
 * A estrela sozinha: é o vão entre as quatro pétalas, remontado como contorno
 * próprio. Serve de marcador nos eyebrows e nas listas — o mesmo desenho da
 * marca, na menor unidade possível.
 */
const STAR =
  'M 71.84 50.99 Q 79.31 57.61 91 60 Q 79.31 62.39 71.84 69.01 ' +
  'L 69.01 71.84 Q 62.39 79.31 60 91 Q 57.61 79.31 50.99 71.84 ' +
  'L 48.16 69.01 Q 40.69 62.39 29 60 Q 40.69 57.61 48.16 50.99 ' +
  'L 50.99 48.16 Q 57.61 40.69 60 29 Q 62.39 40.69 69.01 48.16 Z'

export function AstroStar({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="29 29 62 62" className={className} aria-hidden="true">
      <path d={STAR} fill="currentColor" />
    </svg>
  )
}
