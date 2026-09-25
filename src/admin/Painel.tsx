import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'

/**
 * Painel da empresa: CRM, funil e o robô do WhatsApp.
 *
 * É uma página separada do site (segunda entrada do build), então nada deste
 * código vai no pacote que o visitante baixa — e a cena 3D não vem junto.
 *
 * A proteção é do lado do servidor: esta página é pública, o que é privado
 * são as rotas em /api/admin, que exigem o cookie assinado. Esconder a rota
 * no cliente não protegeria nada.
 */

const SITUACOES = ['novo', 'contatado', 'proposta', 'fechado', 'perdido'] as const
type Situacao = (typeof SITUACOES)[number]

/* Os nomes que a equipe lê. As chaves do banco continuam as de sempre. */
const ROTULOS_SITUACAO: Record<Situacao, string> = {
  novo: 'Novos Leads',
  contatado: 'Em Atendimento',
  proposta: 'Proposta Enviada',
  fechado: 'Fechado/Ganho',
  perdido: 'Perdido',
}
/* O caminho de um negócio. "Perdido" é saída lateral, não a etapa depois de
   "Fechado": avançar de um negócio ganho nunca pode marcá-lo como perdido. */
const TRILHA: Situacao[] = ['novo', 'contatado', 'proposta', 'fechado']

type Lead = {
  id: number
  criado_em: string
  nome: string
  empresa: string
  contato: string
  canal: string
  necessidade: string
  urgencia: string
  orcamento: string
  resumo: string
  conversa: { de: string; texto: string }[]
  situacao: Situacao
  valor_centavos: number
  anotacoes: string
  retorno_em: string | null
  responsavel: string
}

type Atividade = { id: number; quando: string; tipo: string; texto: string }

type Resumo = {
  total: number
  semana: number
  atrasados: number
  fechados: number
  receitaCentavos: number
  conversao: number | null
  porSituacao: { situacao: string; quantos: number; valorCentavos: number }[]
  porSemana: { semana: string; quantos: number }[]
  porCanal: { canal: string; quantos: number }[]
}

type Estado = {
  dentro: boolean
  configurado: boolean
  banco: boolean
  whatsapp: boolean
  avisoEquipe: boolean
}

type Robo = {
  textos: Record<string, string>
  padrao: Record<string, string>
  instrucao: string
  instrucaoPadrao: string
  inteligencia: string
  ativo: boolean
  conexao: { estado: 'conectado' | 'desconectado'; detalhe: string; qualidade?: string }
  credenciais: { token: boolean; phoneId: boolean; verifyToken: boolean; appSecret: boolean }
  ligado: boolean
  assinado: boolean
  editavel: boolean
}

type Registro = {
  id: number
  quando: string
  canal: string
  de: string
  entrada: string
  saida: string
  modo: string
}

/* Leads de demonstração, mostrados SÓ enquanto o banco não está ligado.
   Existem para a equipe ver a ferramenta funcionando antes de configurar
   nada — e vêm marcados como exemplo no aviso do topo e no nome de cada um,
   porque um painel que mostra número inventado sem avisar é pior do que um
   painel vazio. */
const EXEMPLOS: Lead[] = [
  {
    id: -1,
    criado_em: new Date().toISOString(),
    nome: 'Exemplo — Marina Duarte',
    empresa: 'Transportes Duarte',
    contato: 'marina@exemplo.com.br',
    canal: 'chat',
    necessidade: 'Automação de processo',
    urgencia: 'Nas próximas semanas',
    orcamento: 'R$ 10 a 30 mil',
    resumo: 'Roteirização feita à mão numa planilha que só uma pessoa sabe operar.',
    conversa: [
      { de: 'robo', texto: 'O que você precisa resolver?' },
      { de: 'pessoa', texto: 'Automação de processo' },
    ],
    situacao: 'novo',
    valor_centavos: 0,
    anotacoes: '',
    retorno_em: null,
    responsavel: '',
  },
  {
    id: -2,
    criado_em: new Date(Date.now() - 86_400_000 * 3).toISOString(),
    nome: 'Exemplo — Rafael Lima',
    empresa: 'Clínica Horizonte',
    contato: '11 99999-0000',
    canal: 'whatsapp',
    necessidade: 'Agendar diagnóstico',
    urgencia: 'Era para ontem',
    orcamento: 'Prefiro conversar antes',
    resumo: 'Agendamento por telefone, com faltas e remarcações fora de controle.',
    conversa: [],
    situacao: 'proposta',
    valor_centavos: 1_800_000,
    anotacoes: 'Proposta enviada, aguardando retorno da sócia.',
    retorno_em: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
    responsavel: 'Duduzcx',
  },
  {
    id: -3,
    criado_em: new Date(Date.now() - 86_400_000 * 9).toISOString(),
    nome: 'Exemplo — Construtora Vega',
    empresa: 'Vega',
    contato: 'contato@exemplo.com',
    canal: 'formulario',
    necessidade: 'Sistema sob medida',
    urgencia: 'Neste trimestre',
    orcamento: 'Acima de R$ 30 mil',
    resumo: 'Portal do cliente para acompanhar a obra.',
    conversa: [],
    situacao: 'fechado',
    valor_centavos: 4_200_000,
    anotacoes: '',
    retorno_em: null,
    responsavel: 'Duduzcx',
  },
]

