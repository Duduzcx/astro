import { useRef, type ReactNode } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'

/**
 * Texto que acende de cima para baixo conforme a pessoa rola.
 *
 * É o recurso das páginas que o cliente usou como referência: em vez de o
 * bloco aparecer inteiro, a leitura é conduzida — o que já foi lido está
 * claro, o que vem está apagado, e a fronteira desce junto com o olho.
 *
 * Como custa quase nada: NÃO existe um elemento por palavra nem um estilo por
 * palavra. O bloco inteiro tem um gradiente vertical recortado no texto
 * (background-clip: text) e a rolagem escreve UMA variável CSS, --acesa, que
 * move a fronteira do gradiente. É uma escrita de propriedade por quadro, num
 * elemento só, e a repintura fica restrita ao bloco de texto. O framer-motion
 * escreve a variável direto no DOM, fora do ciclo de render do React.
 *
 * A sombra de leitura continua funcionando: text-shadow desenha a partir da
 * forma do glifo, não da cor, então o texto segue legível sobre a cena mesmo
 * com a cor transparente.
 */
export function TextoQueAcende({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
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
