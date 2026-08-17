type Variant = {
  /** Background motif behind the object. */
  field: 'rules' | 'grid' | 'arcs' | 'hatch'
  tilt: number
  rings: { rx: number; ry: number; dashed?: boolean }[]
  core: number
  satellites: { angle: number; distance: number; size: number }[]
  from: string
  to: string
}

/**
 * Six plates, one per practice. They share a family — a lit core inside an orbital
 * figure on engineering paper — but no two repeat the same geometry, so the grid
 * reads as illustrated rather than as one drawing pasted six times.
 */
const VARIANTS: Variant[] = [
  // Sites: a single wide orbit, wide open, like a page in a viewport.
  {
    field: 'rules',
    tilt: -14,
    rings: [{ rx: 96, ry: 30 }],
    core: 30,
    satellites: [{ angle: 20, distance: 96, size: 3 }],
    from: '#4de0ff',
    to: '#1b4dff',
  },
  // Sistemas: concentric shells — layers of one thing.
  {
    field: 'grid',
    tilt: 0,
    rings: [
      { rx: 52, ry: 52 },
      { rx: 72, ry: 72, dashed: true },
      { rx: 92, ry: 92 },
    ],
    core: 28,
    satellites: [{ angle: 315, distance: 72, size: 2.5 }],
    from: '#7b5cff',
    to: '#4de0ff',
  },
  // Automações: a tight loop that closes on itself.
  {
    field: 'arcs',
    tilt: 38,
    rings: [
      { rx: 78, ry: 26, dashed: true },
      { rx: 58, ry: 58 },
    ],
    core: 22,
    satellites: [
      { angle: 0, distance: 78, size: 3.5 },
      { angle: 180, distance: 78, size: 2 },
    ],
    from: '#4de0ff',
    to: '#7b5cff',
  },
  // Integrações: two orbits crossing at an angle — two systems meeting.
  {
    field: 'hatch',
    tilt: 26,
    rings: [
      { rx: 92, ry: 34 },
      { rx: 92, ry: 34, dashed: true },
    ],
    core: 24,
    satellites: [
      { angle: 30, distance: 92, size: 3 },
      { angle: 210, distance: 92, size: 3 },
    ],
    from: '#1b4dff',
    to: '#4de0ff',
  },
  // SaaS: stacked ellipses rising — tenants on one platform.
  {
    field: 'rules',
    tilt: -30,
    rings: [
      { rx: 66, ry: 20 },
      { rx: 84, ry: 26 },
      { rx: 102, ry: 32, dashed: true },
    ],
    core: 26,
    satellites: [{ angle: 145, distance: 102, size: 2.5 }],
    from: '#7b5cff',
    to: '#cfe2ff',
  },
  // IA: a cluster of satellites around a bright core.
  {
    field: 'grid',
    tilt: 12,
    rings: [{ rx: 74, ry: 74, dashed: true }],
    core: 34,
    satellites: [
      { angle: 35, distance: 74, size: 3 },
      { angle: 130, distance: 74, size: 2 },
      { angle: 250, distance: 74, size: 2.5 },
      { angle: 305, distance: 74, size: 1.8 },
    ],
    from: '#4de0ff',
    to: '#7b5cff',
  },
]

function Field({ kind, id }: { kind: Variant['field']; id: string }) {
  const stroke = { stroke: '#6c7a96', strokeOpacity: 0.16 } as const

  if (kind === 'grid') {
    return (
      <g {...stroke}>
        {Array.from({ length: 8 }, (_, i) => (
          <line key={`h${i}`} x1="0" x2="320" y1={12 + i * 22} y2={12 + i * 22} />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={`v${i}`} y1="0" y2="180" x1={14 + i * 26} x2={14 + i * 26} />
        ))}
      </g>
    )
  }

  if (kind === 'arcs') {
    return (
      <g {...stroke} fill="none">
        {Array.from({ length: 5 }, (_, i) => (
          <circle key={i} cx="160" cy="92" r={40 + i * 26} />
        ))}
      </g>
    )
  }

  if (kind === 'hatch') {
    return (
      <g {...stroke}>
        {Array.from({ length: 16 }, (_, i) => (
          <line key={i} x1={-60 + i * 28} y1="0" x2={20 + i * 28} y2="180" />
        ))}
      </g>
    )
  }

  return (
    <g {...stroke} id={id}>
      {Array.from({ length: 7 }, (_, i) => (
        <line key={i} x1="0" x2="320" y1={16 + i * 25} y2={16 + i * 25} />
      ))}
    </g>
  )
}

export function CoverArt({ variant, className = '' }: { variant: number; className?: string }) {
  const config = VARIANTS[variant % VARIANTS.length]
  const id = `cover-${variant}`

  return (
    <svg viewBox="0 0 320 180" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-core`} cx="40%" cy="34%">
          <stop offset="0%" stopColor="#eaf4ff" />
          <stop offset="40%" stopColor={config.from} />
          <stop offset="100%" stopColor="#041031" />
        </radialGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" stopColor={config.from} stopOpacity="0.42" />
          <stop offset="100%" stopColor={config.from} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-arc`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={config.to} />
          <stop offset="55%" stopColor={config.from} />
          <stop offset="100%" stopColor={config.to} stopOpacity="0.12" />
        </linearGradient>
      </defs>

      <Field kind={config.field} id={`${id}-field`} />
      <circle cx="160" cy="92" r="82" fill={`url(#${id}-glow)`} />

      <g transform={`rotate(${config.tilt} 160 92)`}>
        {config.rings.map((ring, index) => (
          <ellipse
            key={index}
            cx="160"
            cy="92"
            rx={ring.rx}
            ry={ring.ry}
            fill="none"
            stroke={`url(#${id}-arc)`}
            strokeWidth="1.2"
            strokeDasharray={ring.dashed ? '2 7' : undefined}
          />
        ))}
        {config.satellites.map((satellite, index) => {
          const radians = (satellite.angle * Math.PI) / 180
          const ring = config.rings[Math.min(index, config.rings.length - 1)]
          return (
            <circle
              key={index}
              cx={160 + Math.cos(radians) * ring.rx}
              cy={92 + Math.sin(radians) * ring.ry}
              r={satellite.size}
              fill="#edf3ff"
            />
          )
        })}
      </g>

      <circle cx="160" cy="92" r={config.core} fill={`url(#${id}-core)`} />
      <circle cx="160" cy="92" r={config.core} fill="none" stroke="#cfe2ff" strokeOpacity="0.3" />
    </svg>
  )
}
