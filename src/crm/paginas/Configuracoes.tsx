import { useMemo, useState, type ChangeEvent } from 'react'
import { CHAVES_TEXTO, ROTULOS_TEXTO, TEXTOS_PADRAO, texto } from '../../../lib/bot/textos.ts'
import { enviar, type Clinica, type Eu } from '../api'
import { Aviso, Botao, Campo, Titulo } from '../ui'
import { campoClasse } from '../estilos'
import type { Item } from '../recurso'
import { BotaoRemover, ListaRecurso } from './Recursos'
import { ConexaoWhatsapp } from './Whatsapp'

type Dentista = Item & { nome: string; especialidade: string | null; ativo: boolean }
type Procedimento = Item & { nome: string; duracao_min: number; cal_event_type_id: number; descricao: string | null; ativo: boolean; ordem: number }

const DIAS: [string, string][] = [
  ['seg', 'Segunda'],
  ['ter', 'Terça'],
  ['qua', 'Quarta'],
  ['qui', 'Quinta'],
  ['sex', 'Sexta'],
  ['sab', 'Sábado'],
  ['dom', 'Domingo'],
]

export function FormClinica({ clinica, aoSalvar, criando = false }: { clinica: Partial<Clinica> | null; aoSalvar: () => Promise<void> | void; criando?: boolean }) {
  const [dados, setDados] = useState({
    nome: clinica?.nome || '',
    dentista_nome: clinica?.dentista_nome || '',
    endereco: clinica?.endereco || '',
    link_maps: clinica?.link_maps || '',
    recomendacoes: clinica?.recomendacoes || '',
    telefone_recepcao: clinica?.telefone_recepcao || '',
    timezone: clinica?.timezone || 'America/Sao_Paulo',
    event_type_avaliacao: clinica?.event_type_avaliacao ? String(clinica.event_type_avaliacao) : '',
    event_type_limpeza: clinica?.event_type_limpeza ? String(clinica.event_type_limpeza) : '',
    valor_avaliacao: clinica?.valor_avaliacao !== null && clinica?.valor_avaliacao !== undefined ? String(clinica.valor_avaliacao) : '',
  })
  const [aviso, setAviso] = useState<{ tom: 'erro' | 'ok'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const mudar = (chave: keyof typeof dados) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDados({ ...dados, [chave]: e.target.value })

  async function salvar() {
    setOcupado(true)
    setAviso(null)
    try {
      await enviar('clinica', dados, criando ? 'POST' : 'PUT')
      setAviso({ tom: 'ok', texto: 'Salvo.' })
      await aoSalvar()
    } catch (f) {
      setAviso({ tom: 'erro', texto: f instanceof Error ? f.message : 'falhou' })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault()
        void salvar()
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Campo rotulo="Nome da clínica">
        <input required value={dados.nome} onChange={mudar('nome')} className={campoClasse} />
      </Campo>
      <Campo rotulo="Dentista principal (aparece nas mensagens)">
        <input value={dados.dentista_nome} onChange={mudar('dentista_nome')} className={campoClasse} placeholder="Dra. Ana Lima" />
      </Campo>
      <Campo rotulo="Endereço">
        <input value={dados.endereco} onChange={mudar('endereco')} className={campoClasse} />
      </Campo>
      <Campo rotulo="Link do Google Maps">
        <input value={dados.link_maps} onChange={mudar('link_maps')} className={campoClasse} placeholder="https://maps.app.goo.gl/…" />
      </Campo>
      <Campo rotulo="Telefone da recepção">
        <input value={dados.telefone_recepcao} onChange={mudar('telefone_recepcao')} className={campoClasse} placeholder="(11) 4000-0000" />
      </Campo>
      <Campo rotulo="Fuso horário">
        <input value={dados.timezone} onChange={mudar('timezone')} className={campoClasse} />
      </Campo>
      <Campo rotulo="ID do evento Cal.com — avaliação" dica="Em Cal.com → Event Types, o número no fim da URL do evento. Se cadastrar procedimentos, eles têm prioridade.">
        <input inputMode="numeric" value={dados.event_type_avaliacao} onChange={mudar('event_type_avaliacao')} className={campoClasse} />
      </Campo>
      <Campo rotulo="ID do evento Cal.com — limpeza">
        <input inputMode="numeric" value={dados.event_type_limpeza} onChange={mudar('event_type_limpeza')} className={campoClasse} />
      </Campo>
      <Campo rotulo="Valor da avaliação (R$)" dica="O único preço que o assistente pode informar. Em branco, ele não fala de valores.">
        <input inputMode="decimal" value={dados.valor_avaliacao} onChange={mudar('valor_avaliacao')} className={campoClasse} />
      </Campo>
      <div className="sm:col-span-2">
        <Campo rotulo="Recomendações antes da consulta (vão na confirmação)">
          <textarea rows={3} value={dados.recomendacoes} onChange={mudar('recomendacoes')} className={`${campoClasse} resize-y`} placeholder="Chegue 10 minutos antes. Traga documento com foto e a carteirinha do convênio." />
        </Campo>
      </div>
      {aviso ? (
        <div className="sm:col-span-2">
          <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <Botao type="submit" disabled={ocupado}>
          {ocupado ? 'Salvando…' : criando ? 'Criar clínica' : 'Salvar'}
        </Botao>
      </div>
    </form>
  )
}

export function Dentistas() {
  const [nome, setNome] = useState('')
  const [especialidade, setEspecialidade] = useState('')
  return (
    <ListaRecurso<Dentista>
      tabela="dentistas"
      titulo="Dentistas"
      vazio="Nenhum dentista cadastrado."
      formulario={(criar) => (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!nome.trim()) return
            void criar({ nome: nome.trim(), especialidade: especialidade.trim() || null, ativo: true }).then(() => {
              setNome('')
              setEspecialidade('')
            })
          }}
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <Campo rotulo="Nome">
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={campoClasse} />
          </Campo>
          <Campo rotulo="Especialidade">
            <input value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} className={campoClasse} placeholder="Clínico geral" />
          </Campo>
          <Botao type="submit">Adicionar</Botao>
        </form>
      )}
      linha={(d, { editar, remover }) => (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[14px] text-ivory">{d.nome}</p>
            <p className="text-[12px] text-slate">{d.especialidade || '—'}</p>
          </div>
          <div className="flex gap-2">
            <Botao tipo="fantasma" onClick={() => void editar({ ativo: !d.ativo })}>
              {d.ativo ? 'Desativar' : 'Ativar'}
            </Botao>
            <BotaoRemover aoConfirmar={() => void remover()} />
          </div>
        </div>
      )}
    />
  )
}

