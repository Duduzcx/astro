/**
 * Fake product UI, Mercury-style: graphite windows with cobalt as the only
 * chromatic note. These panels are the "product screenshots" of a product that
 * is bespoke by definition — each one sketches what a delivery looks like.
 */

const chrome = (
  <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
    <span className="h-2 w-2 rounded-full bg-white/15" />
    <span className="h-2 w-2 rounded-full bg-white/15" />
    <span className="h-2 w-2 rounded-full bg-white/15" />
  </div>
)

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="overflow-hidden rounded-xl bg-graphite shadow-none select-none"
    >
      {chrome}
      {children}
    </div>
  )
}

/** Ops dashboard: sidebar, stat tiles, revenue chart. */
export function DashboardPanel() {
  return (
    <Frame label="Tela de um sistema de gestão com indicadores e gráfico de faturamento">
      <div className="flex">
        <div className="hidden w-36 shrink-0 flex-col gap-1 border-r border-white/5 p-4 sm:flex">
          {['Visão geral', 'Pedidos', 'Agenda', 'Estoque', 'Financeiro', 'Equipe'].map(
            (item, i) => (
              <span
                key={item}
                className={`rounded-md px-3 py-1.5 text-[11px] ${
                  i === 0 ? 'bg-obsidian text-ivory' : 'text-slate'
                }`}
              >
                {item}
              </span>
            ),
          )}
        </div>
        <div className="flex-1 p-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Faturamento', 'R$ 184 mil'],
              ['Pedidos hoje', '312'],
              ['Inadimplência', '1,2%'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-obsidian p-3">
                <p className="text-[9px] tracking-[0.06em] text-slate uppercase">{label}</p>
                <p className="mt-1 text-[15px] font-[480] text-ivory">{value}</p>
              </div>
            ))}
          </div>
          <svg viewBox="0 0 400 120" className="mt-3 w-full" aria-hidden="true">
            <defs>
              <linearGradient id="panel-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#5266eb" stopOpacity="0.35" />
                <stop offset="1" stopColor="#5266eb" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,95 C40,90 60,70 95,72 C130,74 150,50 190,52 C230,54 250,38 290,30 C330,24 360,18 400,12 L400,120 L0,120 Z"
              fill="url(#panel-fill)"
            />
            <path
              d="M0,95 C40,90 60,70 95,72 C130,74 150,50 190,52 C230,54 250,38 290,30 C330,24 360,18 400,12"
              fill="none"
              stroke="#5266eb"
              strokeWidth="2"
            />
            <g stroke="#ffffff" strokeOpacity="0.06">
              <line x1="0" y1="40" x2="400" y2="40" />
              <line x1="0" y1="80" x2="400" y2="80" />
            </g>
          </svg>
        </div>
      </div>
    </Frame>
  )
}

