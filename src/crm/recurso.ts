import { useCallback, useEffect, useState } from 'react'
import { apagar, enviar, pedir } from './api'

/** Carrega, cria, edita e apaga numa tabela pequena do CRM (dentistas, procedimentos…). */
export type Item = Record<string, unknown> & { id: string }

export function useRecurso<T extends Item>(tabela: string, filtro = '') {
  const [itens, setItens] = useState<T[] | null>(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(() => {
    pedir<{ itens: T[] }>(`recursos/${tabela}${filtro}`)
      .then((r) => setItens(r.itens))
      .catch((f) => setErro(f instanceof Error ? f.message : 'falhou'))
  }, [tabela, filtro])
  useEffect(carregar, [carregar])
  const criar = async (dados: Partial<T>) => {
    await enviar(`recursos/${tabela}`, dados)
    carregar()
  }
  const editar = async (id: string, dados: Partial<T>) => {
    await enviar(`recursos/${tabela}/${id}`, dados, 'PUT')
    carregar()
  }
  const remover = async (id: string) => {
    await apagar(`recursos/${tabela}/${id}`)
    carregar()
  }
  return { itens, erro, setErro, carregar, criar, editar, remover }
}

