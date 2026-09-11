import { useId } from 'react'
import { motion } from 'framer-motion'

/**
 * Onda na costura entre duas seções. Um caminho senoidal com o dobro da
 * largura desliza para a esquerda em loop (como o marquee), então a onda
 * parece correr sem fim; por cima dele, uma "cobra" de luz — um traço curto
 * feito com stroke-dasharray — percorre o mesmo caminho puxada pelo
 * stroke-dashoffset. Tudo transform e atributos de traço: nada de layout.
 *
 * `flip` espelha a onda na vertical para as costuras alternarem o sentido.
 */
export function WaveBridge({ flip = false, className = '' }: { flip?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '')

  /* Dois períodos completos em 1440 unidades; o path tem 2880 de largura e
     desliza 1440, então a emenda é invisível. */
  const wave =
    'M0 40 C120 0 240 0 360 40 S600 80 720 40 S960 0 1080 40 S1320 80 1440 40 ' +
    'S1680 0 1800 40 S2040 80 2160 40 S2400 0 2520 40 S2760 80 2880 40'

  return (
    <div
      aria-hidden="true"
      className={`relative z-10 h-20 w-full overflow-x-clip ${flip ? '-scale-y-100' : ''} ${className}`}
    >
      <motion.svg
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 1.4 }}
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id={`fade-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8db4f5" stopOpacity="0" />
            <stop offset="0.5" stopColor="#8db4f5" stopOpacity="0.7" />
            <stop offset="1" stopColor="#8db4f5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* A onda em si: desliza um período inteiro e recomeça no mesmo lugar. */}
        <g className="animate-[astro-wave_14s_linear_infinite]">
          <path d={wave} fill="none" stroke={`url(#fade-${id})`} strokeWidth="1.6" />
          {/* A cobra: 140 unidades de traço numa lacuna de 2740, correndo pelo
              caminho. Brilha mais que a onda porque é o que o olho segue. */}
          <path
            d={wave}
            fill="none"
            stroke="#f5f7fb"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeDasharray="140 2740"
            className="animate-[astro-snake_5.5s_cubic-bezier(0.45,0,0.2,1)_infinite]"
          />
        </g>
      </motion.svg>
    </div>
  )
}
