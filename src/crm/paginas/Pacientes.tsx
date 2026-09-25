import { useState } from 'react'
import { quandoCompleto, telefoneBonito } from '../api'
import { Aviso, Botao, Titulo, Vazio } from '../ui'
import { campoClasse } from '../estilos'
import { useRecurso, type Item } from '../recurso'

type Paciente = Item & { nome: string; telefone: string; email: string | null; cpf: string; created_at: string }

export function Pacientes() {
  const [busca, setBusca] = useState('')
  const [aplicada, setAplicada] = useState('')
  const { itens, erro, setErro, editar } = useRecurso<Paciente>('pacientes', aplicada ? `?busca=${encodeURIComponent(aplicada)}` : '')

  return (
    <div className="flex flex-col gap-5">
      <Titulo sub="Quem já falou com o assistente. O CPF fica mascarado: é dado sensível.">Pacientes</Titulo>
      <form
        onSubmit={(evento) => {
          evento.preventDefault()
          setAplicada(busca.trim())
        }}
        className="flex gap-2"
      >
        <label className="sr-only" htmlFor="busca-paciente">
          Buscar
        </label>
        <input id="busca-paciente" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou telefone…" className={`${campoClasse} mt-0 max-w-sm`} />
        <Botao type="submit" tipo="fantasma">
          Buscar
        </Botao>
      </form>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {itens === null ? (
        <p className="text-slate">Carregando…</p>
      ) : itens.length === 0 ? (
        <Vazio>Nenhum paciente {aplicada ? 'com essa busca' : 'ainda'}.</Vazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {itens.map((p) => (
            <li key={p.id} className="graphite-card grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="block">
                <span className="label-voice text-[9px]">Nome</span>
                <input
                  defaultValue={p.nome}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== p.nome) editar(p.id, { nome: e.target.value.trim() }).catch((f) => setErro(String(f)))
                  }}
                  className={campoClasse}
                />
              </label>
              <label className="block">
                <span className="label-voice text-[9px]">E-mail</span>
                <input
                  defaultValue={p.email || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (p.email || '')) editar(p.id, { email: e.target.value.trim() }).catch((f) => setErro(String(f)))
                  }}
                  className={campoClasse}
                />
              </label>
              <div className="text-[12px] text-slate">
                <p>{telefoneBonito(p.telefone)}</p>
                <p>CPF {p.cpf || '—'}</p>
                <p>desde {quandoCompleto(p.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
