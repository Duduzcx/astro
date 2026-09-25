import { useCallback, useEffect, useRef, useState } from 'react'
import { enviar, pedir, quando, telefoneBonito, type Clinica } from '../api'
import { supabase } from '../supabase'
import { Aviso, Botao, Pilula, Vazio } from '../ui'
import { campoClasse } from '../estilos'

type Resumo = {
  telefone: string
  nome: string | null
  etapa: string
  humano_ativo: boolean
  motivo: string
  sinalizada: boolean
  ultima_mensagem_em: string | null
  ultima: { conteudo: string; direcao: string; origem: string; created_at: string } | null
}

type Mensagem = { id: string; direcao: 'entrada' | 'saida'; origem: 'bot' | 'humano' | 'paciente'; conteudo: string; created_at: string }

type Detalhe = {
  conversa: { etapa: string; humano_ativo: boolean; motivo: string; detalhe: string; sinalizada: boolean } | null
  paciente: { nome: string; telefone: string; email: string | null; cpf: string } | null
  mensagens: Mensagem[]
}

const ETIQUETA: Record<string, [string, string]> = {
  urgencia: ['urgência', 'text-[#ff9b9b] border-[#ff9b9b]/40'],
  recepcao: ['pediu recepção', 'text-[#c9a6ff] border-[#c9a6ff]/35'],
  limite: ['sem vaga', 'text-[#ffd479] border-[#ffd479]/35'],
}

