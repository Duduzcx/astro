import { motion } from 'framer-motion'
import { AstroMark, STAR_PATH } from '../brand/AstroMark'
import { AnimatedNumber } from '../ui/Primitives'

/**
 * Telas de produto fictícias: janelas em grafite com cobalto como única cor.
 * Cada uma esboça a cara de um tipo de entrega — e cada uma se monta quando
 * entra na tela, uma vez só. Depois disso ficam os loops discretos (pulsos,
 * pacotes andando, brilho na vitrine), todos em transform, opacidade ou
 * traço de SVG: nada que force layout.
 */

const once = { once: true, amount: 0.35 } as const
const ease = [0.22, 1, 0.36, 1] as const

const rise = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

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

/** Painel de operação: menu lateral, blocos de número e gráfico de receita. */
export function DashboardPanel() {
  const line =
    'M0,95 C40,90 60,70 95,72 C130,74 150,50 190,52 C230,54 250,38 290,30 C330,24 360,18 400,12'
  return (
    <Frame label="Tela de um sistema de gestão com indicadores e gráfico de faturamento">
      <motion.div
        className="flex"
        initial="hidden"
        whileInView="show"
        viewport={once}
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
      >
        <div className="hidden w-36 shrink-0 flex-col gap-1 border-r border-white/5 p-4 sm:flex">
          {['Visão geral', 'Pedidos', 'Agenda', 'Estoque', 'Financeiro', 'Equipe'].map(
            (item, i) => (
              <motion.span
                key={item}
                variants={rise}
                transition={{ duration: 0.5, ease }}
                className={`rounded-md px-3 py-1.5 text-[11px] ${
                  i === 0 ? 'bg-obsidian text-ivory' : 'text-slate'
                }`}
              >
                {item}
              </motion.span>
            ),
          )}
        </div>
        <div className="flex-1 p-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Faturamento', 'R$ 184 mil', true],
              ['Pedidos hoje', '312', true],
              ['Inadimplência', '1,2%', false],
            ].map(([label, value, counts]) => (
              <motion.div
                key={label as string}
                variants={rise}
                transition={{ duration: 0.55, ease }}
                className="rounded-lg bg-obsidian p-3"
              >
                <p className="text-[9px] tracking-[0.06em] text-slate uppercase">{label}</p>
                <p className="mt-1 text-[15px] font-[480] text-ivory">
                  {counts ? <AnimatedNumber value={value as string} /> : value}
                </p>
              </motion.div>
            ))}
          </div>
          <svg viewBox="0 0 400 120" className="mt-3 w-full" aria-hidden="true">
            <defs>
              <linearGradient id="panel-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#4d84e0" stopOpacity="0.35" />
                <stop offset="1" stopColor="#4d84e0" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g stroke="#ffffff" strokeOpacity="0.06">
              <line x1="0" y1="40" x2="400" y2="40" />
              <line x1="0" y1="80" x2="400" y2="80" />
            </g>
            {/* A área aparece depois que a linha terminou de se desenhar. */}
            <motion.path
              d={`${line} L400,120 L0,120 Z`}
              fill="url(#panel-fill)"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={once}
              transition={{ duration: 0.8, delay: 1.3 }}
            />
            <motion.path
              d={line}
              fill="none"
              stroke="#4d84e0"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={once}
              transition={{ duration: 1.5, delay: 0.3, ease }}
            />
            {/* A ponta viva do gráfico. */}
            <motion.circle
              cx="400"
              cy="12"
              r="3.5"
              fill="#8db4f5"
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={once}
              transition={{ duration: 0.4, delay: 1.7 }}
              className="origin-[400px_12px] animate-[astro-pulse_2.2s_ease-in-out_infinite]"
            />
          </svg>
        </div>
      </motion.div>
    </Frame>
  )
}