const RESUMO_EXEMPLO: Resumo = {
  total: 3,
  semana: 1,
  atrasados: 1,
  fechados: 1,
  receitaCentavos: 4_200_000,
  conversao: 100,
  porSituacao: [
    { situacao: 'novo', quantos: 1, valorCentavos: 0 },
    { situacao: 'proposta', quantos: 1, valorCentavos: 1_800_000 },
    { situacao: 'fechado', quantos: 1, valorCentavos: 4_200_000 },
  ],
  porSemana: [
    { semana: '2026-09-08', quantos: 1 },
    { semana: '2026-09-15', quantos: 1 },
    { semana: '2026-09-22', quantos: 1 },
  ],
  porCanal: [
    { canal: 'chat', quantos: 1 },
    { canal: 'whatsapp', quantos: 1 },
    { canal: 'formulario', quantos: 1 },
  ],
}

const CORES: Record<Situacao, string> = {
  novo: 'text-[#8db4f5] border-[#8db4f5]/35',
  contatado: 'text-[#c9a6ff] border-[#c9a6ff]/35',
  proposta: 'text-[#ffd479] border-[#ffd479]/35',
  fechado: 'text-[#86e8a8] border-[#86e8a8]/35',
  perdido: 'text-slate border-white/15',
}

const ROTULOS_ROBO: [string, string][] = [
  ['boasVindas', 'Boas-vindas'],
  ['menu', 'Menu de opções'],
  ['opcao1', 'Opção 1 — agendar'],
  ['opcao2', 'Opção 2 — o que fazemos'],
  ['opcao3', 'Opção 3 — prazo e preço'],
  ['opcao4', 'Opção 4 — falar com humano'],
  ['naoEntendi', 'Quando não entende'],
]

const dinheiro = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const hoje = () => new Date().toISOString().slice(0, 10)
const atrasado = (lead: Lead) =>
  Boolean(lead.retorno_em) &&
  lead.retorno_em! <= hoje() &&
  lead.situacao !== 'fechado' &&
  lead.situacao !== 'perdido'

async function pedir(caminho: string, opcoes: RequestInit = {}) {
  const resposta = await fetch(caminho, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
  })
  const corpo = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(corpo?.erro || `falha ${resposta.status}`)
  return corpo
}