export function Procedimentos() {
  const [form, setForm] = useState({ nome: '', duracao_min: '30', cal_event_type_id: '', descricao: '' })
  return (
    <ListaRecurso<Procedimento>
      tabela="procedimentos"
      titulo="Procedimentos que o assistente oferece"
      vazio="Sem procedimentos, o assistente oferece só Avaliação e Limpeza, pelos IDs de evento da clínica."
      formulario={(criar) => (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!form.nome.trim() || !form.cal_event_type_id) return
            void criar({ nome: form.nome.trim(), duracao_min: Number(form.duracao_min) || 30, cal_event_type_id: Number(form.cal_event_type_id), descricao: form.descricao.trim() || null, ativo: true, ordem: 0 }).then(() => setForm({ nome: '', duracao_min: '30', cal_event_type_id: '', descricao: '' }))
          }}
          className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
        >
          <Campo rotulo="Nome">
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={campoClasse} placeholder="Avaliação" />
          </Campo>
          <Campo rotulo="Duração (min)">
            <input inputMode="numeric" value={form.duracao_min} onChange={(e) => setForm({ ...form, duracao_min: e.target.value })} className={campoClasse} />
          </Campo>
          <Campo rotulo="Evento Cal.com (ID)">
            <input inputMode="numeric" value={form.cal_event_type_id} onChange={(e) => setForm({ ...form, cal_event_type_id: e.target.value })} className={campoClasse} placeholder="7215725" />
          </Campo>
          <Botao type="submit">Adicionar</Botao>
        </form>
      )}
      linha={(p, { editar, remover }) => (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[14px] text-ivory">
              {p.nome} <span className="text-slate">· {p.duracao_min} min · evento {p.cal_event_type_id}</span>
            </p>
            {p.descricao ? <p className="text-[12px] text-slate">{p.descricao}</p> : null}
          </div>
          <div className="flex gap-2">
            <Botao tipo="fantasma" onClick={() => void editar({ ordem: (p.ordem || 0) - 1 })}>
              ↑
            </Botao>
            <Botao tipo="fantasma" onClick={() => void editar({ ordem: (p.ordem || 0) + 1 })}>
              ↓
            </Botao>
            <Botao tipo="fantasma" onClick={() => void editar({ ativo: !p.ativo })}>
              {p.ativo ? 'Desativar' : 'Ativar'}
            </Botao>
            <BotaoRemover aoConfirmar={() => void remover()} />
          </div>
        </div>
      )}
    />
  )
}

