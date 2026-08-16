const capabilities = [
  'Sites institucionais',
  'Landing pages que convertem',
  'Sistemas internos',
  'Portais de cliente',
  'Automação de processos',
  'Integração de ERP',
  'APIs e webhooks',
  'Dashboards e BI',
  'Produtos SaaS',
  'IA aplicada ao negócio',
]

export function Marquee() {
  return (
    <div className="border-y border-slate/20 bg-deep py-5">
      <div
        className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]"
        aria-hidden="true"
      >
        {/* Two identical tracks inside one animated rail; -50% of the rail is exactly one track. */}
        <div className="flex w-max animate-[astro-marquee_46s_linear_infinite]">
          {[0, 1].map((track) => (
            <ul key={track} className="flex shrink-0 items-center">
              {capabilities.map((item) => (
                <li
                  key={item}
                  className="flex shrink-0 items-center gap-6 pr-6 font-mono text-[11px] whitespace-nowrap uppercase tracking-[0.18em] text-slate"
                >
                  {item}
                  <span className="h-1 w-1 rounded-full bg-slate/60" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      <p className="sr-only">Capacidades da Astro: {capabilities.join(', ')}.</p>
    </div>
  )
}
