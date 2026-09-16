import { useEffect, useRef } from 'react'

/**
 * Animação CSS que para quando sai da tela.
 *
 * O navegador não desliga sozinho uma animação que saiu de vista: ela segue
 * tiquetaqueando e, quando anima algo que não é composição — `background-position`,
 * `stroke-dashoffset`, `filter` —, segue repintando também. Dentro de uma seção
 * com `content-visibility` o próprio navegador já pula a pintura; este hook é
 * para o que mora fora de seção e para quando a regra não vale, acima de 480px.
 *
 * Devolve uma ref para pendurar no elemento que carrega a animação.
 */
export function usePausedOffscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const apply = (running: boolean) => {
      node.style.animationPlayState = running ? 'running' : 'paused'
    }

    /* Uma margem de folga para a animação já estar em regime quando o
       elemento aparece, em vez de começar do zero na borda da tela. */
    let visible = false
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        apply(visible && !document.hidden)
      },
      { rootMargin: '15% 0px' },
    )
    observer.observe(node)

    /* Aba escondida: o navegador já segura o rAF, mas não a animação CSS. */
    const onVisibility = () => apply(visible && !document.hidden)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      node.style.animationPlayState = ''
    }
  }, [])

  return ref
}
