import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Painel da empresa: leads, funil e números.
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
}

type Resumo = {
  total: number
  semana: number
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

const CORES: Record<Situacao, string> = {
  novo: 'text-[#8db4f5] border-[#8db4f5]/35',
  contatado: 'text-[#c9a6ff] border-[#c9a6ff]/35',
  proposta: 'text-[#ffd479] border-[#ffd479]/35',
  fechado: 'text-[#86e8a8] border-[#86e8a8]/35',
  perdido: 'text-slate border-white/15',
}

const dinheiro = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

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
            O painel ainda não foi configurado. Cadastre <code>ADMIN_SENHA</code> e{' '}
            <code>ADMIN_SEGREDO</code> nas variáveis de ambiente da Vercel e republique.
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { rotulo: 'Leads no total', valor: String(resumo.total) },
          { rotulo: 'Nos últimos 7 dias', valor: String(resumo.semana) },
          { rotulo: 'Conversão', valor: resumo.conversao === null ? '—' : `${resumo.conversao}%` },
          { rotulo: 'Receita fechada', valor: dinheiro(resumo.receitaCentavos) },
        ].map((cartao) => (
          <div key={cartao.rotulo} className="graphite-card">
            <p className="label-voice text-[10px]">{cartao.rotulo}</p>
            <p className="mt-3 text-[2.2rem] leading-none font-[480] text-[#8db4f5]">{cartao.valor}</p>
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
                  <span className="w-20 shrink-0 text-ash capitalize">{situacao}</span>
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

function Cartao({ lead, aoMudar }: { lead: Lead; aoMudar: (campos: Partial<Lead>) => void }) {
  const [aberto, setAberto] = useState(false)
  const [anotacoes, setAnotacoes] = useState(lead.anotacoes)
  const [valor, setValor] = useState(String(lead.valor_centavos / 100 || ''))

  return (
    <li className="graphite-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[1.05rem] text-ivory">{lead.nome || 'Sem nome'}</p>
          <p className="mt-1 text-[13px] text-slate">
            {[lead.empresa, lead.contato].filter(Boolean).join(' · ') || 'sem contato'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate">{quando(lead.criado_em)}</span>
          <span className="rounded-full border border-white/12 px-2.5 py-0.5 text-[10px] text-slate uppercase">
            {lead.canal}
          </span>
        </div>
      </div>

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

      {lead.resumo ? <p className="mt-3 text-[13px] leading-[1.5] text-ash">{lead.resumo}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {SITUACOES.map((situacao) => (
          <button
            key={situacao}
            type="button"
            onClick={() => aoMudar({ situacao })}
            className={`rounded-full border px-3 py-1 text-[12px] capitalize transition-colors ${
              lead.situacao === situacao ? CORES[situacao] : 'border-white/10 text-slate hover:text-ivory'
            }`}
          >
            {situacao}
          </button>
        ))}
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
          <label className="label-voice text-[9px]" htmlFor={`valor-${lead.id}`}>
            Valor do negócio (R$)
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id={`valor-${lead.id}`}
              inputMode="numeric"
              value={valor}
              onChange={(evento) => setValor(evento.target.value.replace(/[^\d]/g, ''))}
              className="w-40 rounded-xl bg-obsidian px-3 py-2 text-[14px] text-ivory outline-none focus:shadow-[inset_0_0_0_1px_#4d84e0]"
            />
            <button
              type="button"
              onClick={() => aoMudar({ valor_centavos: Number(valor || 0) * 100 })}
              className="rounded-xl bg-obsidian px-4 py-2 text-[13px] text-ivory hover:bg-[#1e2c4c]"
            >
              Salvar
            </button>
          </div>

          <label className="label-voice mt-5 block text-[9px]" htmlFor={`nota-${lead.id}`}>
            Anotações
          </label>
          <textarea
            id={`nota-${lead.id}`}
            rows={3}
            value={anotacoes}
            onChange={(evento) => setAnotacoes(evento.target.value)}
            onBlur={() => anotacoes !== lead.anotacoes && aoMudar({ anotacoes })}
            className="mt-2 w-full resize-none rounded-xl bg-obsidian px-3 py-2 text-[14px] text-ivory outline-none focus:shadow-[inset_0_0_0_1px_#4d84e0]"
          />

          {lead.conversa?.length ? (
            <>
              <p className="label-voice mt-5 text-[9px]">A conversa</p>
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

export function Painel() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [filtro, setFiltro] = useState<'' | Situacao>('')
  const [busca, setBusca] = useState('')
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
      const busca_ = busca.trim()
      const [lista, numeros] = await Promise.all([
        pedir(`/api/admin/leads?situacao=${filtro}&busca=${encodeURIComponent(busca_)}`),
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
    if (estado?.dentro) void carregar()
  }, [estado?.dentro, carregar])

  const mudar = async (id: number, campos: Partial<Lead>) => {
    try {
      const { lead } = await pedir('/api/admin/leads', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...campos }),
      })
      setLeads((atuais) => atuais.map((l) => (l.id === id ? lead : l)))
      /* Mudar situação ou valor mexe nos números; recarrega só eles. */
      pedir('/api/admin/resumo').then(setResumo).catch(() => {})
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'falhou')
    }
  }

  const avisos = useMemo(() => {
    if (!estado) return []
    const lista: string[] = []
    if (!estado.banco) lista.push('Banco não configurado: nenhum lead é guardado. Cadastre POSTGRES_URL.')
    if (!estado.whatsapp) lista.push('WhatsApp Cloud API não configurada: o robô e o aviso de lead novo não funcionam.')
    else if (!estado.avisoEquipe) lista.push('Falta EQUIPE_WHATSAPP: ninguém é avisado quando entra lead.')
    return lista
  }, [estado])

  if (!estado) return <div className="flex min-h-svh items-center justify-center text-slate">Carregando…</div>
  if (!estado.dentro) return <Entrar aoEntrar={verificar} estado={estado} />

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[1.8rem] text-ivory">Painel Astro</h1>
          <p className="mt-1 text-[13px] text-slate">Leads, funil e números da operação.</p>
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

      {resumo ? <div className="mt-8">{<Numeros resumo={resumo} />}</div> : null}

      <div className="mt-10 flex flex-wrap items-center gap-2">
        {(['', ...SITUACOES] as const).map((situacao) => (
          <button
            key={situacao || 'todos'}
            type="button"
            onClick={() => setFiltro(situacao)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] capitalize transition-colors ${
              filtro === situacao ? 'border-[#8db4f5]/50 text-ivory' : 'border-white/10 text-slate hover:text-ivory'
            }`}
          >
            {situacao || 'todos'}
          </button>
        ))}
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

      {leads.length === 0 ? (
        <p className="mt-8 text-[14px] text-slate">
          {estado.banco ? 'Nenhum lead por aqui ainda.' : 'Sem banco configurado, não há o que mostrar.'}
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {leads.map((lead) => (
            <Cartao key={lead.id} lead={lead} aoMudar={(campos) => void mudar(lead.id, campos)} />
          ))}
        </ul>
      )}
    </div>
  )
}
