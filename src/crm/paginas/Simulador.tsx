import { useCallback, useEffect, useRef, useState } from 'react'
import { apagar, enviar, pedir, quando, type Clinica } from '../api'
import { Aviso, Botao, Titulo } from '../ui'
import { campoClasse } from '../estilos'

type Mensagem = { id: string; direcao: 'entrada' | 'saida'; origem: string; conteudo: string; created_at: string }
type Estado = { telefone: string; mensagens: Mensagem[]; conversa: { etapa: string; humano_ativo: boolean; motivo: string } | null; testado: boolean }

/**
 * Um WhatsApp de mentira que roda o motor de verdade: mesma máquina de
 * estados, mesmo Cal.com (os agendamentos vão marcados como [TESTE]), só o
 * canal é trocado — grava no histórico em vez de mandar pela Evolution.
 */
export function Simulador({ clinica, aoMudar, compacto = false }: { clinica: Clinica; aoMudar: () => Promise<void> | void; compacto?: boolean }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const fim = useRef<HTMLDivElement>(null)

  const carregar = useCallback(() => {
    pedir<Estado>('simulador')
      .then(setEstado)
      .catch((f) => setErro(f instanceof Error ? f.message : 'falhou'))
  }, [])
  useEffect(carregar, [carregar])
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
  }, [estado?.mensagens.length])

  async function mandar() {
    if (!texto.trim() || ocupado) return
    const conteudo = texto.trim()
    setTexto('')
    setOcupado(true)
    try {
      const novo = await enviar<Estado>('simulador', { texto: conteudo })
      const primeiraVez = !estado?.testado && novo.testado
      setEstado(novo)
      setErro('')
      if (primeiraVez) await aoMudar()
    } catch (f) {
      setTexto(conteudo)
      setErro(f instanceof Error ? f.message : 'falhou')
    } finally {
      setOcupado(false)
    }
  }

  async function reiniciar() {
    if (!window.confirm('Apagar a conversa de teste e o paciente fictício? Agendamentos de teste no Cal.com são cancelados.')) return
    try {
      await apagar('simulador')
      carregar()
    } catch (f) {
      setErro(f instanceof Error ? f.message : 'falhou')
    }
  }

  async function cancelarTestes() {
    try {
      const r = await enviar<{ cancelados: number }>('simulador/cancelar-testes', {})
      setErro('')
      window.alert(`${r.cancelados} agendamento(s) de teste cancelado(s).`)
    } catch (f) {
      setErro(f instanceof Error ? f.message : 'falhou')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!compacto ? (
        <Titulo sub="Converse como se fosse um paciente. É o mesmo motor do WhatsApp; só o envio é de mentira. Os agendamentos vão para o Cal.com de verdade, com [TESTE] no nome.">
          Simulador
        </Titulo>
      ) : null}
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {!clinica.event_type_avaliacao && !clinica.event_type_limpeza ? <Aviso>Sem procedimentos nem tipos de evento do Cal.com cadastrados, o assistente vai transferir para a recepção na hora de marcar.</Aviso> : null}
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#0b141a]">
        <div className="flex items-center gap-3 bg-[#1f2c34] px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00a884] text-[14px] text-white">🦷</div>
          <div>
            <p className="text-[14px] text-ivory">{clinica.nome}</p>
            <p className="text-[11px] text-[#8696a0]">{estado?.conversa ? `etapa: ${estado.conversa.etapa}${estado.conversa.humano_ativo ? ' · com a recepção' : ''}` : 'online'}</p>
          </div>
        </div>
        <div className="flex h-[52svh] flex-col gap-1.5 overflow-y-auto bg-[url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2740%27 height=%2740%27%3E%3Ccircle cx=%2720%27 cy=%2720%27 r=%271%27 fill=%27%23182229%27/%3E%3C/svg%3E')] px-3 py-3">
          {estado === null ? (
            <p className="text-[12px] text-[#8696a0]">Carregando…</p>
          ) : estado.mensagens.length === 0 ? (
            <p className="m-auto rounded-lg bg-[#182229] px-3 py-2 text-center text-[12px] text-[#8696a0]">Mande um "oi" para começar como um paciente novo.</p>
          ) : (
            estado.mensagens.map((m) => (
              <div key={m.id} className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[13px] leading-[1.45] whitespace-pre-wrap ${m.direcao === 'entrada' ? 'self-end bg-[#005c4b] text-[#e9edef]' : 'self-start bg-[#202c33] text-[#e9edef]'}`}>
                {m.conteudo}
                <span className="mt-0.5 block text-right text-[10px] text-[#8696a0]">{quando(m.created_at).split(', ')[1] || ''}</span>
              </div>
            ))
          )}
          <div ref={fim} />
        </div>
        <form
          onSubmit={(evento) => {
            evento.preventDefault()
            void mandar()
          }}
          className="flex gap-2 bg-[#1f2c34] px-3 py-2"
        >
          <label className="sr-only" htmlFor="sim-texto">
            Mensagem
          </label>
          <input id="sim-texto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Mensagem" disabled={ocupado} className={`${campoClasse} mt-0 rounded-full bg-[#2a3942]`} />
          <button type="submit" disabled={ocupado || !texto.trim()} className="rounded-full bg-[#00a884] px-4 text-[13px] text-white disabled:opacity-50">
            {ocupado ? '…' : 'Enviar'}
          </button>
        </form>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Botao tipo="fantasma" onClick={() => void reiniciar()}>
          Reiniciar conversa
        </Botao>
        <Botao tipo="perigo" onClick={() => void cancelarTestes()}>
          Cancelar todos os agendamentos de teste
        </Botao>
      </div>
    </div>
  )
}