/** Loja: barra do browser, banner e cards de produto. */
export function StorefrontPanel() {
  return (
    <Frame label="Tela de um e-commerce com vitrine de produtos">
      <motion.div
        className="px-4 pb-4"
        initial="hidden"
        whileInView="show"
        viewport={once}
        variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      >
        <motion.div
          variants={rise}
          transition={{ duration: 0.5, ease }}
          className="mt-3 flex items-center gap-2 rounded-full bg-obsidian px-4 py-1.5"
        >
          <span className="h-1.5 w-1.5 animate-[astro-pulse_2s_ease-in-out_infinite] rounded-full bg-[#4ade80]" />
          <span className="text-[10px] text-slate">mercadobonfim.com.br</span>
        </motion.div>
        <motion.div
          variants={rise}
          transition={{ duration: 0.5, ease }}
          className="mt-3 rounded-lg bg-obsidian p-4"
        >
          <p className="text-[13px] font-[480] text-ivory">Feira da semana, entregue em casa</p>
          <p className="mt-1 text-[10px] text-slate">Estoque sincronizado com a loja física</p>
        </motion.div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[
            ['Cesta orgânica', 'R$ 89'],
            ['Café da casa', 'R$ 34'],
            ['Assinatura', 'R$ 149/mês'],
          ].map(([name, price], i) => (
            <motion.div
              key={name}
              variants={{ hidden: { opacity: 0, y: 14, scale: 0.94 }, show: { opacity: 1, y: 0, scale: 1 } }}
              transition={{ duration: 0.55, ease }}
              className="rounded-lg bg-obsidian p-3"
            >
              {/* Vitrine "carregando": um brilho que varre a foto em loop. */}
              <div
                className="h-10 rounded-md bg-[linear-gradient(100deg,rgba(255,255,255,0.04)_30%,rgba(141,180,245,0.16)_50%,rgba(255,255,255,0.04)_70%)] bg-[length:250%_100%] animate-[astro-shimmer_3.2s_ease-in-out_infinite]"
                style={{ animationDelay: `${i * 0.35}s` }}
              />
              <p className="mt-2 text-[10px] text-ash">{name}</p>
              <p className="text-[11px] font-[480] text-ivory">{price}</p>
            </motion.div>
          ))}
        </div>
        <motion.div variants={rise} transition={{ duration: 0.5, ease }} className="mt-2 flex justify-end">
          <span className="relative rounded-full bg-cobalt px-4 py-1.5 text-[10px] text-white">
            {/* Anel que se expande uma vez, chamando o olho para o botão. */}
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-cobalt"
              initial={{ opacity: 0, scale: 1 }}
              whileInView={{ opacity: [0, 0.8, 0], scale: [1, 1.6, 1.9] }}
              viewport={once}
              transition={{ duration: 1.4, delay: 1.1, ease: 'easeOut' }}
            />
            Finalizar pedido
          </span>
        </motion.div>
      </motion.div>
    </Frame>
  )
}

