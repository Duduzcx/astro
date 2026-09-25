import type { ReactNode } from 'react'
import { useRecurso, type Item } from '../recurso'
import { Aviso, Botao, Vazio } from '../ui'

/**
 * Lista + formulário genéricos para as tabelas pequenas (dentistas,
 * procedimentos, base de conhecimento). Quem usa passa como desenhar uma
 * linha e o formulário; o resto — carregar, criar, editar, apagar — é igual.
 */
export function ListaRecurso<T extends Item>({
  tabela,
  titulo,
  vazio,
  linha,
  formulario,
  filtro,
}: {
  tabela: string
  titulo: ReactNode
  vazio: string
  linha: (item: T, acoes: { editar: (dados: Partial<T>) => Promise<void>; remover: () => Promise<void> }) => ReactNode
  formulario: (criar: (dados: Partial<T>) => Promise<void>) => ReactNode
  filtro?: string
}) {
  const { itens, erro, setErro, criar, editar, remover } = useRecurso<T>(tabela, filtro)
  const guardar = async (fn: () => Promise<void>) => {
    try {
      await fn()
      setErro('')
    } catch (f) {
      setErro(f instanceof Error ? f.message : 'falhou')
    }
  }
  return (
    <section className="flex flex-col gap-4">
      <div className="graphite-card">
        <h3 className="text-[1.1rem] text-ivory">{titulo}</h3>
        <div className="mt-4">{formulario((dados) => guardar(() => criar(dados)))}</div>
      </div>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {itens === null ? (
        <p className="text-slate">Carregando…</p>
      ) : itens.length === 0 ? (
        <Vazio>{vazio}</Vazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {itens.map((item) => (
            <li key={item.id} className="graphite-card">
              {linha(item, {
                editar: (dados) => guardar(() => editar(item.id, dados)),
                remover: () => guardar(() => remover(item.id)),
              })}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function BotaoRemover({ aoConfirmar }: { aoConfirmar: () => void }) {
  return (
    <Botao tipo="perigo" onClick={() => window.confirm('Apagar?') && aoConfirmar()}>
      Apagar
    </Botao>
  )
}
