import { useCallback, useEffect, useState } from 'react'

/**
 * A aba de prospecção do painel: o número pessoal conectado por QR code, a
 * instrução mestre e as conversas do aparelho, para escolher quais o robô
 * assume. O que acontece do outro lado está em api/_lib/prospeccao.js e em
 * docs/prospeccao-whatsapp.md.
 */
type Conversa = {
  jid: string
  telefone: string
  nome: string
  ultima: { de: string; texto: string } | null
  quando: string | null
  lead: { id: number; prospeccao: string; situacao: string } | null
}

type Dados = {
  estado: {
    configurado: boolean
    estado: 'conectado' | 'aguardando_qr' | 'desconectado'
    numero: string | null
    instancia: string
  }
  instrucao: string
  instrucaoPadrao: string
  conversas: Conversa[]
  ponte: { url: string; instancia: string; quando: string } | null
  inteligencia: boolean
  banco: boolean
}

type Resultado = { jid: string; lead?: number; enviado?: boolean; erro?: string }

async function pedir(caminho: string, opcoes: RequestInit = {}) {
  /* Vinte e cinco segundos e desiste, com aviso: um banco travado deixava o
     painel em "Atualizando…" para sempre, sem dizer nada. */
  const resposta = await fetch(caminho, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
    signal: AbortSignal.timeout(25000),
  }).catch((falha) => {
    throw new Error(falha?.name === 'TimeoutError' ? 'o servidor não respondeu em 25 s (banco travado?)' : 'sem conexão com o servidor')
  })
  const corpo = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(corpo?.erro || `falha ${resposta.status}`)
  return corpo
}

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

const mensagemDe = (falha: unknown) => (falha instanceof Error ? falha.message : 'falhou')

