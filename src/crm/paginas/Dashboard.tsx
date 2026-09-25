import { useEffect, useState } from 'react'
import { pedir, quando, telefoneBonito, type Eu } from '../api'
import { Aviso, Link, Numero, Pilula, Titulo, Vazio } from '../ui'
import { STATUS_COR } from '../estilos'

type Painel = {
  hoje: { id: string; inicio: string; tipo: string; status: string; pacientes: { nome: string; telefone: string } | null }[]
  confirmados: number
  pendentes: number
  urgencias: number
  humanoAtivo: number
  conversasHumano: { telefone: string; motivo: string; quando: string }[]
  perguntasSemResposta: number
  listaEspera: number
}

export function Dashboard({ eu }: { eu: Eu }) {
  const [dados, setDados] = useState<Painel | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    pedir<Painel>('dashboard')
      .then(setDados)
      .catch((f) => setErro(f instanceof Error ? f.message : 'falhou'))
  }, [])

  const faltando = Object.entries(eu.servicos)
    .filter(([chave, ok]) => !ok && chave !== 'telegram' && chave !== 'groq')
    .map(([chave]) => ({ evolution: 'Evolution API (WhatsApp)', calcom: 'Cal.com (agenda)', cron: 'CRON_SECRET (lembretes)', supabase: 'Supabase' })[chave] || chave)

  return (
    <div className="flex flex-col gap-6">
      <Titulo sub={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}>Hoje</Titulo>
      {faltando.length ? <Aviso>Falta configurar na Vercel: {faltando.join(', ')}. O passo a passo está em docs/crm-odonto.md.</Aviso> : null}
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {dados ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Numero rotulo="Consultas hoje" valor={dados.hoje.length} />
            <Numero rotulo="Confirmadas" valor={dados.confirmados} cor="text-[#86e8a8]" />
            <Numero rotulo="Sem confirmação" valor={dados.pendentes} cor={dados.pendentes ? 'text-[#ffd479]' : 'text-ivory'} />
            <Numero rotulo="Urgências abertas" valor={dados.urgencias} cor={dados.urgencias ? 'text-[#ff9b9b]' : 'text-ivory'} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Numero rotulo="Conversas com a recepção" valor={dados.humanoAtivo} cor="text-[#c9a6ff]" />
            <Numero rotulo="Perguntas sem resposta" valor={dados.perguntasSemResposta} />
            <Numero rotulo="Na lista de espera" valor={dados.listaEspera} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="graphite-card">
              <h3 className="text-[1.1rem] text-ivory">Agenda de hoje</h3>
              {dados.hoje.length === 0 ? (
                <div className="mt-3">
                  <Vazio>Nenhuma consulta marcada para hoje.</Vazio>
                </div>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {dados.hoje.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-obsidian/60 px-3 py-2 text-[13px]">
                      <span className="text-ivory">{quando(a.inicio).split(', ')[1] || quando(a.inicio)}</span>
                      <span className="text-ash">{a.pacientes?.nome || 'paciente'}</span>
                      <span className="text-slate">{a.tipo}</span>
                      <Pilula cor={STATUS_COR[a.status] || ''}>{a.status}</Pilula>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="graphite-card">
              <h3 className="text-[1.1rem] text-ivory">Precisam de uma pessoa</h3>
              {dados.conversasHumano.length === 0 ? (
                <div className="mt-3">
                  <Vazio>Nenhuma conversa esperando a recepção.</Vazio>
                </div>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {dados.conversasHumano.map((c) => (
                    <li key={c.telefone} className="flex items-center justify-between gap-2 rounded-xl bg-obsidian/60 px-3 py-2 text-[13px]">
                      <Link para={`conversas?tel=${encodeURIComponent(c.telefone)}`} className="text-ivory underline-offset-4 hover:underline">
                        {telefoneBonito(c.telefone)}
                      </Link>
                      <Pilula cor={c.motivo === 'urgencia' ? 'text-[#ff9b9b] border-[#ff9b9b]/40' : 'text-[#c9a6ff] border-[#c9a6ff]/35'}>{c.motivo || 'recepção'}</Pilula>
                      <span className="text-slate">{quando(c.quando)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : !erro ? (
        <p className="text-slate">Carregando…</p>
      ) : null}
    </div>
  )
}
