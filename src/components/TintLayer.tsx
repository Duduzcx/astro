import { useEffect, useState } from 'react'

/**
 * Mercury-style colour weather: the page's base colour drifts as you move
 * between sections — always navy, but each chapter has its own temperature.
 * One fixed div with a CSS colour transition; the observer just picks the tint.
 */
const TINTS: Array<[string, string]> = [
  ['#topo', '#0a0f1e'],
  ['#servicos', '#0c1526'],
  ['[aria-label="Integrações"]', '#0b1222'],
  ['#manifesto', '#06080f'],
  ['[aria-label="Automação em ação"]', '#05070d'],
  ['[aria-label="Missão"]', '#101c38'],
  ['#resultados', '#0b1222'],
  ['[aria-label="Agendar diagnóstico"]', '#05070d'],
  ['#processo', '#0a1120'],
  ['#entregaveis', '#0d1630'],
  ['#sobre', '#0b1428'],
  ['#equipe', '#0c1526'],
  ['#insights', '#0a0f1e'],
  ['#faq', '#0b1222'],
  ['#contato', '#0e1a36'],
]

export function TintLayer() {
  const [tint, setTint] = useState('#0a0f1e')

  useEffect(() => {
    const targets: Array<[Element, string]> = []
    for (const [selector, color] of TINTS) {
      const element = document.querySelector(selector)
      if (element) targets.push([element, color])
    }
    const byElement = new Map(targets)

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        const color = byElement.get(visible.target)
        if (color) setTint(color)
      },
      { rootMargin: '-35% 0px -35% 0px', threshold: [0, 0.2, 0.5] },
    )
    targets.forEach(([element]) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0"
      style={{ backgroundColor: tint, transition: 'background-color 1200ms ease' }}
    />
  )
}
