import type { Agendamento, Canal, Conversa, Paciente, Procedimento, Repo } from '../../../lib/bot/tipos.ts'
import { avisarTelegram, supabaseAdmin } from './ambiente.ts'

/**
 * O repositório do motor sobre o Supabase, com a service_role. Nunca loga
 * CPF nem queixa: erro aqui vira uma linha genérica no log da Vercel.
 */
export function criarRepo(): Repo {
  const db = () => supabaseAdmin()
  return {
    async buscarPaciente(clinicaId, telefone) {
      const { data } = await db().from('pacientes').select('id, nome, telefone, email').eq('clinica_id', clinicaId).eq('telefone', telefone).maybeSingle()
      return (data as Paciente | null) ?? null
    },

    async criarPaciente(clinicaId, dados) {
      const { data, error } = await db()
        .from('pacientes')
        .upsert({ clinica_id: clinicaId, telefone: dados.telefone, nome: dados.nome, cpf: dados.cpf, email: dados.email, updated_at: new Date().toISOString() }, { onConflict: 'clinica_id,telefone' })
        .select('id, nome, telefone, email')
        .single()
      if (error || !data) throw new Error('não foi possível cadastrar o paciente')
      return data as Paciente
    },

    async lerPaciente(id) {
      const { data } = await db().from('pacientes').select('id, nome, telefone, email').eq('id', id).maybeSingle()
      return (data as Paciente | null) ?? null
    },

    async lerConversa(clinicaId, telefone) {
      const { data } = await db().from('conversas').select('etapa, contexto, humano_ativo, tentativas_agenda').eq('clinica_id', clinicaId).eq('telefone', telefone).maybeSingle()
      if (data) {
        const c = data as Conversa
        return { etapa: c.etapa || 'inicio', contexto: (c.contexto && typeof c.contexto === 'object' ? c.contexto : {}) as Record<string, unknown>, humano_ativo: Boolean(c.humano_ativo), tentativas_agenda: Number(c.tentativas_agenda) || 0 }
      }
      const nova: Conversa = { etapa: 'inicio', contexto: {}, humano_ativo: false, tentativas_agenda: 0 }
      await db().from('conversas').upsert({ clinica_id: clinicaId, telefone, ...nova, ultima_mensagem_em: new Date().toISOString() }, { onConflict: 'clinica_id,telefone' })
      return nova
    },

    async salvarConversa(clinicaId, telefone, mudancas) {
      const agora = new Date().toISOString()
      await db()
        .from('conversas')
        .upsert({ clinica_id: clinicaId, telefone, ...mudancas, ultima_mensagem_em: agora, updated_at: agora }, { onConflict: 'clinica_id,telefone' })
    },

    async listarProcedimentos(clinicaId) {
      const { data } = await db().from('procedimentos').select('id, nome, duracao_min, cal_event_type_id, descricao').eq('clinica_id', clinicaId).eq('ativo', true).order('ordem').order('nome')
      return ((data as Procedimento[] | null) ?? []).map((p) => ({ ...p, cal_event_type_id: Number(p.cal_event_type_id), duracao_min: Number(p.duracao_min) }))
    },

    async criarAgendamento(dados) {
      const { data, error } = await db()
        .from('agendamentos')
        .insert({
          clinica_id: dados.clinicaId,
          paciente_id: dados.pacienteId,
          cal_booking_uid: dados.calBookingUid,
          event_type_id: dados.eventTypeId,
          tipo: dados.tipo,
          inicio: dados.inicio,
          fim: dados.fim,
          status: 'agendado',
          queixa_resumo: dados.queixa.slice(0, 500),
        })
        .select('id')
        .single()
      if (error || !data) throw new Error('não foi possível gravar o agendamento')
      return { id: String(data.id) }
    },

    async lerAgendamento(id) {
      const { data } = await db().from('agendamentos').select('id, paciente_id, cal_booking_uid, event_type_id, tipo, inicio, fim, status').eq('id', id).maybeSingle()
      return (data as Agendamento | null) ?? null
    },

    async atualizarAgendamento(id, mudancas) {
      await db().from('agendamentos').update({ ...mudancas, updated_at: new Date().toISOString() }).eq('id', id)
    },

    async inserirListaEspera(clinicaId, pacienteId, tipo, observacao) {
      await db().from('lista_espera').insert({ clinica_id: clinicaId, paciente_id: pacienteId, tipo, observacao: observacao.slice(0, 500) })
    },

    async listarConhecimento(clinicaId) {
      const { data } = await db().from('base_conhecimento').select('pergunta, resposta').eq('clinica_id', clinicaId).eq('ativo', true).limit(200)
      return (data as { pergunta: string; resposta: string }[] | null) ?? []
    },

    async registrarSemResposta(clinicaId, telefone, pergunta) {
      await db().from('perguntas_sem_resposta').insert({ clinica_id: clinicaId, telefone, pergunta: pergunta.slice(0, 1000) })
    },

    async notificarRecepcao(clinicaId, telefone, motivo) {
      /* O painel recebe pelo Realtime da tabela conversas; o Telegram é o
         aviso fora do painel, quando configurado. */
      const { data } = await db().from('config_clinica').select('nome').eq('id', clinicaId).maybeSingle()
      const final = telefone.replace(/^sim_.*/, 'simulador').replace(/^\+?\d+(\d{4})$/, '…$1')
      await avisarTelegram(`[${(data as { nome?: string } | null)?.nome || 'clínica'}] conversa precisa da recepção (${motivo}) — contato final ${final}`)
    },
  }
}

/** Grava uma mensagem no histórico do painel e toca a conversa. */
export async function registrarMensagem(clinicaId: string, telefone: string, direcao: 'entrada' | 'saida', origem: 'bot' | 'humano' | 'paciente', conteudo: string, wamid?: string) {
  const db = supabaseAdmin()
  const agora = new Date().toISOString()
  await db.from('mensagens').insert({ clinica_id: clinicaId, telefone, direcao, origem, conteudo: conteudo.slice(0, 4000), tipo: 'text', wamid: wamid || null })
  await db.from('conversas').upsert({ clinica_id: clinicaId, telefone, ultima_mensagem_em: agora, updated_at: agora }, { onConflict: 'clinica_id,telefone' })
}

/** Um canal que grava tudo o que o bot manda, antes de mandar de verdade. */
export function canalRegistrador(clinicaId: string, base: Canal | null): Canal {
  const enviar = async (telefone: string, texto: string) => {
    await registrarMensagem(clinicaId, telefone, 'saida', 'bot', texto)
    if (base) await base.enviarTexto(telefone, texto)
  }
  return {
    enviarTexto: enviar,
    enviarOpcoes: (telefone, texto, opcoes) => enviar(telefone, `${texto}\n\n${opcoes.map((o, i) => `${i + 1}) ${o}`).join('\n')}\n\nResponda com o número.`),
  }
}
