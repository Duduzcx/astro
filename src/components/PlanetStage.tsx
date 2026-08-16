import { Suspense, lazy, useEffect, useRef, useState } from 'react'

const Planet = lazy(() => import('./Planet'))

/**
 * three.js is the heaviest thing on the page and it is used exactly once, well below
 * the fold. Mount it only when the section is about to be seen, so the hero never
 * waits on a renderer nobody has scrolled to yet.
 */
export function PlanetStage({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '400px 0px' },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Placeholder keeps the layout box filled while the chunk loads. */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 m-auto aspect-square w-1/2 rounded-full bg-[radial-gradient(circle_at_60%_35%,#1b4dff33,transparent_70%)] transition-opacity duration-700 ${
          visible ? 'opacity-0' : 'opacity-100'
        }`}
      />
      {visible ? (
        <Suspense fallback={null}>
          <Planet className="h-full w-full" />
        </Suspense>
      ) : null}
    </div>
  )
}