function Entrar({ aoEntrar, estado }: { aoEntrar: () => void; estado: Estado | null }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <form
        onSubmit={async (evento) => {
          evento.preventDefault()
          setErro('')
          setEnviando(true)
          try {
            await pedir('/api/admin/sessao', { method: 'POST', body: JSON.stringify({ senha }) })
            aoEntrar()
          } catch (falha) {
            setErro(falha instanceof Error ? falha.message : 'falhou')
          } finally {
            setEnviando(false)
          }
        }}
        className="graphite-card w-full max-w-sm"
      >
        <h1 className="text-[1.5rem] text-ivory">Painel Astro</h1>
        <p className="mt-2 text-[14px] text-slate">Área restrita da equipe.</p>
        {estado && !estado.configurado ? (
          <p className="mt-5 rounded-xl border border-[#ffd479]/30 bg-[#ffd479]/5 p-3 text-[13px] text-[#ffd479]">
            O painel ainda não foi configurado. Cadastre <code>ADMIN_SENHA</code> (12 caracteres ou
            mais) e <code>ADMIN_SEGREDO</code> nas variáveis de ambiente da Vercel e republique.
          </p>
        ) : null}
        <label className="sr-only" htmlFor="senha">
          Senha
        </label>
        <input
          id="senha"
          type="password"
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
          autoComplete="current-password"
          placeholder="Senha"
          className="mt-6 w-full rounded-2xl bg-obsidian px-5 py-3.5 text-[15px] text-ivory outline-none placeholder:text-slate focus:shadow-[inset_0_0_0_1px_#4d84e0]"
        />
        {erro ? <p className="mt-3 text-[13px] text-[#ff9b9b]">{erro}</p> : null}
        <button
          type="submit"
          disabled={enviando || !senha}
          className="mt-4 w-full rounded-full bg-cobalt px-6 py-3.5 text-[15px] text-white transition-colors hover:bg-[#5d92ea] disabled:opacity-50"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

function Numeros({ resumo }: { resumo: Resumo }) {
  const maior = Math.max(1, ...resumo.porSemana.map((s) => s.quantos))
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { rotulo: 'Leads no total', valor: String(resumo.total), alerta: false },
          { rotulo: 'Nos últimos 7 dias', valor: String(resumo.semana), alerta: false },
          { rotulo: 'Retornos vencidos', valor: String(resumo.atrasados), alerta: resumo.atrasados > 0 },
          { rotulo: 'Conversão', valor: resumo.conversao === null ? '—' : `${resumo.conversao}%`, alerta: false },
          { rotulo: 'Receita fechada', valor: dinheiro(resumo.receitaCentavos), alerta: false },
        ].map((cartao) => (
          <div key={cartao.rotulo} className="graphite-card">
            <p className="label-voice text-[10px]">{cartao.rotulo}</p>
            <p
              className={`mt-3 text-[1.9rem] leading-none font-[480] ${
                cartao.alerta ? 'text-[#ffd479]' : 'text-[#8db4f5]'
              }`}
            >
              {cartao.valor}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="graphite-card">
          <p className="label-voice text-[10px]">Funil</p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {SITUACOES.map((situacao) => {
              const linha = resumo.porSituacao.find((l) => l.situacao === situacao)
              const quantos = linha?.quantos || 0
              const largura = resumo.total ? Math.round((quantos / resumo.total) * 100) : 0
              return (
                <li key={situacao} className="flex items-center gap-3 text-[13px]">
                  <span className="w-36 shrink-0 text-ash">{ROTULOS_SITUACAO[situacao]}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                    <span className="block h-full rounded-full bg-[#8db4f5]" style={{ width: `${largura}%` }} />
                  </span>
                  <span className="w-8 shrink-0 text-right text-ivory">{quantos}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="graphite-card">
          <p className="label-voice text-[10px]">Entrada por semana</p>
          {resumo.porSemana.length === 0 ? (
            <p className="mt-4 text-[13px] text-slate">Sem dados ainda.</p>
          ) : (
            <div className="mt-4 flex h-28 items-end gap-1.5">
              {resumo.porSemana.map((s) => (
                <div key={s.semana} className="flex flex-1 flex-col items-center gap-1.5">
                  <span
                    className="w-full rounded-t bg-[#4d84e0]"
                    style={{ height: `${Math.round((s.quantos / maior) * 88)}px` }}
                    title={`${s.quantos} em ${s.semana}`}
                  />
                  <span className="text-[9px] text-slate">{s.semana.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-[12px] text-slate">
            Por canal: {resumo.porCanal.map((c) => `${c.canal} ${c.quantos}`).join(' · ') || '—'}
          </p>
        </div>
      </div>
    </>
  )
}

function Cartao({
  lead,
  aoMudar,
  compacto = false,
}: {
  lead: Lead
  aoMudar: (campos: Partial<Lead>) => void
  compacto?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [anotacoes, setAnotacoes] = useState(lead.anotacoes)
  const [valor, setValor] = useState(String(lead.valor_centavos / 100 || ''))
  const [atividades, setAtividades] = useState<Atividade[] | null>(null)
  const [nova, setNova] = useState('')

  useEffect(() => {
    if (!aberto || atividades) return
    pedir(`/api/admin/leads?lead=${lead.id}`)
      .then((r) => setAtividades(r.atividades))
      .catch(() => setAtividades([]))
  }, [aberto, atividades, lead.id])

  async function registrar() {
    const texto = nova.trim()
    if (!texto) return
    setNova('')
    try {
      const { atividade } = await pedir('/api/admin/leads', {
        method: 'POST',
        body: JSON.stringify({ id: lead.id, texto }),
      })
      setAtividades((atuais) => [atividade, ...(atuais || [])])
    } catch {
      setNova(texto)
    }
  }

  const passo = TRILHA.indexOf(lead.situacao)
  const anterior = lead.situacao === 'perdido' ? 'contatado' : passo > 0 ? TRILHA[passo - 1] : null
  const proximo = passo >= 0 && passo < TRILHA.length - 1 ? TRILHA[passo + 1] : null
  const passoClasse =
    'rounded-full border border-white/12 px-3 py-1 text-[12px] text-ash transition-colors hover:text-ivory disabled:cursor-default disabled:opacity-35'

  return (
    <li
      className={`graphite-card ${atrasado(lead) ? 'border-[#ffd479]/40' : ''} ${compacto ? 'cursor-grab active:cursor-grabbing' : ''}`}
      draggable={compacto}
      onDragStart={(evento) => {
        if (!compacto) return
        evento.dataTransfer.setData('text/plain', String(lead.id))
        evento.dataTransfer.effectAllowed = 'move'
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[1.05rem] text-ivory">{lead.nome || 'Sem nome'}</p>
          <p className="mt-1 text-[13px] text-slate">
            {[lead.empresa, lead.contato].filter(Boolean).join(' · ') || 'sem contato'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {atrasado(lead) ? (
            <span className="rounded-full border border-[#ffd479]/40 px-2.5 py-0.5 text-[10px] text-[#ffd479] uppercase">
              retorno vencido
            </span>
          ) : null}
          <span className="text-[11px] text-slate">{quando(lead.criado_em)}</span>
          <span className="rounded-full border border-white/12 px-2.5 py-0.5 text-[10px] text-slate uppercase">
            {lead.canal}
          </span>
        </div>
      </div>

      {!compacto ? (
        <dl className="mt-4 grid gap-2 text-[13px] sm:grid-cols-3">
          {[
            ['Precisa de', lead.necessidade],
            ['Prazo', lead.urgencia],
            ['Investimento', lead.orcamento],
          ].map(([rotulo, valorTexto]) => (
            <div key={rotulo}>
              <dt className="label-voice text-[9px]">{rotulo}</dt>
              <dd className="mt-1 text-ash">{valorTexto || '—'}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 line-clamp-3 text-[12px] leading-[1.5] text-ash">
          {lead.necessidade || '—'}
          {lead.resumo ? <span className="text-slate"> — {lead.resumo}</span> : null}
        </p>
      )}

      {lead.resumo && !compacto ? (
        <p className="mt-3 text-[13px] leading-[1.5] text-ash">{lead.resumo}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {compacto ? (
          <>
            <button
              type="button"
              disabled={!anterior}
              onClick={() => anterior && aoMudar({ situacao: anterior })}
              aria-label={anterior ? `Voltar para ${ROTULOS_SITUACAO[anterior]}` : 'Não há etapa anterior'}
              className={passoClasse}
            >
              ← Voltar
            </button>
            <button
              type="button"
              disabled={!proximo}
              onClick={() => proximo && aoMudar({ situacao: proximo })}
              aria-label={proximo ? `Avançar para ${ROTULOS_SITUACAO[proximo]}` : 'Não há etapa seguinte'}
              className={passoClasse}
            >
              Avançar →
            </button>
            {lead.situacao !== 'perdido' && lead.situacao !== 'fechado' ? (
              <button
                type="button"
                onClick={() => aoMudar({ situacao: 'perdido' })}
                className="rounded-full border border-white/10 px-3 py-1 text-[12px] text-slate transition-colors hover:border-[#ff9b9b]/40 hover:text-[#ff9b9b]"
              >
                Perdido
              </button>
            ) : null}
          </>
        ) : (
          SITUACOES.map((situacao) => (
            <button
              key={situacao}
              type="button"
              onClick={() => aoMudar({ situacao })}
              className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                lead.situacao === situacao ? CORES[situacao] : 'border-white/10 text-slate hover:text-ivory'
              }`}
            >
              {ROTULOS_SITUACAO[situacao]}
            </button>
          ))
        )}
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="ml-auto text-[12px] text-slate underline underline-offset-4 hover:text-ivory"
        >
          {aberto ? 'Fechar' : 'Detalhes'}
        </button>
      </div>

      {aberto ? (
        <div className="mt-4 border-t border-white/8 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label-voice text-[9px]" htmlFor={`retorno-${lead.id}`}>
                Retornar em
              </label>
              <input
                id={`retorno-${lead.id}`}
                type="date"
                defaultValue={lead.retorno_em || ''}
                onChange={(evento) => aoMudar({ retorno_em: evento.target.value })}
                className="mt-2 w-full rounded-xl bg-obsidian px-3 py-2 text-[13px] text-ivory outline-none focus:shadow-[inset_0_0_0_1px_#4d84e0]"
              />
            </div>
            <div>
              <label className="label-voice text-[9px]" htmlFor={`dono-${lead.id}`}>
                Responsável
              </label>
              <input
                id={`dono-${lead.id}`}
                defaultValue={lead.responsavel}
                onBlur={(evento) =>
                  evento.target.value !== lead.responsavel && aoMudar({ responsavel: evento.target.value })
                }
                placeholder="quem cuida"
                className="mt-2 w-full rounded-xl bg-obsidian px-3 py-2 text-[13px] text-ivory outline-none placeholder:text-slate focus:shadow-[inset_0_0_0_1px_#4d84e0]"
              />
            </div>
            <div>
              <label className="label-voice text-[9px]" htmlFor={`valor-${lead.id}`}>
                Valor (R$)
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id={`valor-${lead.id}`}
                  inputMode="numeric"
                  value={valor}
                  onChange={(evento) => setValor(evento.target.value.replace(/[^\d]/g, ''))}
                  onBlur={() => aoMudar({ valor_centavos: Number(valor || 0) * 100 })}
                  className="w-full rounded-xl bg-obsidian px-3 py-2 text-[13px] text-ivory outline-none focus:shadow-[inset_0_0_0_1px_#4d84e0]"
                />
              </div>
            </div>
          </div>

          <label className="label-voice mt-5 block text-[9px]" htmlFor={`nota-${lead.id}`}>
            Anotações fixas
          </label>
          <textarea
            id={`nota-${lead.id}`}
            rows={2}
            value={anotacoes}
            onChange={(evento) => setAnotacoes(evento.target.value)}
            onBlur={() => anotacoes !== lead.anotacoes && aoMudar({ anotacoes })}
            className="mt-2 w-full resize-none rounded-xl bg-obsidian px-3 py-2 text-[14px] text-ivory outline-none focus:shadow-[inset_0_0_0_1px_#4d84e0]"
          />

          <p className="label-voice mt-5 text-[9px]">Histórico</p>
          <form
            onSubmit={(evento) => {
              evento.preventDefault()
              void registrar()
            }}
            className="mt-2 flex gap-2"
          >
            <label className="sr-only" htmlFor={`atividade-${lead.id}`}>
              Registrar contato
            </label>
            <input
              id={`atividade-${lead.id}`}
              value={nova}
              onChange={(evento) => setNova(evento.target.value)}
              placeholder="Liguei, mandei proposta…"
              className="w-full rounded-xl bg-obsidian px-3 py-2 text-[13px] text-ivory outline-none placeholder:text-slate focus:shadow-[inset_0_0_0_1px_#4d84e0]"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-obsidian px-4 py-2 text-[13px] text-ivory hover:bg-[#1e2c4c]"
            >
              Registrar
            </button>
          </form>
          {atividades === null ? (
            <p className="mt-3 text-[12px] text-slate">Carregando…</p>
          ) : atividades.length === 0 ? (
            <p className="mt-3 text-[12px] text-slate">Nada registrado ainda.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {atividades.map((a) => (
                <li key={a.id} className="text-[12px] text-ash">
                  <span className="text-slate">{quando(a.quando)}</span> · {a.texto}
                </li>
              ))}
            </ul>
          )}

          {lead.conversa?.length ? (
            <>
              <p className="label-voice mt-5 text-[9px]">A conversa que trouxe este lead</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {lead.conversa.map((fala, i) => (
                  <li key={i} className={`text-[12px] ${fala.de === 'robo' ? 'text-slate' : 'text-ash'}`}>
                    <span className="text-[10px] uppercase">{fala.de === 'robo' ? 'astro' : 'pessoa'}</span>{' '}
                    {fala.texto}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function Funil({ leads, aoMudar }: { leads: Lead[]; aoMudar: (id: number, campos: Partial<Lead>) => void }) {
  /* A coluna sob o cartão arrastado acende. Arrastar é o atalho do mouse; os
     botões de avançar e voltar de cada cartão fazem o mesmo no toque e no
     teclado. */
  const [alvo, setAlvo] = useState<Situacao | null>(null)
  const soltar = (situacao: Situacao) => (evento: DragEvent<HTMLElement>) => {
    evento.preventDefault()
    setAlvo(null)
    const id = Number(evento.dataTransfer.getData('text/plain'))
    const lead = leads.find((l) => l.id === id)
    if (lead && lead.situacao !== situacao) aoMudar(id, { situacao })
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {SITUACOES.map((situacao) => {
        const doEstagio = leads.filter((l) => l.situacao === situacao)
        const soma = doEstagio.reduce((total, l) => total + l.valor_centavos, 0)
        return (
          <section
            key={situacao}
            className={`flex flex-col gap-2 rounded-2xl p-1 transition-colors ${alvo === situacao ? 'bg-[#8db4f5]/8' : ''}`}
            onDragOver={(evento) => {
              evento.preventDefault()
              evento.dataTransfer.dropEffect = 'move'
              if (alvo !== situacao) setAlvo(situacao)
            }}
            onDragLeave={(evento) => {
              if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setAlvo(null)
            }}
            onDrop={soltar(situacao)}
          >
            <header className="flex items-baseline justify-between px-1">
              <h3 className="text-[13px] text-ivory">{ROTULOS_SITUACAO[situacao]}</h3>
              <span className="text-[11px] text-slate">
                {doEstagio.length}
                {soma ? ` · ${dinheiro(soma)}` : ''}
              </span>
            </header>
            {doEstagio.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/8 px-3 py-6 text-center text-[12px] text-slate">
                vazio
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {doEstagio.map((lead) => (
                  <Cartao key={lead.id} lead={lead} compacto aoMudar={(campos) => aoMudar(lead.id, campos)} />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

const MODOS: Record<string, string> = {
  menu: 'menu',
  opcao1: 'agendar',
  opcao2: 'o que fazemos',
  opcao3: 'prazo e preço',
  opcao4: 'humano',
  humano: 'para humano',
  silencio: 'em silêncio',
  ia: 'inteligência',
  falha: 'falha',
}

function Interacoes() {
  const [registros, setRegistros] = useState<Registro[] | null>(null)
  const [aoVivo, setAoVivo] = useState(true)

  /* "Tempo real" aqui é uma leitura a cada cinco segundos enquanto a aba está
     aberta. Função sem servidor não segura conexão para empurrar eventos; e
     cinco segundos é o que a equipe leva para olhar uma linha. */
  useEffect(() => {
    let vivo = true
    const ler = () =>
      pedir('/api/admin/whatsapp?logs=1')
        .then((r) => {
          if (vivo) setRegistros(r.logs)
        })
        .catch(() => {
          if (vivo) setRegistros((atuais) => atuais || [])
        })
    void ler()
    const relogio = aoVivo ? window.setInterval(ler, 5000) : 0
    return () => {
      vivo = false
      if (relogio) window.clearInterval(relogio)
    }
  }, [aoVivo])

  return (
    <div className="graphite-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[1.1rem] text-ivory">Interações do robô</h3>
          <p className="mt-1 text-[13px] text-slate">
            Cada mensagem que chegou, pelo WhatsApp ou pelo chat do site, e o que saiu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAoVivo((v) => !v)}
          className={`rounded-full border px-3.5 py-1.5 text-[12px] transition-colors ${
            aoVivo ? 'border-[#86e8a8]/40 text-[#86e8a8]' : 'border-white/10 text-slate hover:text-ivory'
          }`}
        >
          {aoVivo ? '● ao vivo' : 'pausado'}
        </button>
      </div>
      {registros === null ? (
        <p className="mt-4 text-[13px] text-slate">Carregando…</p>
      ) : registros.length === 0 ? (
        <p className="mt-4 text-[13px] text-slate">
          Nenhuma interação registrada ainda. Elas aparecem aqui assim que alguém escrever para o
          robô — com o banco ligado.
        </p>
      ) : (
        <ul className="mt-4 flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
          {registros.map((r) => (
            <li key={r.id} className="rounded-xl bg-obsidian/70 px-3 py-2 text-[12px]">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase text-slate">
                <span>{quando(r.quando)}</span>
                <span className="rounded-full border border-white/12 px-2 py-0.5">{r.canal}</span>
                <span className="rounded-full border border-white/12 px-2 py-0.5">{MODOS[r.modo] || r.modo}</span>
                <span className="normal-case">{r.de}</span>
              </div>
              <p className="mt-1.5 text-ash">
                <span className="text-slate">recebeu:</span> {r.entrada || '—'}
              </p>
              <p className="mt-1 text-ash">
                <span className="text-slate">respondeu:</span>{' '}
                {r.saida ? r.saida.slice(0, 220) + (r.saida.length > 220 ? '…' : '') : 'nada (robô desligado ou falha)'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AbaRobo() {
  const [robo, setRobo] = useState<Robo | null>(null)
  const [rascunho, setRascunho] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    pedir('/api/admin/whatsapp')
      .then((r) => {
        setRobo(r)
        setRascunho({ ...r.textos, instrucao: r.instrucao })
      })
      .catch(() => setAviso('não foi possível ler a configuração do robô'))
  }, [])

  if (!robo) return <p className="text-[14px] text-slate">{aviso || 'Carregando…'}</p>

  const conectado = robo.conexao.estado === 'conectado'
  const credencial = (ok: boolean) => (ok ? 'configurado ••••••••' : 'falta')

  async function alternar() {
    if (!robo) return
    const ativo = !robo.ativo
    setRobo({ ...robo, ativo })
    try {
      const r = await pedir('/api/admin/whatsapp', { method: 'PUT', body: JSON.stringify({ ativo }) })
      setRobo((atual) => (atual ? { ...atual, ativo: r.ativo } : atual))
    } catch (falha) {
      setRobo((atual) => (atual ? { ...atual, ativo: !ativo } : atual))
      setAviso(falha instanceof Error ? falha.message : 'não foi possível mudar')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="graphite-card">
          <p className="label-voice text-[10px]">Conexão com o WhatsApp</p>
          <p className={`mt-2 flex items-center gap-2 text-[15px] ${conectado ? 'text-[#86e8a8]' : 'text-[#ffd479]'}`}>
            <span aria-hidden="true">{conectado ? '●' : '○'}</span>
            {conectado ? 'Conectado' : 'Desconectado'}
          </p>
          <p className="mt-1 text-[12px] text-slate">{robo.conexao.detalhe}</p>
          {robo.conexao.qualidade ? (
            <p className="mt-1 text-[12px] text-slate">qualidade do número na Meta: {robo.conexao.qualidade}</p>
          ) : null}
        </div>

        <div className="graphite-card">
          <p className="label-voice text-[10px]">Credenciais (Meta Cloud API)</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
            {[
              ['Access Token', robo.credenciais.token],
              ['Phone Number ID', robo.credenciais.phoneId],
              ['Verify Token', robo.credenciais.verifyToken],
              ['App Secret', robo.credenciais.appSecret],
            ].map(([rotulo, ok]) => (
              <div key={String(rotulo)} className="contents">
                <dt className="text-slate">{String(rotulo)}</dt>
                <dd className={ok ? 'text-ash' : 'text-[#ffd479]'}>{credencial(Boolean(ok))}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] leading-[1.5] text-slate">
            Vivem nas variáveis de ambiente da Vercel, nunca aqui nem no banco. A Cloud API não
            pareia por QR code: isso é coisa de robô sobre o aplicativo (Evolution, Baileys), que a
            Meta pode bloquear.
          </p>
        </div>

        <div className="graphite-card">
          <p className="label-voice text-[10px]">Bot de atendimento</p>
          <button
            type="button"
            role="switch"
            aria-checked={robo.ativo}
            disabled={!robo.editavel}
            onClick={() => void alternar()}
            className="mt-2 flex items-center gap-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              aria-hidden="true"
              className={`relative inline-block h-6 w-11 rounded-full transition-colors ${robo.ativo ? 'bg-[#86e8a8]' : 'bg-white/15'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-onyx transition-[left] ${robo.ativo ? 'left-[22px]' : 'left-0.5'}`}
              />
            </span>
            <span className={`text-[15px] ${robo.ativo ? 'text-[#86e8a8]' : 'text-[#ffd479]'}`}>
              {robo.ativo ? 'Ativado' : 'Desativado'}
            </span>
          </button>
          <p className="mt-2 text-[11px] leading-[1.5] text-slate">
            {robo.editavel
              ? 'Desligado, o robô do WhatsApp lê, registra e guarda o lead, mas não responde — quem responde é uma pessoa. O chat do site volta ao roteiro.'
              : 'O interruptor precisa do banco (POSTGRES_URL). Sem ele o robô fica ligado.'}
          </p>
        </div>
      </div>

      {!robo.ligado ? (
        <p className="rounded-xl border border-[#ffd479]/30 bg-[#ffd479]/5 px-4 py-3 text-[13px] text-[#ffd479]">
          O robô ainda não atende: faltam as variáveis da Cloud API. O passo a passo está em
          docs/whatsapp-automacao.md — e leia o aviso sobre o número, que sai do aplicativo comum
          do WhatsApp.
        </p>
      ) : null}

      <Interacoes />

      <div className="graphite-card">
        <p className="label-voice text-[10px]">Inteligência do chat do site</p>
        <p className="mt-2 text-[13px] text-slate">
          {robo.inteligencia
            ? 'Ligada (' + robo.inteligencia + '). O chat responde perguntas livres depois do roteiro.'
            : 'Desligada. O chat usa só o roteiro de seis perguntas, que funciona e nao custa nada. Para ligar, cadastre ANTHROPIC_API_KEY ou OPENAI_API_KEY na Vercel.'}
        </p>
        <label className="label-voice mt-5 block text-[9px]" htmlFor="robo-instrucao">
          Instrucao que a inteligencia le antes de falar pela empresa
        </label>
        <textarea
          id="robo-instrucao"
          rows={10}
          value={rascunho.instrucao ?? ''}
          onChange={(evento) => setRascunho({ ...rascunho, instrucao: evento.target.value })}
          className="mt-2 w-full resize-y rounded-xl bg-obsidian px-3 py-2 font-mono text-[12px] leading-[1.6] text-ivory outline-none focus:shadow-[inset_0_0_0_1px_#4d84e0]"
        />
        <p className="mt-2 text-[12px] text-slate">
          E aqui que se proibe inventar preco e prazo. Em branco, volta ao padrao de fabrica.
        </p>
      </div>

      <div className="graphite-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[1.1rem] text-ivory">O que o robo do WhatsApp responde</h3>
            <p className="mt-1 text-[13px] text-slate">
              Muda aqui e vale na próxima mensagem. Sem republicar o site.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRascunho({ ...robo.padrao, instrucao: robo.instrucaoPadrao })}
              className="text-[12px] text-slate underline underline-offset-4 hover:text-ivory"
            >
              Voltar ao padrão
            </button>
            <button
              type="button"
              disabled={!robo.editavel}
              onClick={async () => {
                setAviso('')
                try {
                  const r = await pedir('/api/admin/whatsapp', {
                    method: 'PUT',
                    body: JSON.stringify({ textos: rascunho, instrucao: rascunho.instrucao }),
                  })
                  setRobo({ ...robo, textos: r.textos })
                  setAviso('salvo')
                } catch (falha) {
                  setAviso(falha instanceof Error ? falha.message : 'falhou')
                }
              }}
              className="rounded-full bg-cobalt px-5 py-2 text-[13px] text-white transition-colors hover:bg-[#5d92ea] disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </div>
        {aviso ? <p className="mt-3 text-[13px] text-[#8db4f5]">{aviso}</p> : null}

        <div className="mt-5 flex flex-col gap-5">
          {ROTULOS_ROBO.map(([chave, rotulo]) => (
            <div key={chave}>
              <label className="label-voice text-[9px]" htmlFor={`robo-${chave}`}>
                {rotulo}
              </label>
              <textarea
                id={`robo-${chave}`}
                rows={chave === 'menu' || chave.startsWith('opcao') ? 6 : 3}
                value={rascunho[chave] ?? ''}
                onChange={(evento) => setRascunho({ ...rascunho, [chave]: evento.target.value })}
                className="mt-2 w-full resize-y rounded-xl bg-obsidian px-3 py-2 font-mono text-[12px] leading-[1.6] text-ivory outline-none focus:shadow-[inset_0_0_0_1px_#4d84e0]"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Painel() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [aba, setAba] = useState<'funil' | 'lista' | 'robo'>('funil')
  const [filtro, setFiltro] = useState<'' | Situacao>('')
  const [busca, setBusca] = useState('')
  const [soAtrasados, setSoAtrasados] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const verificar = useCallback(async () => {
    try {
      setEstado(await pedir('/api/admin/sessao'))
    } catch {
      setEstado({ dentro: false, configurado: false, banco: false, whatsapp: false, avisoEquipe: false })
    }
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const [lista, numeros] = await Promise.all([
        pedir(`/api/admin/leads?situacao=${filtro}&busca=${encodeURIComponent(busca.trim())}`),
        pedir('/api/admin/resumo'),
      ])
      setLeads(lista.leads)
      setResumo(numeros)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'falhou')
    } finally {
      setCarregando(false)
    }
  }, [filtro, busca])

  useEffect(() => {
    void verificar()
  }, [verificar])

  useEffect(() => {
    if (estado?.dentro && estado.banco) void carregar()
  }, [estado?.dentro, estado?.banco, carregar])

  /* Sem banco, o painel mostra exemplos em vez de uma tela vazia — com o
     aviso de que sao exemplos, e sem deixar mexer neles. */
  const demonstracao = Boolean(estado?.dentro && !estado.banco)

  const mudar = async (id: number, campos: Partial<Lead>) => {
    try {
      const { lead } = await pedir('/api/admin/leads', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...campos }),
      })
      setLeads((atuais) => atuais.map((l) => (l.id === id ? lead : l)))
      pedir('/api/admin/resumo').then(setResumo).catch(() => {})
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'falhou')
    }
  }

  const base = demonstracao ? EXEMPLOS : leads
  const visiveis = useMemo(() => (soAtrasados ? base.filter(atrasado) : base), [base, soAtrasados])

  const avisos = useMemo(() => {
    if (!estado) return []
    const lista: string[] = []
    if (!estado.banco) lista.push('Banco não configurado: nenhum lead é guardado. Cadastre POSTGRES_URL e republique.')
    if (!estado.whatsapp) lista.push('WhatsApp Cloud API não configurada: o robô não atende e o aviso de lead novo não sai.')
    else if (!estado.avisoEquipe) lista.push('Falta EQUIPE_WHATSAPP: ninguém é avisado quando entra lead.')
    return lista
  }, [estado])

  if (!estado) return <div className="flex min-h-svh items-center justify-center text-slate">Carregando…</div>
  if (!estado.dentro) return <Entrar aoEntrar={verificar} estado={estado} />

  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[1.8rem] text-ivory">Painel Astro</h1>
          <p className="mt-1 text-[13px] text-slate">CRM, funil e a automação do WhatsApp.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void carregar()}
            className="rounded-full border border-white/12 px-4 py-2 text-[13px] text-ash hover:text-ivory"
          >
            {carregando ? 'Atualizando…' : 'Atualizar'}
          </button>
          <button
            type="button"
            onClick={async () => {
              await pedir('/api/admin/sessao', { method: 'DELETE' }).catch(() => {})
              void verificar()
            }}
            className="text-[13px] text-slate underline underline-offset-4 hover:text-ivory"
          >
            Sair
          </button>
        </div>
      </header>

      {avisos.length ? (
        <ul className="mt-6 flex flex-col gap-2">
          {avisos.map((aviso) => (
            <li
              key={aviso}
              className="rounded-xl border border-[#ffd479]/30 bg-[#ffd479]/5 px-4 py-3 text-[13px] text-[#ffd479]"
            >
              {aviso}
            </li>
          ))}
        </ul>
      ) : null}

      {erro ? <p className="mt-6 text-[13px] text-[#ff9b9b]">{erro}</p> : null}

      <nav className="mt-8 flex gap-2">
        {[
          ['funil', 'Funil'],
          ['lista', 'Leads'],
          ['robo', 'Automação WhatsApp'],
        ].map(([chave, rotulo]) => (
          <button
            key={chave}
            type="button"
            onClick={() => setAba(chave as typeof aba)}
            className={`rounded-full border px-4 py-2 text-[13px] transition-colors ${
              aba === chave ? 'border-[#8db4f5]/50 text-ivory' : 'border-white/10 text-slate hover:text-ivory'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {aba === 'robo' ? (
          <AbaRobo />
        ) : (
          <>
            {demonstracao ? (
              <p className="mb-4 rounded-xl border border-[#8db4f5]/25 bg-[#8db4f5]/5 px-4 py-3 text-[13px] text-[#8db4f5]">
                Modo demonstracao: estes leads sao exemplos, para voce ver a ferramenta
                funcionando. Ligue o banco (POSTGRES_URL) e eles somem, dando lugar aos contatos
                de verdade.
              </p>
            ) : null}
            {demonstracao ? <Numeros resumo={RESUMO_EXEMPLO} /> : resumo ? <Numeros resumo={resumo} /> : null}

            <div className="mt-8 flex flex-wrap items-center gap-2">
              {(['', ...SITUACOES] as const).map((situacao) => (
                <button
                  key={situacao || 'todos'}
                  type="button"
                  onClick={() => setFiltro(situacao)}
                  className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${
                    filtro === situacao ? 'border-[#8db4f5]/50 text-ivory' : 'border-white/10 text-slate hover:text-ivory'
                  }`}
                >
                  {situacao ? ROTULOS_SITUACAO[situacao] : 'Todos'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSoAtrasados((v) => !v)}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${
                  soAtrasados ? 'border-[#ffd479]/50 text-[#ffd479]' : 'border-white/10 text-slate hover:text-ivory'
                }`}
              >
                só vencidos
              </button>
              <form
                onSubmit={(evento) => {
                  evento.preventDefault()
                  void carregar()
                }}
                className="ml-auto flex gap-2"
              >
                <label className="sr-only" htmlFor="busca">
                  Buscar
                </label>
                <input
                  id="busca"
                  value={busca}
                  onChange={(evento) => setBusca(evento.target.value)}
                  placeholder="Buscar nome, empresa, contato…"
                  className="w-64 rounded-full bg-obsidian px-4 py-2 text-[13px] text-ivory outline-none placeholder:text-slate focus:shadow-[inset_0_0_0_1px_#4d84e0]"
                />
              </form>
            </div>

            <div className="mt-5">
              {visiveis.length === 0 ? (
                <p className="text-[14px] text-slate">Nenhum lead por aqui ainda.</p>
              ) : aba === 'funil' ? (
                <Funil leads={visiveis} aoMudar={demonstracao ? () => {} : mudar} />
              ) : (
                <ul className="flex flex-col gap-3">
                  {visiveis.map((lead) => (
                    <Cartao
                      key={lead.id}
                      lead={lead}
                      aoMudar={(campos) => {
                        if (demonstracao) return
                        void mudar(lead.id, campos)
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