export function AbaProspeccao() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [escolhidas, setEscolhidas] = useState<Set<string>>(() => new Set())
  const [instrucao, setInstrucao] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [resultados, setResultados] = useState<Resultado[]>([])

  const carregar = useCallback(async () => {
    try {
      const r: Dados = await pedir('/api/admin/prospeccao')
      setDados(r)
      setInstrucao((atual) => atual || r.instrucao)
    } catch (falha) {
      setAviso(mensagemDe(falha))
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /* Com o QR na tela, pergunta a cada três segundos se o celular já leu. */
  useEffect(() => {
    if (!qr) return
    const id = window.setInterval(async () => {
      try {
        const r: Dados = await pedir('/api/admin/prospeccao')
        if (r.estado.estado === 'conectado') {
          setQr(null)
          setDados(r)
        }
      } catch {
        /* Tenta de novo no próximo tique. */
      }
    }, 3000)
    return () => window.clearInterval(id)
  }, [qr])

  async function conectar() {
    setOcupado(true)
    setAviso('')
    try {
      const r = await pedir('/api/admin/prospeccao?qr=1')
      if (r.qr) setQr(r.qr)
      else await carregar()
    } catch (falha) {
      setAviso(mensagemDe(falha))
    } finally {
      setOcupado(false)
    }
  }

  async function desconectar() {
    setOcupado(true)
    try {
      await pedir('/api/admin/prospeccao?desconectar=1')
      setQr(null)
      await carregar()
    } catch (falha) {
      setAviso(mensagemDe(falha))
    } finally {
      setOcupado(false)
    }
  }

  async function assumir() {
    const jids = [...escolhidas]
    if (jids.length === 0) return
    setOcupado(true)
    setAviso('')
    try {
      const r = await pedir('/api/admin/prospeccao', { method: 'POST', body: JSON.stringify({ jids }) })
      setResultados(r.resultados)
      setEscolhidas(new Set())
      await carregar()
    } catch (falha) {
      setAviso(mensagemDe(falha))
    } finally {
      setOcupado(false)
    }
  }

  async function mudar(lead: number, prospeccao: string) {
    try {
      await pedir('/api/admin/prospeccao', { method: 'PATCH', body: JSON.stringify({ lead, prospeccao }) })
      await carregar()
    } catch (falha) {
      setAviso(mensagemDe(falha))
    }
  }

  async function salvarInstrucao(texto: string) {
    try {
      const r = await pedir('/api/admin/prospeccao', { method: 'PUT', body: JSON.stringify({ instrucao: texto }) })
      setInstrucao(r.instrucao)
      setAviso('Instrução salva.')
    } catch (falha) {
      setAviso(mensagemDe(falha))
    }
  }

  if (!dados) return <p className="text-[14px] text-slate">{aviso || 'Carregando…'}</p>

  const conectado = dados.estado.estado === 'conectado'
  const nomeDe = (conversa: Conversa) => conversa.nome || conversa.telefone
  const alternar = (jid: string) =>
    setEscolhidas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(jid)) proximo.delete(jid)
      else proximo.add(jid)
      return proximo
    })

  return (
    <div className="flex flex-col gap-4">
      {!dados.estado.configurado ? (
        <p className="rounded-xl border border-[#ffd479]/30 bg-[#ffd479]/5 px-4 py-3 text-[13px] text-[#ffd479]">
          A ponte ainda não avisou onde está. No seu PC: entre em ponte-whatsapp, rode npm install, copie
          .env.exemplo para .env com a mesma chave cadastrada na Vercel como EVOLUTION_API_KEY, e rode npm start.
          Ela abre o túnel e se registra aqui sozinha (docs/prospeccao-whatsapp.md).
        </p>
      ) : null}
      {!dados.inteligencia || !dados.banco ? (
        <p className="rounded-xl border border-[#ffd479]/30 bg-[#ffd479]/5 px-4 py-3 text-[13px] text-[#ffd479]">
          {!dados.banco ? 'Sem banco (POSTGRES_URL) não há onde guardar as conversas assumidas. ' : ''}
          {!dados.inteligencia ? 'Sem ANTHROPIC_API_KEY ou OPENAI_API_KEY o robô não tem com que escrever.' : ''}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="graphite-card">
          <p className="label-voice text-[10px]">Número pessoal</p>
          <p className={`mt-2 flex items-center gap-2 text-[15px] ${conectado ? 'text-[#86e8a8]' : 'text-[#ffd479]'}`}>
            <span aria-hidden="true">{conectado ? '●' : '○'}</span>
            {conectado ? `Conectado${dados.estado.numero ? ` · ${dados.estado.numero}` : ''}` : qr ? 'Aguardando o QR code' : 'Desconectado'}
          </p>
          <p className="mt-1 text-[12px] text-slate">
            instância {dados.estado.instancia}
            {dados.ponte
              ? ` · ponte em ${dados.ponte.url.replace('https://', '').replace('http://', '')} · registrada ${quando(dados.ponte.quando)}`
              : ''}
          </p>
          {qr ? (
            <div className="mt-4">
              <img src={`data:image/png;base64,${qr}`} alt="QR code para conectar o WhatsApp" className="h-56 w-56 rounded-lg bg-white p-2" />
              <p className="mt-2 max-w-sm text-[12px] leading-[1.5] text-slate">
                No celular: WhatsApp → Aparelhos conectados → Conectar aparelho. O painel confere sozinho.
              </p>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {conectado ? (
              <button type="button" disabled={ocupado} onClick={() => void desconectar()} className="rounded-full border border-white/12 px-4 py-2 text-[13px] text-ash hover:text-ivory disabled:opacity-50">
                Desconectar
              </button>
            ) : (
              <button type="button" disabled={ocupado || !dados.estado.configurado} onClick={() => void conectar()} className="rounded-full bg-cobalt px-4 py-2 text-[13px] text-white disabled:opacity-50">
                {qr ? 'Gerar outro QR' : 'Conectar número'}
              </button>
            )}
            <button type="button" disabled={ocupado} onClick={() => void carregar()} className="rounded-full border border-white/12 px-4 py-2 text-[13px] text-ash hover:text-ivory disabled:opacity-50">
              Atualizar
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-[1.5] text-slate">
            Conversa que você não marcar nunca recebe resposta do robô. E se você escrever pelo celular numa
            conversa assumida, o robô para e o lead fica pausado até você devolver.
          </p>
        </div>

        <div className="graphite-card">
          <p className="label-voice text-[10px]">Instrução mestre da prospecção</p>
          <textarea
            value={instrucao}
            onChange={(evento) => setInstrucao(evento.target.value)}
            rows={9}
            className="mt-2 w-full rounded-lg border border-white/10 bg-onyx/60 p-3 text-[13px] leading-[1.5] text-ash outline-none focus:border-[#8db4f5]/50"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!dados.banco} onClick={() => void salvarInstrucao(instrucao)} className="rounded-full bg-cobalt px-4 py-2 text-[13px] text-white disabled:opacity-50">
              Salvar instrução
            </button>
            <button type="button" onClick={() => setInstrucao(dados.instrucaoPadrao)} className="rounded-full border border-white/12 px-4 py-2 text-[13px] text-ash hover:text-ivory">
              Voltar ao padrão
            </button>
          </div>
        </div>
      </div>

      {aviso ? <p className="text-[13px] text-[#ffd479]">{aviso}</p> : null}

      <div className="graphite-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="label-voice text-[10px]">Conversas do aparelho {conectado ? `(${dados.conversas.length})` : ''}</p>
          <button
            type="button"
            disabled={ocupado || escolhidas.size === 0 || !dados.inteligencia || !dados.banco}
            onClick={() => void assumir()}
            className="rounded-full bg-cobalt px-4 py-2 text-[13px] text-white disabled:opacity-50"
          >
            {ocupado ? 'Escrevendo…' : `O robô assume ${escolhidas.size ? `${escolhidas.size} conversa${escolhidas.size > 1 ? 's' : ''}` : ''}`}
          </button>
        </div>
        {!conectado ? (
          <p className="mt-3 text-[13px] text-slate">Conecte o número para ver as conversas.</p>
        ) : dados.conversas.length === 0 ? (
          <p className="mt-3 text-[13px] text-slate">Nenhuma conversa individual no aparelho.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/8">
            {dados.conversas.map((conversa) => {
              const modo = conversa.lead?.prospeccao || ''
              return (
                <li key={conversa.jid} className="flex items-start gap-3 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Escolher ${nomeDe(conversa)}`}
                    checked={escolhidas.has(conversa.jid)}
                    disabled={modo === 'bot'}
                    onChange={() => alternar(conversa.jid)}
                    className="mt-1 h-4 w-4 accent-[#4d84e0]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[14px] text-ivory">
                      {nomeDe(conversa)}
                      {conversa.nome ? <span className="text-[12px] text-slate">{conversa.telefone}</span> : null}
                      {modo === 'bot' ? (
                        <span className="rounded-full bg-[#86e8a8]/15 px-2 py-0.5 text-[11px] text-[#86e8a8]">robô prospectando</span>
                      ) : modo === 'pausado' ? (
                        <span className="rounded-full bg-[#ffd479]/15 px-2 py-0.5 text-[11px] text-[#ffd479]">pausado, sua mão</span>
                      ) : conversa.lead ? (
                        <span className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-slate">lead · {conversa.lead.situacao}</span>
                      ) : null}
                    </p>
                    {conversa.ultima ? (
                      <p className="mt-0.5 truncate text-[12px] text-slate">
                        {conversa.ultima.de === 'robo' ? 'você: ' : ''}
                        {conversa.ultima.texto}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-slate">{quando(conversa.quando)}</p>
                  </div>
                  {conversa.lead && modo ? (
                    <button
                      type="button"
                      onClick={() => void mudar(conversa.lead!.id, modo === 'bot' ? 'pausado' : 'bot')}
                      className="rounded-full border border-white/12 px-3 py-1 text-[12px] text-ash hover:text-ivory"
                    >
                      {modo === 'bot' ? 'Pausar' : 'Devolver ao robô'}
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
        {resultados.length ? (
          <ul className="mt-4 space-y-1 text-[12px]">
            {resultados.map((r) => (
              <li key={r.jid} className={r.erro ? 'text-[#ff9b9b]' : 'text-[#86e8a8]'}>
                {r.jid.split('@')[0]}: {r.erro ? r.erro : 'abordagem enviada'}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
