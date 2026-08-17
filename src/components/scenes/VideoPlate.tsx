import { useEffect, useRef, useState } from 'react'

/**
 * Background footage that behaves. The file is 16–24 MB, so nothing is fetched
 * until the plate is near the viewport, and playback stops the moment it leaves —
 * a 4K loop decoding off-screen is the fastest way to make a page feel broken.
 */
export function VideoPlate({
  src,
  className = '',
  objectPosition = 'center',
}: {
  src: string
  className?: string
  objectPosition?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [armed, setArmed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setArmed(true)
          const video = videoRef.current
          if (!video) continue
          if (entry.isIntersecting) void video.play().catch(() => undefined)
          else video.pause()
        }
      },
      { rootMargin: '300px 0px' },
    )

    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={wrapRef} className={`relative overflow-hidden bg-void ${className}`}>
      {armed ? (
        <video
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          onCanPlay={() => setReady(true)}
          className={`h-full w-full object-cover transition-opacity duration-1000 ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ objectPosition }}
        />
      ) : null}
    </div>
  )
}
