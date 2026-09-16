import { useEffect, type RefObject } from 'react'

/**
 * Vídeo que só existe quando chega perto da tela.
 *
 * O `src` no HTML com `autoplay` faz o browser baixar o arquivo na carga,
 * por mais que o `preload` diga o contrário: eram 27 MB de vídeo brigando
 * por banda com a cena 3D na primeira dobra, e a decodificação do primeiro
 * frame travava o thread principal. Aqui o endereço só entra no elemento
 * quando ele está a uma tela de distância (`rootMargin`), e a reprodução
 * começa e para conforme entra e sai de vista.
 */
export function useAutoPauseVideo(ref: RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const video = ref.current
    if (!video) return

    /* O endereço mora no data-src até a hora de baixar. */
    const source = video.dataset.src
    let armed = false
    const arm = () => {
      if (armed) return
      armed = true
      if (source && !video.src) video.src = source
    }

    /* Uma tela de antecedência: dá tempo de baixar o começo antes de
       aparecer, sem competir com a primeira dobra. */
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          arm()
          near.disconnect()
        }
      },
      { rootMargin: '100% 0px' },
    )
    near.observe(video)

    const playing = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          arm()
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: 0.12 },
    )
    playing.observe(video)

    return () => {
      near.disconnect()
      playing.disconnect()
    }
  }, [ref])
}
