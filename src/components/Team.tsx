import { useEffect, useRef, useState } from 'react'
import { WordReveal, Reveal } from './ui/Primitives'

/** The real founding trio. Roles are provisional — refine as the company defines them. */
const members = [
  {
    name: 'Eduardo',
    role: 'Cofundador · Desenvolvimento',
    bio: 'Constrói o produto de ponta a ponta — do primeiro protótipo ao sistema rodando em produção.',
    color: '#8434ce',
  },
  {
    name: 'Matheus',
    role: 'Cofundador · Engenharia',
    bio: 'Responsável técnico: arquitetura, qualidade e a garantia de que tudo que sai daqui é auditável.',
    color: '#c9a0ff',
  },
  {
    name: 'Luana',
    role: 'Cofundadora · Operações',
    bio: 'Cuida da experiência do cliente do diagnóstico à entrega — e do atendimento que não dorme.',
    color: '#fffcf3',
  },
] as const

function initials(name: string) {
  const parts = name.split(' ')
  return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0][0]
}

export function Team() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  /* Arrows go quiet at the ends instead of pretending there is more to see. */
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const update = () => {
      setAtStart(track.scrollLeft <= 4)
      setAtEnd(track.scrollLeft >= track.scrollWidth - track.clientWidth - 4)
    }
    update()
    track.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      track.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const scrollByCard = (direction: 1 | -1) => {
    trackRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' })
  }

  return (
    <section id="equipe" aria-label="Equipe" className="relative z-10 py-24 md:py-36">
      <div className="shell">
        <WordReveal text="Quem constrói" className="font-impact text-[clamp(2.6rem,6vw,5rem)]" />
        <Reveal delay={0.12}>
          <p className="mt-6 max-w-md text-ash">
            Um time pequeno de propósito: quem entende o seu problema é quem escreve o código.
          </p>
        </Reveal>
      </div>

      <Reveal delay={0.2}>
        <div
          ref={trackRef}
          className="no-scrollbar mt-14 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 md:px-[max(48px,calc((100vw-1280px)/2+48px))]"
        >
          {members.map((member) => (
            <article
              key={member.name}
              className="graphite-card w-72 shrink-0 snap-start bg-graphite/95 backdrop-blur-sm"
            >
              <svg viewBox="0 0 96 96" aria-hidden="true" className="h-24 w-24">
                <path
                  d="M48 10 88 82H8L48 10Z"
                  stroke={member.color}
                  strokeWidth="3"
                  strokeLinejoin="round"
                  fill="none"
                />
                <text
                  x="48"
                  y="66"
                  textAnchor="middle"
                  fill={member.color}
                  fontSize="20"
                  fontWeight="700"
                  fontFamily="Inter Tight, sans-serif"
                >
                  {initials(member.name)}
                </text>
              </svg>
              <h3 className="mt-6 text-[1.35rem]">{member.name}</h3>
              <p className="mt-1 text-[12px] font-[480] tracking-[0.08em] text-cobalt uppercase">
                {member.role}
              </p>
              <p className="mt-4 text-[15px] leading-[1.55] text-ash">{member.bio}</p>
            </article>
          ))}
        </div>
      </Reveal>

      <div className="shell mt-10 flex gap-4">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          disabled={atStart}
          aria-label="Membro anterior"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-cobalt text-white transition-[transform,opacity] duration-200 hover:enabled:scale-105 disabled:opacity-35"
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-4 w-4">
            <path d="M11 2 5 8l6 6" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          disabled={atEnd}
          aria-label="Próximo membro"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-cobalt text-white transition-[transform,opacity] duration-200 hover:enabled:scale-105 disabled:opacity-35"
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-4 w-4">
            <path d="M5 2l6 6-6 6" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
      </div>
    </section>
  )
}
