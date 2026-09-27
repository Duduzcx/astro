import { useEffect } from 'react'

/**
 * Animações CSS infinitas param quando saem da tela.
 *
 * O navegador não desliga sozinho uma animação que saiu de vista: ela segue
 * tiquetaqueando, recalculando o estilo do elemento a cada quadro e, quando
 * anima algo que não é composição (`background-position`,
 * `stroke-dashoffset`), repintando também. Medido na rolagem do desktop: os
 * pulsos, os fluxos do hub de integrações e a gota do hero somavam mais de
 * cem invalidações de estilo por segundo com as seções delas fora da tela.
 *
 * Um observador só, para tudo que tem `_infinite` na classe (é como o
 * Tailwind escreve `animate-[nome_2s_linear_infinite]`), dentro de `main` e
 * do rodapé. Animações de entrada, que rodam uma vez, ficam de fora de
 * propósito: pausá-las travaria o elemento no meio do caminho. Com a aba
 * escondida o navegador já segura o rAF, mas não a animação CSS — por isso o
 * `visibilitychange` também conta.
 */
export function usePausarAnimacoesForaDaTela() {
  useEffect(() => {
    const elementos = Array.from(
      document.querySelectorAll<HTMLElement>(':is(main, footer) [class*="_infinite"]'),
    )
    if (elementos.length === 0) return

    const visiveis = new Set<Element>()
    const aplicar = () => {
      const aba = !document.hidden
      for (const el of elementos) el.style.animationPlayState = aba && visiveis.has(el) ? 'running' : 'paused'
    }
    /* Uma margem de folga para a animação já estar em regime quando o
       elemento aparece, em vez de começar do zero na borda da tela. */
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) visiveis.add(entrada.target)
          else visiveis.delete(entrada.target)
        }
        aplicar()
      },
      { rootMargin: '15% 0px' },
    )
    for (const el of elementos) observador.observe(el)
    document.addEventListener('visibilitychange', aplicar)

    return () => {
      observador.disconnect()
      document.removeEventListener('visibilitychange', aplicar)
      for (const el of elementos) el.style.animationPlayState = ''
    }
  }, [])
}