/** Storefront: browser bar, hero, product cards. */
export function StorefrontPanel() {
  return (
    <Frame label="Tela de um e-commerce com vitrine de produtos">
      <div className="px-4 pb-4">
        <div className="mt-3 flex items-center gap-2 rounded-full bg-obsidian px-4 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
          <span className="text-[10px] text-slate">mercadobonfim.com.br</span>
        </div>
        <div className="mt-3 rounded-lg bg-obsidian p-4">
          <p className="text-[13px] font-[480] text-ivory">Feira da semana, entregue em casa</p>
          <p className="mt-1 text-[10px] text-slate">Estoque sincronizado com a loja física</p>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[
            ['Cesta orgânica', 'R$ 89'],
            ['Café da casa', 'R$ 34'],
            ['Assinatura', 'R$ 149/mês'],
          ].map(([name, price]) => (
            <div key={name} className="rounded-lg bg-obsidian p-3">
              <div className="h-10 rounded-md bg-white/5" />
              <p className="mt-2 text-[10px] text-ash">{name}</p>
              <p className="text-[11px] font-[480] text-ivory">{price}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-end">
          <span className="rounded-full bg-cobalt px-4 py-1.5 text-[10px] text-white">
            Finalizar pedido
          </span>
        </div>
      </div>
    </Frame>
  )
}

/** WhatsApp bot: a scheduling conversation resolving itself. */
export function ChatPanel() {
  const bubbles = [
    { from: 'them', text: 'Oi! Preciso remarcar minha consulta de quinta.' },
    { from: 'bot', text: 'Claro! Tenho quinta às 16h ou sexta às 9h30. Qual prefere?' },
    { from: 'them', text: 'Sexta 9h30.' },
    { from: 'bot', text: 'Remarcado ✓ Enviei a confirmação por e-mail e avisei a recepção.' },
  ] as const
  return (
    <Frame label="Conversa de WhatsApp em que o robô remarca uma consulta sozinho">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 pb-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-obsidian">
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M12 3 20 19H4L12 3Z" stroke="#5266eb" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-[11px] font-[480] text-ivory">Clínica Áurea · Assistente</p>
            <p className="text-[9px] text-[#4ade80]">online agora</p>
          </div>
        </div>
        {bubbles.map((bubble) => (
          <div
            key={bubble.text}
            className={`max-w-[80%] rounded-xl px-3 py-2 text-[11px] leading-[1.45] ${
              bubble.from === 'bot'
                ? 'self-end rounded-br-sm bg-cobalt/90 text-white'
                : 'self-start rounded-bl-sm bg-obsidian text-ash'
            }`}
          >
            {bubble.text}
          </div>
        ))}
        <p className="pt-1 text-center text-[9px] text-slate">
          resolvido em 40 segundos · sem tocar na recepção
        </p>
      </div>
    </Frame>
  )
}

/** IoT telemetry: live sensor tiles + a sparkline wall. */
export function TelemetryPanel() {
  const sensors = [
    ['Câmara fria 01', '-18,2 °C', '#4dd6e8'],
    ['Umidade galpão', '54%', '#7d8bf0'],
    ['Energia linha A', '12,4 kW', '#5266eb'],
    ['Esteira 03', 'ativa', '#4ade80'],
  ] as const
  return (
    <Frame label="Painel de sensores IoT com leituras de temperatura, umidade e energia em tempo real">
      <div className="p-4">
        <div className="flex items-center justify-between pb-3">
          <p className="text-[11px] font-[480] text-ivory">Telemetria · agora</p>
          <span className="flex items-center gap-1.5 text-[9px] text-slate">
            <span className="h-1.5 w-1.5 animate-[astro-pulse_1.8s_ease-in-out_infinite] rounded-full bg-[#4ade80]" />
            42 sensores online
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {sensors.map(([name, value, tint]) => (
            <div key={name} className="rounded-lg bg-obsidian p-3">
              <p className="text-[9px] tracking-[0.06em] text-slate uppercase">{name}</p>
              <p className="mt-1 text-[15px] font-[480]" style={{ color: tint }}>
                {value}
              </p>
              <svg viewBox="0 0 120 24" className="mt-2 w-full" aria-hidden="true">
                <path
                  d="M0,16 C12,14 18,20 30,17 C42,14 48,8 60,10 C72,12 78,6 90,8 C102,10 110,5 120,7"
                  fill="none"
                  stroke={tint}
                  strokeWidth="1.5"
                  opacity="0.7"
                />
              </svg>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  )
}

/** Integration hub: sources feed the triangle, outputs leave it. */
export function PipelinePanel() {
  const inputs = ['ERP', 'Site', 'WhatsApp']
  const outputs = ['Financeiro', 'BI', 'Estoque']
  return (
    <Frame label="Diagrama: ERP, site e WhatsApp entram na Astro Soluções e saem para financeiro, BI e estoque">
      <svg viewBox="0 0 440 220" className="w-full p-2" aria-hidden="true">
        {inputs.map((label, i) => {
          const y = 45 + i * 65
          return (
            <g key={label}>
              <rect x="8" y={y - 16} width="86" height="32" rx="8" fill="#272735" />
              <text x="51" y={y + 4} textAnchor="middle" fill="#c3c3cc" fontSize="11">
                {label}
              </text>
              <path
                d={`M96,${y} C140,${y} 160,110 196,110`}
                fill="none"
                stroke="#5266eb"
                strokeWidth="1.4"
                strokeDasharray="4 5"
                opacity="0.7"
                className="animate-[astro-flow_2.4s_linear_infinite]"
              />
            </g>
          )
        })}
        <circle cx="222" cy="110" r="34" fill="#171721" stroke="#5266eb" strokeWidth="1.6" />
        <path d="M222 92 236 122H208L222 92Z" fill="none" stroke="#ededf3" strokeWidth="2" strokeLinejoin="round" />
        {outputs.map((label, i) => {
          const y = 45 + i * 65
          return (
            <g key={label}>
              <path
                d={`M248,110 C290,110 300,${y} 344,${y}`}
                fill="none"
                stroke="#5266eb"
                strokeWidth="1.4"
                strokeDasharray="4 5"
                opacity="0.7"
                className="animate-[astro-flow_2.4s_linear_infinite]"
              />
              <rect x="346" y={y - 16} width="86" height="32" rx="8" fill="#272735" />
              <text x="389" y={y + 4} textAnchor="middle" fill="#c3c3cc" fontSize="11">
                {label}
              </text>
            </g>
          )
        })}
      </svg>
    </Frame>
  )
}