/** Assina as mudanças de mensagens e conversas da clínica (RLS filtra). */
function useTempoReal(clinicaId: string, aoMudar: () => void) {
  useEffect(() => {
    const canal = supabase
      .channel(`crm-${clinicaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens', filter: `clinica_id=eq.${clinicaId}` }, aoMudar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas', filter: `clinica_id=eq.${clinicaId}` }, aoMudar)
      .subscribe()
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [clinicaId, aoMudar])
}

export function Conversas({ clinica }: { clinica: Clinica }) {
  const [lista, setLista] = useState<Resumo[] | null>(null)
  const [aberta, setAberta] = useState<string | null>(() => new URLSearchParams(window.location.search).get('tel'))
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const fim = useRef<HTMLDivElement>(null)

  const carregarLista = useCallback(() => {
    pedir<{ conversas: Resumo[] }>('conversas')
      .then((r) => setLista(r.conversas))
      .catch((f) => setErro(f instanceof Error ? f.message : 'falhou'))
  }, [])

  const carregarDetalhe = useCallback(() => {
    if (!aberta) return
    pedir<Detalhe>(`conversas/${encodeURIComponent(aberta)}`)
      .then(setDetalhe)
      .catch((f) => setErro(f instanceof Error ? f.message : 'falhou'))
  }, [aberta])

  const atualizar = useCallback(() => {
    carregarLista()
    carregarDetalhe()
  }, [carregarLista, carregarDetalhe])

  useEffect(carregarLista, [carregarLista])
  useEffect(carregarDetalhe, [carregarDetalhe])
  useTempoReal(clinica.id, atualizar)

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
  }, [detalhe?.mensagens.length])

  async function agir(acao: 'assumir' | 'devolver') {
    if (!aberta) return
    try {
      await enviar(`conversas/${encodeURIComponent(aberta)}/${acao}`, {})
      atualizar()
    } catch (f) {
      setErro(f instanceof Error ? f.message : 'falhou')
    }
  }

  async function mandar() {
    if (!aberta || !texto.trim()) return
    const conteudo = texto
    setTexto('')
    try {
      await enviar(`conversas/${encodeURIComponent(aberta)}/enviar`, { texto: conteudo })
      atualizar()
    } catch (f) {
      setTexto(conteudo)
      setErro(f instanceof Error ? f.message : 'falhou')
    }
  }

  const humano = detalhe?.conversa?.humano_ativo

  return (
    <div className="flex flex-col gap-4">
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <section className={`graphite-card max-h-[75svh] overflow-y-auto ${aberta ? 'hidden lg:block' : ''}`}>
          <h2 className="text-[1.1rem] text-ivory">Conversas</h2>
          {lista === null ? (
            <p className="mt-3 text-[13px] text-slate">Carregando…</p>
          ) : lista.length === 0 ? (
            <div className="mt-3">
              <Vazio>Nenhuma conversa ainda. Quando alguém escrever no WhatsApp da clínica, aparece aqui.</Vazio>
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {lista.map((c) => (
                <li key={c.telefone}>
                  <button
                    type="button"
                    onClick={() => setAberta(c.telefone)}
                    className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${aberta === c.telefone ? 'bg-obsidian' : 'hover:bg-obsidian/60'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[14px] text-ivory">{c.nome || telefoneBonito(c.telefone)}</span>
                      <span className="shrink-0 text-[11px] text-slate">{quando(c.ultima_mensagem_em)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {c.humano_ativo ? <Pilula cor={(ETIQUETA[c.motivo] || ['recepção', 'text-[#c9a6ff] border-[#c9a6ff]/35'])[1]}>{(ETIQUETA[c.motivo] || ['recepção'])[0]}</Pilula> : null}
                      {c.sinalizada ? <Pilula cor="text-[#ffd479] border-[#ffd479]/35">pergunta aberta</Pilula> : null}
                      <span className="truncate text-[12px] text-slate">{c.ultima?.conteudo || c.etapa}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`graphite-card flex min-h-[60svh] flex-col ${aberta ? '' : 'hidden lg:flex'}`}>
          {!aberta ? (
            <div className="m-auto text-[13px] text-slate">Escolha uma conversa ao lado.</div>
          ) : (
            <>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-3">
                <div>
                  <button type="button" className="mr-2 text-[12px] text-slate lg:hidden" onClick={() => setAberta(null)}>
                    ← voltar
                  </button>
                  <span className="text-[15px] text-ivory">{detalhe?.paciente?.nome || telefoneBonito(aberta)}</span>
                  <p className="text-[12px] text-slate">
                    {telefoneBonito(aberta)}
                    {detalhe?.paciente?.cpf ? ` · CPF ${detalhe.paciente.cpf}` : ''} · etapa: {detalhe?.conversa?.etapa || 'início'}
                  </p>
                  {detalhe?.conversa?.detalhe ? <p className="text-[12px] text-[#ffd479]">{detalhe.conversa.detalhe}</p> : null}
                </div>
                <div className="flex gap-2">
                  {humano ? (
                    <Botao tipo="fantasma" onClick={() => void agir('devolver')}>
                      Devolver ao bot
                    </Botao>
                  ) : (
                    <Botao onClick={() => void agir('assumir')}>Assumir conversa</Botao>
                  )}
                </div>
              </header>
              <div className="flex-1 overflow-y-auto py-3">
                {detalhe === null ? (
                  <p className="text-[13px] text-slate">Carregando…</p>
                ) : detalhe.mensagens.length === 0 ? (
                  <Vazio>Sem mensagens.</Vazio>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {detalhe.mensagens.map((m) => (
                      <li key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-[1.5] whitespace-pre-wrap ${m.direcao === 'entrada' ? 'self-start bg-obsidian text-ivory' : m.origem === 'humano' ? 'self-end bg-cobalt/80 text-white' : 'self-end bg-[#1f3b5a] text-ivory'}`}>
                        <span className="mb-1 block text-[10px] uppercase opacity-60">
                          {m.direcao === 'entrada' ? 'paciente' : m.origem === 'humano' ? 'recepção' : 'bot'} · {quando(m.created_at)}
                        </span>
                        {m.conteudo}
                      </li>
                    ))}
                  </ul>
                )}
                <div ref={fim} />
              </div>
              <form
                onSubmit={(evento) => {
                  evento.preventDefault()
                  void mandar()
                }}
                className="flex gap-2 border-t border-white/8 pt-3"
              >
                <label className="sr-only" htmlFor="resposta">
                  Mensagem
                </label>
                <input id="resposta" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={humano ? 'Responder como recepção…' : 'Assuma a conversa para responder'} disabled={!humano} className={`${campoClasse} mt-0`} />
                <Botao type="submit" disabled={!humano || !texto.trim()}>
                  Enviar
                </Botao>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
