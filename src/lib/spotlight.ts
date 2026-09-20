/**
 * Lanterna nos cartões.
 *
 * Um único ouvinte de pointermove no documento, passivo, e nenhum estado do
 * React: para o cartão sob o cursor ele escreve --mx e --my (posição do
 * cursor dentro do cartão) e --luz = 1; ao sair, --luz = 0. O CSS de
 * .graphite-card faz o resto, num círculo de luz na moldura e num halo no
 * fundo. O custo é uma repintura da camada do cartão a cada movimento, e
 * só dele; nada chega ao laço da cena.
 *
 * Só onde há mouse de verdade (hover: hover e pointer: fine). No toque não
 * existe "perto do cursor", e o ouvinte nem é instalado.
 */
export function installSpotlight() {
  if (typeof window === 'undefined') return
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

  let atual: HTMLElement | null = null
  const apagar = () => {
    if (!atual) return
    atual.style.setProperty('--luz', '0')
    atual = null
  }

  document.addEventListener(
    'pointermove',
    (event) => {
      const alvo =
        event.target instanceof Element ? event.target.closest<HTMLElement>('.graphite-card') : null
      if (alvo !== atual) {
        apagar()
        atual = alvo
        if (alvo) alvo.style.setProperty('--luz', '1')
      }
      if (!alvo) return
      const caixa = alvo.getBoundingClientRect()
      alvo.style.setProperty('--mx', `${Math.round(event.clientX - caixa.left)}px`)
      alvo.style.setProperty('--my', `${Math.round(event.clientY - caixa.top)}px`)
    },
    { passive: true },
  )
  document.documentElement.addEventListener('mouseleave', apagar)
  window.addEventListener('blur', apagar)
}
