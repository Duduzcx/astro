import { useEffect, useState } from 'react'

const SOURCES = [
  { label: 'ERP', y: 70 },
  { label: 'E-commerce', y: 210 },
  { label: 'WhatsApp', y: 350 },
]

const TARGETS = [
  { label: 'Financeiro', y: 70 },
  { label: 'BI', y: 210 },
  { label: 'Estoque', y: 350 },
]

const HUB = { x: 450, y: 210 }

const curve = (fromX: number, fromY: number, toX: number, toY: number) => {
  const midX = (fromX + toX) / 2
  return `M${fromX},${fromY} C${midX},${fromY} ${midX},${toY} ${toX},${toY}`
}

/**
 * The integration diagram, animated: packets leave each source, pass through the hub,
 * and come out the other side. It is the sales argument drawn instead of written.
 */
export function PipelineScene({ className = '' }: { className?: string }) {
  const [animated, setAnimated] = useState(true)

  useEffect(() => {
    setAnimated(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const edges = [
    ...SOURCES.map((source, index) => ({
      id: `in-${index}`,
      d: curve(150, source.y, HUB.x - 58, HUB.y),
      delay: index * 0.9,
    })),
    ...TARGETS.map((target, index) => ({
      id: `out-${index}`,
      d: curve(HUB.x + 58, HUB.y, 750, target.y),
      delay: 1.4 + index * 0.9,
    })),
  ]

  return (
    <svg viewBox="0 0 900 420" className={className} role="img" aria-label="Diagrama de integração: ERP, e-commerce e WhatsApp entram na Astro e saem para financeiro, BI e estoque">
      <defs>
        <radialGradient id="astro-hub-glow">
          <stop offset="0%" stopColor="#1b4dff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#1b4dff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={HUB.x} cy={HUB.y} r="150" fill="url(#astro-hub-glow)" />

      {edges.map((edge) => (
        <path
          key={edge.id}
          id={edge.id}
          d={edge.d}
          fill="none"
          stroke="#6c7a96"
          strokeOpacity="0.5"
          strokeWidth="1"
          strokeDasharray="4 6"
        />
      ))}

      {animated
        ? edges.map((edge) => (
            <circle key={`packet-${edge.id}`} r="3.5" fill="#cfe2ff">
              <animateMotion dur="2.8s" begin={`${edge.delay}s`} repeatCount="indefinite">
                <mpath href={`#${edge.id}`} />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur="2.8s"
                begin={`${edge.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))
        : null}

      {SOURCES.map((source) => (
        <g key={source.label}>
          <rect
            x="20"
            y={source.y - 22}
            width="130"
            height="44"
            rx="8"
            fill="#0a2050"
            stroke="#6c7a96"
            strokeOpacity="0.45"
          />
          <text
            x="85"
            y={source.y + 4}
            textAnchor="middle"
            fill="#edf3ff"
            fontSize="12"
            fontFamily="JetBrains Mono, monospace"
            letterSpacing="1.2"
          >
            {source.label.toUpperCase()}
          </text>
        </g>
      ))}

      {TARGETS.map((target) => (
        <g key={target.label}>
          <rect
            x="750"
            y={target.y - 22}
            width="130"
            height="44"
            rx="8"
            fill="#0a2050"
            stroke="#6c7a96"
            strokeOpacity="0.45"
          />
          <text
            x="815"
            y={target.y + 4}
            textAnchor="middle"
            fill="#edf3ff"
            fontSize="12"
            fontFamily="JetBrains Mono, monospace"
            letterSpacing="1.2"
          >
            {target.label.toUpperCase()}
          </text>
        </g>
      ))}

      <circle cx={HUB.x} cy={HUB.y} r="58" fill="#030a1c" stroke="#5aa9ff" strokeWidth="1.2" />
      {animated ? (
        <circle cx={HUB.x} cy={HUB.y} r="58" fill="none" stroke="#5aa9ff" strokeWidth="1">
          <animate attributeName="r" values="58;104" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0" dur="3s" repeatCount="indefinite" />
        </circle>
      ) : null}
      <text
        x={HUB.x}
        y={HUB.y + 5}
        textAnchor="middle"
        fill="#ffffff"
        fontSize="15"
        fontFamily="Inter, sans-serif"
        letterSpacing="2"
      >
        ASTRO
      </text>
    </svg>
  )
}
