import { useRef, type ReactNode } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import { rolagemNativa } from '../../lib/rolagem'

/**
 * Texto que acende de cima para baixo conforme a pessoa rola.
 *
 * É o recurso das páginas que o cliente usou como referência: em vez de o
 * bloco aparecer inteiro, a leitura é conduzida — o que já foi lido está
 * claro, o que vem está apagado, e a fronteira desce junto com o olho.
 *
 * Como custa quase nada: NÃO existe um elemento por palavra nem um estilo por
 * palavra. O bloco inteiro tem um gradiente vertical recortado no texto
 * (background-clip: text) e a rolagem move UMA variável CSS, --acesa, que é
 * a fronteira do gradiente. A repintura fica restrita ao bloco de texto.
 *
 * Quem move a variável é o navegador: uma animação guiada pela rolagem
 * (.rola-acende, no index.css), sem JavaScript medindo o bloco a cada
 * quadro. Onde o recurso não existe, o framer-motion mede e escreve a
 * variável direto no DOM, fora do ciclo de render do React, como antes.
 *
 * A sombra de leitura continua funcionando: text-shadow desenha a partir da
 * forma do glifo, não da cor, então o texto segue legível sobre a cena mesmo
 * com a cor transparente.
 */
type Props = {
  children: ReactNode
  className?: string
}

export function TextoQueAcende({ children, className = '' }: Props) {
  if (rolagemNativa) {
    return <p className={`texto-acende rola-acende ${className}`}>{children}</p>
  }
  return <TextoComMola className={className}>{children}</TextoComMola>
}

/** A versão medida por JavaScript, para navegadores sem animação guiada pela rolagem. */
function TextoComMola({ children, className = '' }: Props) {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 55%'] })
  /* Mola curta: sem ela a fronteira treme junto com os degraus do scroll. */
  const suave = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 })
  const acesa = useTransform(suave, (v) => `${(v * 100).toFixed(1)}%`)

  return (
    <motion.p ref={ref} style={{ '--acesa': acesa } as never} className={`texto-acende ${className}`}>
      {children}
    </motion.p>
  )
}