export function Horarios({ clinica, aoSalvar }: { clinica: Clinica; aoSalvar: () => Promise<void> | void }) {
  const [horario, setHorario] = useState<Record<string, [string, string][]>>(() => ({ ...clinica.horario_funcionamento }))
  const [aviso, setAviso] = useState('')
  const mudar = (dia: string, i: number, pos: 0 | 1, valor: string) => {
    const lista = [...(horario[dia] || [])]
    lista[i] = [pos === 0 ? valor : lista[i]?.[0] || '09:00', pos === 1 ? valor : lista[i]?.[1] || '18:00'] as [string, string]
    setHorario({ ...horario, [dia]: lista })
  }
  const adicionar = (dia: string) => setHorario({ ...horario, [dia]: [...(horario[dia] || []), ['09:00', '18:00']] })
  const tirar = (dia: string, i: number) => setHorario({ ...horario, [dia]: (horario[dia] || []).filter((_, j) => j !== i) })
  async function salvar() {
    try {
      await enviar('clinica', { horario_funcionamento: horario }, 'PUT')
      setAviso('Salvo.')
      await aoSalvar()
    } catch (f) {
      setAviso(f instanceof Error ? f.message : 'falhou')
    }
  }
  return (
    <div className="graphite-card flex flex-col gap-4">
      <div>
        <h3 className="text-[1.1rem] text-ivory">Horário de funcionamento</h3>
        <p className="mt-1 text-[13px] text-slate">Fora dele o assistente continua marcando, mas avisa que a recepção responde no próximo horário útil.</p>
      </div>
      <ul className="flex flex-col gap-3">
        {DIAS.map(([dia, rotulo]) => (
          <li key={dia} className="flex flex-wrap items-center gap-2">
            <span className="w-20 text-[13px] text-ash">{rotulo}</span>
            {(horario[dia] || []).map((par, i) => (
              <span key={i} className="flex items-center gap-1">
                <input type="time" value={par[0]} onChange={(e) => mudar(dia, i, 0, e.target.value)} className={`${campoClasse} mt-0 w-auto`} />
                <span className="text-slate">–</span>
                <input type="time" value={par[1]} onChange={(e) => mudar(dia, i, 1, e.target.value)} className={`${campoClasse} mt-0 w-auto`} />
                <button type="button" onClick={() => tirar(dia, i)} className="px-2 text-slate hover:text-[#ff9b9b]" aria-label="Remover intervalo">
                  ×
                </button>
              </span>
            ))}
            <button type="button" onClick={() => adicionar(dia)} className="text-[12px] text-[#8db4f5] underline-offset-4 hover:underline">
              + intervalo
            </button>
          </li>
        ))}
      </ul>
      {aviso ? <p className="text-[13px] text-[#8db4f5]">{aviso}</p> : null}
      <div>
        <Botao onClick={() => void salvar()}>Salvar horários</Botao>
      </div>
    </div>
  )
}

