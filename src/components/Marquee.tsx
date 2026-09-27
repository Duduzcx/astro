import { useEffect, useRef } from 'react'
import { AstroStar } from './brand/AstroMark'
import { usePausedOffscreen } from '../lib/usePausedOffscreen'
import { onVelocidade } from '../lib/scroll'

/** Faixa infinita de capacidades embaixo do hero, em português comum. */
const capabilities = [
  'Sites que vendem',
  'Sistemas sob medida',
  'Robôs de WhatsApp',
  'Cobrança automática',
  'Painéis em tempo real',
  'Tudo conectado',
] as const

/* A faixa inclina conforme a velocidade do scroll: seis graus a 1600px/s,
   para o lado contrário ao movimento, e volta reta quando a página para. */
const INCLINACAO_MAXIMA = 6
const VELOCIDADE_CHEIA = 1600

export function Marquee() {
  /* A faixa fica logo abaixo do hero e não está dentro de nenhuma seção, então
     o `content-visibility` não a alcança: sem isto ela seguiria correndo a
     página inteira, muito depois de ninguém mais poder vê-la. */
  const bandRef = usePausedOffscreen<HTMLDivElement>()
  const inclinada = useRef<HTMLDivElement>(null)

  /* A inclinação vem da velocidade que o Lenis já calcula, e não de um
     useScroll + useVelocity + useSpring medindo a página a cada quadro. E
     mora num invólucro à parte: a corrida da faixa é uma animação CSS de
     `transform`, e animação vence estilo inline — no mesmo elemento, o skew
     nunca chegava a aparecer.

     Sem inclinação no celular: inclinar uma faixa desta largura repinta
     muito a cada quadro e engasga a rolagem por toque. */
  useEffect(() => {
    const alvo = inclinada.current
    if (!alvo || !window.matchMedia('(min-width: 1024px)').matches) return
    let atual = 0
    let meta = 0
    let quadro = 0
    let silencio = 0
    let ultimo = 0
    /* Amortecimento por tempo (constante de 90ms), e não por quadro: a faixa
       assenta no mesmo ritmo num monitor de 60Hz e num de 120Hz. */
    const passo = (agora: number) => {
      quadro = 0
      const intervalo = Math.min(agora - ultimo, 50)
      ultimo = agora
      atual += (meta - atual) * (1 - Math.exp(-intervalo / 90))
      if (Math.abs(meta - atual) < 0.02) atual = meta
      alvo.style.transform = atual === 0 ? '' : `skewX(${atual.toFixed(2)}deg)`
      if (atual !== meta) quadro = requestAnimationFrame(passo)
    }
    const apontar = (inclinacao: number) => {
      meta =
        Math.abs(inclinacao) < 0.05
          ? 0
          : Math.max(-INCLINACAO_MAXIMA, Math.min(INCLINACAO_MAXIMA, inclinacao))
      if (!quadro) {
        ultimo = performance.now()
        quadro = requestAnimationFrame(passo)
      }
    }
    const parar = onVelocidade((velocidade) => {
      apontar((-velocidade / VELOCIDADE_CHEIA) * INCLINACAO_MAXIMA)
      /* O Lenis avisa velocidade zero quando assenta; se a última notícia
         chegar no meio do caminho, o silêncio endireita a faixa do mesmo
         jeito. */
      clearTimeout(silencio)
      silencio = window.setTimeout(() => apontar(0), 150)
    })
    return () => {
      parar()
      clearTimeout(silencio)
      cancelAnimationFrame(quadro)
      alvo.style.transform = ''
    }
  }, [])

  const row = capabilities.map((capability) => (
    <span key={capability} className="flex items-center gap-8 pr-8 whitespace-nowrap">
      <span className="text-[15px] tracking-[0.02em] text-ash">{capability}</span>
      <AstroStar className="h-2.5 w-2.5 text-cobalt opacity-80" />
    </span>
  ))

  return (
    <div className="relative z-10 overflow-hidden border-y border-white/5 bg-onyx/60 py-4">
      {/* `will-change`: com camada própria, a inclinação é só compositor,
          sem repintar a faixa que corre lá dentro. */}
      <div ref={inclinada} className="will-change-transform">
        <div ref={bandRef} className="flex w-max animate-[astro-marquee_36s_linear_infinite]">
          <div aria-hidden="true" className="flex">{row}</div>
          <div className="flex">{row}</div>
        </div>
      </div>
      <p className="sr-only">Capacidades da Astro Soluções: {capabilities.join(', ')}.</p>
    </div>
  )
}
