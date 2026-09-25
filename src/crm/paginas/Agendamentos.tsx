import { useCallback, useEffect, useMemo, useState } from 'react'
import { enviar, pedir, quandoCompleto, telefoneBonito, type Clinica } from '../api'
import { Aviso, Botao, Pilula, Titulo, Vazio } from '../ui'
import { campoClasse, STATUS_COR } from '../estilos'

type Agendamento = {
  id: string
  tipo: string
  inicio: string
  fim: string
  status: string
  queixa_resumo: string | null
  lembrete_enviado_em: string | null
  confirmado_em: string | null
  pacientes: { nome: string; telefone: string } | { nome: string; telefone: string }[] | null
}

const STATUS = ['', 'agendado', 'confirmado', 'cancelado', 'faltou', 'concluido'] as const

export function Agendamentos({ clinica }: { clinica: Clinica }) {
  const [itens, setItens] = useState<Agendamento[] | null>(null)
  const [status, setStatus] = useState<(typeof STATUS)[number]>('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    pedir<{ itens: Agendamento[] }>('agendamentos')
      .then((r) => setItens(r.itens))
      .catch((f) => setErro(f instanceof Error ? f.message : 'falhou'))
  }, [])
  useEffect(carregar, [carregar])

  const visiveis = useMemo(() => {
    if (!itens) return []
    return itens.filter((a) => {
      if (status && a.status !== status) return false
      const dia = new Date(a.inicio).toLocaleDateString('sv-SE', { timeZone: clinica.timezone })
      if (de && dia < de) return false
      if (ate && dia > ate) return false
      return true
    })
  }, [itens, status, de, ate, clinica.timezone])

  async function agir(id: string, acao: 'cancelar' | 'faltou' | 'concluido') {
    if (acao === 'cancelar' && !window.confirm('Cancelar esta consulta? O horário é liberado no Cal.com.')) return
    try {
      await enviar(`agendamentos/${id}/${acao}`, {})
      carregar()
    } catch (f) {
      setErro(f instanceof Error ? f.message : 'falhou')
    }
  }

  const paciente = (a: Agendamento) => (Array.isArray(a.pacientes) ? a.pacientes[0] : a.pacientes)

  return (
    <div className="flex flex-col gap-5">
      <Titulo sub="Tudo o que o assistente e a recepção marcaram.">Agenda</Titulo>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[11px] text-slate">
          Situação
          <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUS)[number])} className={`${campoClasse} w-auto`}>
            {STATUS.map((s) => (
              <option key={s || 'todos'} value={s}>
                {s || 'todas'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate">
          De
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${campoClasse} w-auto`} />
        </label>
        <label className="text-[11px] text-slate">
          Até
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${campoClasse} w-auto`} />
        </label>
        <Botao tipo="fantasma" onClick={carregar}>
          Atualizar
        </Botao>
      </div>
      {itens === null ? (
        <p className="text-slate">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <Vazio>Nenhuma consulta com esses filtros.</Vazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((a) => (
            <li key={a.id} className="graphite-card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[15px] text-ivory">{quandoCompleto(a.inicio)}</p>
                <p className="text-[13px] text-ash">
                  {paciente(a)?.nome || 'paciente'} · {telefoneBonito(paciente(a)?.telefone || '')} · {a.tipo}
                </p>
                {a.queixa_resumo ? <p className="mt-1 text-[12px] text-slate">{a.queixa_resumo}</p> : null}
                <p className="mt-1 text-[11px] text-slate">
                  {a.lembrete_enviado_em ? `lembrete ${quandoCompleto(a.lembrete_enviado_em)}` : 'sem lembrete ainda'}
                  {a.confirmado_em ? ` · confirmou ${quandoCompleto(a.confirmado_em)}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pilula cor={STATUS_COR[a.status] || ''}>{a.status}</Pilula>
                {a.status === 'agendado' || a.status === 'confirmado' ? (
                  <>
                    <Botao tipo="fantasma" onClick={() => void agir(a.id, 'concluido')}>
                      Concluída
                    </Botao>
                    <Botao tipo="fantasma" onClick={() => void agir(a.id, 'faltou')}>
                      Faltou
                    </Botao>
                    <Botao tipo="perigo" onClick={() => void agir(a.id, 'cancelar')}>
                      Cancelar
                    </Botao>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