export function TomEMensagens({ clinica, aoSalvar }: { clinica: Clinica; aoSalvar: () => Promise<void> | void }) {
  const [tom, setTom] = useState(clinica.tom_voz)
  const [urgencia, setUrgencia] = useState(clinica.palavras_urgencia.join(', '))
  const [mensagens, setMensagens] = useState<Record<string, string>>({ ...clinica.mensagens })
  const [aviso, setAviso] = useState('')
  const amostra = useMemo(
    () => ({ ...clinica, tom_voz: tom, mensagens }),
    [clinica, tom, mensagens],
  )
  const valoresExemplo = { nome: 'Ana', tipo: 'Avaliação', data: 'quinta-feira, 02/10 às 14:30', hora: '14:30' }

  async function salvar() {
    try {
      await enviar('clinica', { tom_voz: tom, palavras_urgencia: urgencia, mensagens }, 'PUT')
      setAviso('Salvo.')
      await aoSalvar()
    } catch (f) {
      setAviso(f instanceof Error ? f.message : 'falhou')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="graphite-card grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Tom de voz" dica="Muda o cumprimento e o fecho das mensagens; o que cada mensagem pede não muda.">
          <select value={tom} onChange={(e) => setTom(e.target.value as Clinica['tom_voz'])} className={campoClasse}>
            <option value="formal">Formal</option>
            <option value="acolhedor">Acolhedor</option>
            <option value="descontraido">Descontraído</option>
          </select>
        </Campo>
        <Campo rotulo="Palavras de urgência (separadas por vírgula)" dica="Se o paciente escrever uma delas, a conversa vai direto para a recepção.">
          <input value={urgencia} onChange={(e) => setUrgencia(e.target.value)} className={campoClasse} />
        </Campo>
      </div>
      <div className="graphite-card">
        <h3 className="text-[1.1rem] text-ivory">Mensagens do assistente</h3>
        <p className="mt-1 text-[13px] text-slate">Em branco, vale o padrão. Chaves entre chaves são preenchidas na hora: {'{nome}'}, {'{clinica}'}, {'{dentista}'}, {'{endereco}'}, {'{maps}'}, {'{recomendacoes}'}, {'{tipo}'}, {'{data}'}, {'{hora}'}, {'{valor}'}, {'{recepcao}'}, {'{saudacao}'}, {'{fecho}'}.</p>
        <ul className="mt-5 flex flex-col gap-5">
          {CHAVES_TEXTO.map((chave) => (
            <li key={chave} className="grid gap-3 lg:grid-cols-2">
              <Campo rotulo={ROTULOS_TEXTO[chave]}>
                <textarea rows={3} value={mensagens[chave] ?? ''} onChange={(e) => setMensagens({ ...mensagens, [chave]: e.target.value })} placeholder={TEXTOS_PADRAO[chave]} className={`${campoClasse} resize-y font-mono text-[12px]`} />
              </Campo>
              <div>
                <span className="label-voice text-[9px]">Como o paciente lê</span>
                <p className="mt-1.5 rounded-lg bg-[#202c33] px-3 py-2 text-[13px] leading-[1.45] text-[#e9edef] whitespace-pre-wrap">{texto(amostra, chave, valoresExemplo)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {aviso ? <p className="text-[13px] text-[#8db4f5]">{aviso}</p> : null}
      <div>
        <Botao onClick={() => void salvar()}>Salvar tom e mensagens</Botao>
      </div>
    </div>
  )
}

export function Configuracoes({ eu, aoMudar }: { eu: Eu; aoMudar: () => Promise<void> }) {
  const [aba, setAba] = useState<'clinica' | 'dentistas' | 'procedimentos' | 'horarios' | 'mensagens' | 'whatsapp'>('clinica')
  const clinica = eu.clinica!
  const ABAS: [typeof aba, string][] = [
    ['clinica', 'Clínica'],
    ['dentistas', 'Dentistas'],
    ['procedimentos', 'Procedimentos'],
    ['horarios', 'Horários'],
    ['mensagens', 'Tom de voz e mensagens'],
    ['whatsapp', 'WhatsApp'],
  ]
  return (
    <div className="flex flex-col gap-5">
      <Titulo sub="Tudo o que o assistente sabe sobre a clínica.">Configurações</Titulo>
      <nav className="flex flex-wrap gap-2">
        {ABAS.map(([chave, rotulo]) => (
          <button key={chave} type="button" onClick={() => setAba(chave)} className={`rounded-full border px-4 py-2 text-[13px] transition-colors ${aba === chave ? 'border-[#8db4f5]/50 text-ivory' : 'border-white/10 text-slate hover:text-ivory'}`}>
            {rotulo}
          </button>
        ))}
      </nav>
      {aba === 'clinica' ? (
        <div className="graphite-card">
          <FormClinica clinica={clinica} aoSalvar={aoMudar} />
        </div>
      ) : aba === 'dentistas' ? (
        <Dentistas />
      ) : aba === 'procedimentos' ? (
        <Procedimentos />
      ) : aba === 'horarios' ? (
        <Horarios clinica={clinica} aoSalvar={aoMudar} />
      ) : aba === 'mensagens' ? (
        <TomEMensagens clinica={clinica} aoSalvar={aoMudar} />
      ) : (
        <ConexaoWhatsapp clinica={clinica} aoMudar={aoMudar} />
      )}
    </div>
  )
}