/** WhatsApp: uma conversa de remarcação se resolvendo sozinha. */
export function ChatPanel() {
  const bubbles = [
    { from: 'them', text: 'Oi! Preciso remarcar minha consulta de quinta.' },
    { from: 'system', text: 'Claro! Tenho quinta às 16h ou sexta às 9h30. Qual prefere?' },
    { from: 'them', text: 'Sexta 9h30.' },
    { from: 'system', text: 'Remarcado ✓ Enviei a confirmação por e-mail e avisei a recepção.' },
  ] as const
  /* Cada balão espera o anterior; antes dos balões do sistema aparece o
     "digitando" por um instante — é o que faz parecer conversa, não lista. */
  const at = (i: number) => 0.2 + i * 0.85
  return (
    <Frame label="Conversa de WhatsApp em que o sistema remarca uma consulta sozinho">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 pb-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-obsidian">
            <AstroMark className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-[480] text-ivory">Clínica Áurea · Agenda</p>
            <p className="flex items-center gap-1.5 text-[9px] text-[#4ade80]">
              <span className="h-1 w-1 animate-[astro-pulse_1.6s_ease-in-out_infinite] rounded-full bg-[#4ade80]" />
              online agora
            </p>
          </div>
        </div>
        {bubbles.map((bubble, i) => {
          const system = bubble.from === 'system'
          return (
            <div key={bubble.text} className={`flex flex-col ${system ? 'items-end' : 'items-start'}`}>
              {system ? (
                <motion.span
                  aria-hidden="true"
                  className="mb-1 flex gap-1 rounded-xl rounded-br-sm bg-cobalt/40 px-3 py-2"
                  initial={{ opacity: 0, height: 0 }}
                  whileInView={{ opacity: [0, 1, 1, 0], height: [0, 22, 22, 0] }}
                  viewport={once}
                  transition={{ duration: 0.75, delay: at(i) - 0.7, times: [0, 0.15, 0.85, 1] }}
                >
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-1 w-1 animate-[astro-pulse_0.9s_ease-in-out_infinite] rounded-full bg-white"
                      style={{ animationDelay: `${d * 0.15}s` }}
                    />
                  ))}
                </motion.span>
              ) : null}
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={once}
                transition={{ duration: 0.45, delay: at(i), ease }}
                className={`max-w-[80%] rounded-xl px-3 py-2 text-[11px] leading-[1.45] ${
                  system
                    ? 'origin-bottom-right rounded-br-sm bg-cobalt/90 text-white'
                    : 'origin-bottom-left rounded-bl-sm bg-obsidian text-ash'
                }`}
              >
                {bubble.text}
              </motion.div>
            </div>
          )
        })}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={once}
          transition={{ duration: 0.6, delay: at(bubbles.length) }}
          className="pt-1 text-center text-[9px] text-slate"
        >
          resolvido em 40 segundos · sem tocar na recepção
        </motion.p>
      </div>
    </Frame>
  )
}

/** Telemetria: blocos de sensor ao vivo e uma parede de mini-gráficos. */
export function TelemetryPanel() {
  const sensors = [
    ['Câmara fria 01', '-18,2 °C', '#8db4f5'],
    ['Umidade galpão', '54%', '#5a8fe8'],
    ['Energia linha A', '12,4 kW', '#4d84e0'],
    ['Esteira 03', 'ativa', '#4ade80'],
  ] as const
  const spark = 'M0,16 C12,14 18,20 30,17 C42,14 48,8 60,10 C72,12 78,6 90,8 C102,10 110,5 120,7'
  return (
    <Frame label="Painel de sensores IoT com leituras de temperatura, umidade e energia em tempo real">
      <div className="relative p-4">
        {/* Varredura: uma faixa clara atravessa o painel como um radar. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,transparent_40%,rgba(141,180,245,0.07)_50%,transparent_60%)] bg-[length:300%_100%] animate-[astro-shimmer_6s_linear_infinite]"
        />
        <div className="relative flex items-center justify-between pb-3">
          <p className="text-[11px] font-[480] text-ivory">Telemetria · agora</p>
          <span className="flex items-center gap-1.5 text-[9px] text-slate">
            <span className="h-1.5 w-1.5 animate-[astro-pulse_1.8s_ease-in-out_infinite] rounded-full bg-[#4ade80]" />
            42 sensores online
          </span>
        </div>
        <motion.div
          className="relative grid grid-cols-2 gap-2"
          initial="hidden"
          whileInView="show"
          viewport={once}
          variants={{ show: { transition: { staggerChildren: 0.12 } } }}
        >
          {sensors.map(([name, value, tint], i) => (
            <motion.div
              key={name}
              variants={rise}
              transition={{ duration: 0.5, ease }}
              className="rounded-lg bg-obsidian p-3"
            >
              <p className="text-[9px] tracking-[0.06em] text-slate uppercase">{name}</p>
              <p className="mt-1 text-[15px] font-[480]" style={{ color: tint }}>
                {value}
              </p>
              <svg viewBox="0 0 120 24" className="mt-2 w-full overflow-visible" aria-hidden="true">
                <motion.path
                  d={spark}
                  fill="none"
                  stroke={tint}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity="0.7"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={once}
                  transition={{ duration: 1.2, delay: 0.3 + i * 0.12, ease }}
                />
                {/* Leitura mais recente: um ponto que pulsa na ponta da linha. */}
                <circle
                  cx="120"
                  cy="7"
                  r="2.2"
                  fill={tint}
                  className="origin-[120px_7px] animate-[astro-pulse_1.8s_ease-in-out_infinite]"
                  style={{ animationDelay: `${i * 0.3}s` }}
                />
              </svg>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </Frame>
  )
}

