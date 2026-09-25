import { useEffect, useState } from 'react'
import type { Eu } from '../api'
import { navegar } from '../rotas'
import { Aviso, Botao, Titulo } from '../ui'
import { BaseDeConhecimento } from './Conhecimento'
import { Dentistas, FormClinica, Horarios, Procedimentos } from './Configuracoes'
import { Simulador } from './Simulador'
import { ConexaoWhatsapp } from './Whatsapp'

/**
 * O assistente passo a passo de uma clínica nova. A ordem é a da confiança:
 * quem a clínica é, quem atende, o que oferece, quando abre, o que o bot
 * pode responder — e só depois de conversar com ele no simulador é que o
 * passo de conectar o WhatsApp aparece. Ninguém liga um robô num número
 * de verdade sem ter visto o robô falar.
 */
const PASSOS = [
  ['clinica', 'Clínica'],
  ['dentistas', 'Dentistas'],
  ['procedimentos', 'Procedimentos'],
  ['horarios', 'Horários'],
  ['conhecimento', 'Base de conhecimento'],
  ['simulador', 'Simulador'],
  ['whatsapp', 'Conectar WhatsApp'],
] as const

type Passo = (typeof PASSOS)[number][0]

export function Onboarding({ eu, aoMudar }: { eu: Eu; aoMudar: () => Promise<void> }) {
  const p = eu.progresso
  const feito: Record<Passo, boolean> = {
    clinica: p.clinica,
    dentistas: p.dentistas,
    procedimentos: p.procedimentos,
    horarios: p.horarios,
    conhecimento: p.conhecimento,
    simulador: p.simulador,
    whatsapp: p.whatsapp,
  }
  const primeiroPendente = PASSOS.find(([chave]) => !feito[chave])?.[0] ?? 'whatsapp'
  const [atual, setAtual] = useState<Passo>(primeiroPendente)
  useEffect(() => {
    if (!eu.clinica) setAtual('clinica')
  }, [eu.clinica])

  const visiveis = PASSOS.filter(([chave]) => chave !== 'whatsapp' || feito.simulador)
  const concluidos = visiveis.filter(([chave]) => feito[chave]).length
  const indice = visiveis.findIndex(([chave]) => chave === atual)
  const proximo = visiveis[indice + 1]?.[0]
  const anterior = visiveis[indice - 1]?.[0]

  return (
    <div className="flex flex-col gap-6">
      <Titulo sub={eu.clinica ? `${concluidos} de ${visiveis.length} passos prontos.` : 'Em poucos minutos o assistente atende a sua clínica.'}>
        {eu.clinica ? 'Configuração da clínica' : 'Bem-vindo(a)'}
      </Titulo>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-cobalt transition-[width]" style={{ width: `${(concluidos / visiveis.length) * 100}%` }} />
      </div>
      <nav className="flex flex-wrap gap-2">
        {visiveis.map(([chave, rotulo], i) => (
          <button
            key={chave}
            type="button"
            disabled={!eu.clinica && chave !== 'clinica'}
            onClick={() => setAtual(chave)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors disabled:opacity-40 ${atual === chave ? 'border-[#8db4f5]/50 text-ivory' : 'border-white/10 text-slate hover:text-ivory'}`}
          >
            <span className={`mr-1.5 ${feito[chave] ? 'text-[#86e8a8]' : 'text-slate'}`}>{feito[chave] ? '✓' : i + 1}</span>
            {rotulo}
          </button>
        ))}
        {!feito.simulador ? <span className="self-center text-[12px] text-slate">· Conectar WhatsApp aparece depois do simulador</span> : null}
      </nav>

      {atual === 'clinica' ? (
        <div className="graphite-card">
          <FormClinica clinica={eu.clinica} criando={!eu.clinica} aoSalvar={aoMudar} />
        </div>
      ) : !eu.clinica ? (
        <Aviso>Crie a clínica primeiro.</Aviso>
      ) : atual === 'dentistas' ? (
        <Dentistas />
      ) : atual === 'procedimentos' ? (
        <Procedimentos />
      ) : atual === 'horarios' ? (
        <Horarios clinica={eu.clinica} aoSalvar={aoMudar} />
      ) : atual === 'conhecimento' ? (
        <BaseDeConhecimento />
      ) : atual === 'simulador' ? (
        <div className="flex flex-col gap-3">
          <Aviso tom="info">Converse como um paciente. Assim que a primeira mensagem passar pelo motor, o passo de conectar o WhatsApp aparece.</Aviso>
          <Simulador clinica={eu.clinica} aoMudar={aoMudar} compacto />
        </div>
      ) : (
        <ConexaoWhatsapp clinica={eu.clinica} aoMudar={aoMudar} />
      )}

      {eu.clinica ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Botao tipo="fantasma" disabled={!anterior} onClick={() => anterior && setAtual(anterior)}>
            ← Anterior
          </Botao>
          <div className="flex gap-2">
            <Botao tipo="fantasma" onClick={() => navegar('')}>
              Ir para o painel
            </Botao>
            <Botao disabled={!proximo} onClick={() => proximo && setAtual(proximo)}>
              Próximo →
            </Botao>
          </div>
        </div>
      ) : null}
    </div>
  )
}
