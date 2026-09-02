import { useEffect, type RefObject } from 'react'

/** Toca o vídeo só enquanto ele está na tela. */
export function useAutoPauseVideo(ref: RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const video = ref.current
    if (!video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.12 },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [ref])
}
