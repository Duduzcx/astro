import { quandoCompleto, telefoneBonito } from '../api'
import { Aviso, Botao, Pilula, Titulo, Vazio } from '../ui'
import { useRecurso, type Item } from '../recurso'

type Espera = Item & {
  tipo: string
  observacao: string | null
  atendido: boolean
  created_at: string
  pacientes: { nome: string; telefone: string } | { nome: string; telefone: string }[] | null
}

export function ListaEspera() {
  const { itens, erro, setErro, editar } = useRecurso<Espera>('lista_espera')
  const paciente = (e: Espera) => (Array.isArray(e.pacientes) ? e.pacientes[0] : e.pacientes)
  return (
    <div className="flex flex-col gap-5">
      <Titulo sub="Quem quis marcar e não tinha vaga nos 14 dias seguintes. Abriu horário, avise e marque como atendido.">Lista de espera</Titulo>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {itens === null ? (
        <p className="text-slate">Carregando…</p>
      ) : itens.length === 0 ? (
        <Vazio>Ninguém esperando.</Vazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {itens.map((e) => (
            <li key={e.id} className={`graphite-card flex flex-wrap items-center justify-between gap-3 ${e.atendido ? 'opacity-60' : ''}`}>
              <div>
                <p className="text-[15px] text-ivory">{paciente(e)?.nome || 'paciente'}</p>
                <p className="text-[13px] text-ash">
                  {telefoneBonito(paciente(e)?.telefone || '')} · {e.tipo} · desde {quandoCompleto(e.created_at)}
                </p>
                {e.observacao ? <p className="mt-1 text-[12px] text-slate">{e.observacao}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                {e.atendido ? <Pilula cor="text-[#86e8a8] border-[#86e8a8]/35">atendido</Pilula> : null}
                <Botao tipo="fantasma" onClick={() => editar(e.id, { atendido: !e.atendido }).catch((f) => setErro(String(f)))}>
                  {e.atendido ? 'Reabrir' : 'Marcar atendido'}
                </Botao>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