/** Hub de integração: as fontes entram no centro e as saídas partem dele. */
export function PipelinePanel() {
  const inputs = ['ERP', 'Site', 'WhatsApp']
  const outputs = ['Financeiro', 'BI', 'Estoque']
  const inPath = (y: number) => `M96,${y} C140,${y} 160,110 196,110`
  const outPath = (y: number) => `M248,110 C290,110 300,${y} 344,${y}`
  return (
    <Frame label="Diagrama: ERP, site e WhatsApp entram na Astro Soluções e saem para financeiro, BI e estoque">
      <motion.svg
        viewBox="0 0 440 220"
        className="w-full p-2"
        aria-hidden="true"
        initial="hidden"
        whileInView="show"
        viewport={once}
        variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      >
        {inputs.map((label, i) => {
          const y = 45 + i * 65
          return (
            <motion.g key={label} variants={rise} transition={{ duration: 0.5, ease }}>
              <rect x="8" y={y - 16} width="86" height="32" rx="8" fill="#1b2740" />
              <text x="51" y={y + 4} textAnchor="middle" fill="#b9c2d4" fontSize="11">
                {label}
              </text>
              <path
                d={inPath(y)}
                fill="none"
                stroke="#4d84e0"
                strokeWidth="1.4"
                strokeDasharray="4 5"
                opacity="0.7"
                className="animate-[astro-flow_2.4s_linear_infinite]"
              />
              {/* O pacote de dados percorrendo a linha até o hub. SMIL nativo:
                  segue a curva exata, sem custo de layout. */}
              <circle r="3" fill="#8db4f5">
                <animateMotion
                  dur="2.6s"
                  begin={`${i * 0.85}s`}
                  repeatCount="indefinite"
                  path={inPath(y)}
                  calcMode="spline"
                  keySplines="0.4 0 0.2 1"
                  keyTimes="0;1"
                />
              </circle>
            </motion.g>
          )
        })}
        {/* O hub respira: um anel que se expande e some, em loop. */}
        <circle
          cx="222"
          cy="110"
          r="34"
          fill="none"
          stroke="#4d84e0"
          strokeWidth="1"
          className="origin-[222px_110px] animate-[astro-ripple_3s_ease-out_infinite]"
        />
        <circle cx="222" cy="110" r="34" fill="#0a0f1e" stroke="#4d84e0" strokeWidth="1.6" />
        {/* A estrela da marca no centro do hub: mesmo desenho do símbolo. */}
        <g transform="translate(222 107) scale(0.46) translate(-60 -60)">
          <path d={STAR_PATH} fill="#f5f7fb" />
        </g>
        {outputs.map((label, i) => {
          const y = 45 + i * 65
          return (
            <motion.g key={label} variants={rise} transition={{ duration: 0.5, ease }}>
              <path
                d={outPath(y)}
                fill="none"
                stroke="#4d84e0"
                strokeWidth="1.4"
                strokeDasharray="4 5"
                opacity="0.7"
                className="animate-[astro-flow_2.4s_linear_infinite]"
              />
              <circle r="3" fill="#8db4f5">
                <animateMotion
                  dur="2.6s"
                  begin={`${1.3 + i * 0.85}s`}
                  repeatCount="indefinite"
                  path={outPath(y)}
                  calcMode="spline"
                  keySplines="0.4 0 0.2 1"
                  keyTimes="0;1"
                />
              </circle>
              <rect x="346" y={y - 16} width="86" height="32" rx="8" fill="#1b2740" />
              <text x="389" y={y + 4} textAnchor="middle" fill="#b9c2d4" fontSize="11">
                {label}
              </text>
            </motion.g>
          )
        })}
      </motion.svg>
    </Frame>
  )
}
