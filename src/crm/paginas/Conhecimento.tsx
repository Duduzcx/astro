import { useState } from 'react'
import { enviar, quandoCompleto, telefoneBonito } from '../api'
import { Aviso, Botao, Campo, Titulo, Vazio } from '../ui'
import { campoClasse } from '../estilos'
import { useRecurso, type Item } from '../recurso'
import { BotaoRemover, ListaRecurso } from './Recursos'

type Entrada = Item & { pergunta: string; resposta: string; ativo: boolean }
type Pendente = Item & { telefone: string | null; pergunta: string; resolvida: boolean; created_at: string }

export function BaseDeConhecimento() {
  const [pergunta, setPergunta] = useState('')
  const [resposta, setResposta] = useState('')
  return (
    <ListaRecurso<Entrada>
      tabela="base_conhecimento"
      titulo="Perguntas e respostas aprovadas"
      vazio="A base está vazia. O assistente só responde perguntas livres com o que estiver aqui."
      formulario={(criar) => (
        <form
          onSubmit={(evento) => {
            evento.preventDefault()
            if (!pergunta.trim() || !resposta.trim()) return
            void criar({ pergunta: pergunta.trim(), resposta: resposta.trim(), ativo: true }).then(() => {
              setPergunta('')
              setResposta('')
            })
          }}
          className="grid gap-3"
        >
          <Campo rotulo="Pergunta (como o paciente pergunta)">
            <input value={pergunta} onChange={(e) => setPergunta(e.target.value)} className={campoClasse} placeholder="Vocês aceitam convênio?" />
          </Campo>
          <Campo rotulo="Resposta (o que o assistente pode dizer)">
            <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={3} className={`${campoClasse} resize-y`} placeholder="Aceitamos Odontoprev e Amil. Traga a carteirinha na primeira consulta." />
          </Campo>
          <div>
            <Botao type="submit">Adicionar</Botao>
          </div>
        </form>
      )}
      linha={(item, { editar, remover }) => (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-ivory">{item.pergunta}</p>
            <p className="mt-1 text-[13px] leading-[1.5] text-ash whitespace-pre-wrap">{item.resposta}</p>
          </div>
          <div className="flex items-center gap-2">
            <Botao tipo="fantasma" onClick={() => void editar({ ativo: !item.ativo })}>
              {item.ativo ? 'Desativar' : 'Ativar'}
            </Botao>
            <BotaoRemover aoConfirmar={() => void remover()} />
          </div>
        </div>
      )}
    />
  )
}

function SemResposta() {
  const { itens, erro, setErro, editar, carregar } = useRecurso<Pendente>('perguntas_sem_resposta', '?pendentes=1')
  const [respondendo, setRespondendo] = useState<string | null>(null)
  const [resposta, setResposta] = useState('')

  async function promover(item: Pendente) {
    if (!resposta.trim()) return
    try {
      await enviar('recursos/base_conhecimento', { pergunta: item.pergunta, resposta: resposta.trim(), ativo: true })
      await editar(item.id, { resolvida: true })
      setRespondendo(null)
      setResposta('')
      carregar()
    } catch (f) {
      setErro(f instanceof Error ? f.message : 'falhou')
    }
  }

  return (
    <section className="flex flex-col gap-3">
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {itens === null ? (
        <p className="text-slate">Carregando…</p>
      ) : itens.length === 0 ? (
        <Vazio>Nenhuma pergunta pendente. Quando o assistente não souber responder, ela cai aqui.</Vazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {itens.map((p) => (
            <li key={p.id} className="graphite-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] text-ivory">{p.pergunta}</p>
                  <p className="mt-1 text-[12px] text-slate">
                    {p.telefone ? telefoneBonito(p.telefone) : 'sem telefone'} · {quandoCompleto(p.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Botao tipo="fantasma" onClick={() => setRespondendo(respondendo === p.id ? null : p.id)}>
                    Responder e guardar na base
                  </Botao>
                  <Botao tipo="fantasma" onClick={() => void editar(p.id, { resolvida: true })}>
                    Dispensar
                  </Botao>
                </div>
              </div>
              {respondendo === p.id ? (
                <form
                  onSubmit={(evento) => {
                    evento.preventDefault()
                    void promover(p)
                  }}
                  className="mt-3 grid gap-3"
                >
                  <Campo rotulo="Resposta que o assistente passará a dar">
                    <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={3} className={`${campoClasse} resize-y`} />
                  </Campo>
                  <div>
                    <Botao type="submit">Guardar na base</Botao>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function Conhecimento() {
  const [aba, setAba] = useState<'base' | 'pendentes'>('base')
  return (
    <div className="flex flex-col gap-5">
      <Titulo sub="O que o assistente pode dizer além do roteiro. Ele nunca inventa: só responde com o que está aqui.">Base de conhecimento</Titulo>
      <nav className="flex gap-2">
        {(
          [
            ['base', 'Perguntas e respostas'],
            ['pendentes', 'Perguntas sem resposta'],
          ] as const
        ).map(([chave, rotulo]) => (
          <button key={chave} type="button" onClick={() => setAba(chave)} className={`rounded-full border px-4 py-2 text-[13px] transition-colors ${aba === chave ? 'border-[#8db4f5]/50 text-ivory' : 'border-white/10 text-slate hover:text-ivory'}`}>
            {rotulo}
          </button>
        ))}
      </nav>
      {aba === 'base' ? <BaseDeConhecimento /> : <SemResposta />}
    </div>
  )
}
