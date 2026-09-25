import type { Clinica, Conversa, Deps, Entrada, Paciente, Procedimento, TipoAgendamento } from './tipos.ts'
import { texto } from './textos.ts'
import {
  cpfValido,
  dentroDoHorario,
  ehUrgente,
  escolher,
  formatarVagaAmigavel,
  nomeValido,
  pareceUmaPergunta,
  simplificar,
  somarMinutos,
  somenteDigitos,
} from './util.ts'

/**
 * O motor: uma máquina de estados por (clínica, telefone).
 *
 * A etapa e o contexto moram em `conversas`; cada mensagem é lida, a etapa
 * decide o que fazer, e a conversa é gravada de volta. Se a recepção assumiu
 * (`humano_ativo`), o bot cala.
 */

const OPCOES_MENU = ['Agendar consulta', 'Retorno/Manutenção', 'Falar com recepção']
const DIAS_DE_BUSCA = 14
const LIMITE_TENTATIVAS = 2

type TipoOferecido = { nome: string; eventTypeId: number; duracao: number; tipo: TipoAgendamento }

function classificar(nome: string, retorno: boolean): TipoAgendamento {
  if (retorno) return 'retorno'
  const n = simplificar(nome)
  if (n.includes('limpeza') || n.includes('profilaxia')) return 'limpeza'
  if (n.includes('avalia') || n.includes('consulta')) return 'avaliacao'
  return 'tratamento'
}

export async function processar(deps: Deps, clinica: Clinica, entrada: Entrada): Promise<void> {
  const { repo, canal } = deps
  const agora = deps.agora ?? (() => new Date())
  const telefone = entrada.telefone
  const msg = entrada.texto.trim()
  const conversa = await repo.lerConversa(clinica.id, telefone)
  if (conversa.humano_ativo) return

  const ctx = { ...conversa.contexto } as Record<string, unknown>
  const salvar = (etapa: string, mais: Partial<Conversa> = {}) =>
    repo.salvarConversa(clinica.id, telefone, { etapa, contexto: ctx, ...mais })
  const dizer = (chave: Parameters<typeof texto>[1], valores: Record<string, string | number | null | undefined> = {}) =>
    canal.enviarTexto(telefone, texto(clinica, chave, valores))
  const transferir = async (chave: 'urgencia' | 'recepcao' | 'limiteTentativas', motivo: string) => {
    /* O painel usa isto para a etiqueta da conversa (urgência em vermelho). */
    ctx.motivo_humano = chave === 'urgencia' ? 'urgencia' : chave === 'recepcao' ? 'recepcao' : 'limite'
    ctx.motivo_detalhe = motivo
    await dizer(chave)
    await salvar(conversa.etapa, { humano_ativo: true })
    await repo.notificarRecepcao?.(clinica.id, telefone, motivo).catch(() => undefined)
  }

  /* Pergunta livre no meio de uma etapa: responde com a base de conhecimento
     e volta para onde estava. Devolve true se tratou. */
  const desvioFaq = async (): Promise<boolean> => {
    if (!deps.faq || !pareceUmaPergunta(msg)) return false
    const conhecimento = await repo.listarConhecimento(clinica.id)
    let resposta: string | null = null
    try {
      resposta = await deps.faq(msg, { clinica, conhecimento })
    } catch {
      resposta = null
    }
    if (resposta) {
      await canal.enviarTexto(telefone, resposta)
      return true
    }
    await repo.registrarSemResposta(clinica.id, telefone, msg)
    await dizer('faqSemResposta')
    ctx.sinalizada = true
    await salvar(conversa.etapa)
    await repo.notificarRecepcao?.(clinica.id, telefone, 'pergunta sem resposta').catch(() => undefined)
    return true
  }

  const avisoForaDoHorario = async () => {
    if (!dentroDoHorario(clinica.horario_funcionamento, agora(), clinica.timezone) && !ctx.avisouHorario) {
      ctx.avisouHorario = true
      await dizer('foraHorario')
    }
  }

  const pedirMotivo = async () => {
    await dizer('pedirMotivo')
    await salvar('triagem')
  }

  const oferecerTipos = async () => {
    const procedimentos = await repo.listarProcedimentos(clinica.id)
    /* Sem procedimentos cadastrados valem os dois tipos de evento da clínica. */
    const alternativos: TipoOferecido[] = []
    if (clinica.event_type_avaliacao) alternativos.push({ nome: 'Avaliação', eventTypeId: clinica.event_type_avaliacao, duracao: 30, tipo: 'avaliacao' })
    if (clinica.event_type_limpeza) alternativos.push({ nome: 'Limpeza', eventTypeId: clinica.event_type_limpeza, duracao: 60, tipo: 'limpeza' })
    const tipos: TipoOferecido[] = procedimentos.length
      ? procedimentos.map((p: Procedimento) => ({
          nome: p.nome,
          eventTypeId: p.cal_event_type_id,
          duracao: p.duracao_min,
          tipo: classificar(p.nome, ctx.queixa === 'Retorno'),
        }))
      : alternativos
    if (tipos.length === 0) {
      await transferir('recepcao', 'clínica sem procedimentos cadastrados')
      return
    }
    ctx.tipos = tipos
    await avisoForaDoHorario()
    await canal.enviarOpcoes(
      telefone,
      texto(clinica, 'escolherTipo'),
      tipos.map((t) => `${t.nome} ${t.duracao}min`),
    )
    await salvar('escolhendo_tipo')
  }

  const buscarVagas = async (chave: 'vagas' | 'vagaOcupada') => {
    const tipo = ctx.tipoEscolhido as TipoOferecido
    const de = agora()
    const ate = new Date(de.getTime() + DIAS_DE_BUSCA * 86_400_000)
    const vagas = (await deps.agenda.vagas(tipo.eventTypeId, de, ate, clinica.timezone)).slice(0, 3)
    if (vagas.length === 0) {
      const tentativas = conversa.tentativas_agenda + 1
      const paciente = await pacienteAtual()
      if (paciente) await repo.inserirListaEspera(clinica.id, paciente.id, tipo.tipo, String(ctx.queixa || ''))
      await dizer('semVagas')
      if (tentativas >= LIMITE_TENTATIVAS) {
        await salvar('inicio', { tentativas_agenda: tentativas })
        await transferir('limiteTentativas', 'sem vagas duas vezes')
        return
      }
      await salvar('inicio', { tentativas_agenda: tentativas })
      return
    }
    ctx.vagas = vagas.map((v) => v.inicio)
    await canal.enviarOpcoes(
      telefone,
      texto(clinica, chave, { tipo: tipo.nome }),
      vagas.map((v) => formatarVagaAmigavel(v.inicio, clinica.timezone)),
    )
    await salvar('escolhendo_vaga')
  }

  const pacienteAtual = async (): Promise<Paciente | null> => {
    if (typeof ctx.paciente_id === 'string') {
      const p = await repo.lerPaciente(ctx.paciente_id)
      if (p) return p
    }
    return repo.buscarPaciente(clinica.id, telefone)
  }

  const menu = async (paciente: Paciente) => {
    ctx.paciente_id = paciente.id
    ctx.nome = paciente.nome
    await canal.enviarOpcoes(telefone, texto(clinica, 'boasVindasVolta', { nome: paciente.nome.split(' ')[0] }), OPCOES_MENU)
    await salvar('menu_principal')
  }

  switch (conversa.etapa) {
    case 'coletando_nome': {
      if (!nomeValido(msg)) {
        if (await desvioFaq()) {
          await dizer('pedirNome')
          return
        }
        await dizer('nomeInvalido')
        return
      }
      ctx.nome = msg.replace(/\s+/g, ' ')
      await dizer('pedirCpf', { nome: String(ctx.nome).split(' ')[0] })
      await salvar('coletando_cpf')
      return
    }

    case 'coletando_cpf': {
      if (!cpfValido(msg)) {
        if (await desvioFaq()) {
          await dizer('pedirCpf', { nome: String(ctx.nome || '').split(' ')[0] })
          return
        }
        await dizer('cpfInvalido')
        return
      }
      const paciente = await repo.criarPaciente(clinica.id, {
        telefone,
        nome: String(ctx.nome || entrada.nomeExibido || ''),
        cpf: somenteDigitos(msg),
        email: `${somenteDigitos(telefone) || telefone}@paciente.astro.bot`,
      })
      ctx.paciente_id = paciente.id
      await pedirMotivo()
      return
    }

    case 'triagem': {
      if (ehUrgente(msg, clinica.palavras_urgencia)) {
        ctx.queixa = msg
        await transferir('urgencia', 'urgência: ' + msg.slice(0, 80))
        return
      }
      if (await desvioFaq()) {
        await dizer('pedirMotivo')
        return
      }
      ctx.queixa = msg
      await oferecerTipos()
      return
    }

    case 'menu_principal': {
      const i = escolher(msg, OPCOES_MENU)
      if (i === 0) {
        await pedirMotivo()
        return
      }
      if (i === 1) {
        ctx.queixa = 'Retorno'
        await oferecerTipos()
        return
      }
      if (i === 2) {
        await transferir('recepcao', 'pediu a recepção')
        return
      }
      if (ehUrgente(msg, clinica.palavras_urgencia)) {
        ctx.queixa = msg
        await transferir('urgencia', 'urgência: ' + msg.slice(0, 80))
        return
      }
      if (await desvioFaq()) {
        await canal.enviarOpcoes(telefone, texto(clinica, 'escolherTipo'), OPCOES_MENU)
        return
      }
      await dizer('naoEntendi')
      await canal.enviarOpcoes(telefone, texto(clinica, 'boasVindasVolta', { nome: String(ctx.nome || '').split(' ')[0] }), OPCOES_MENU)
      return
    }

    case 'escolhendo_tipo': {
      const tipos = (ctx.tipos as TipoOferecido[] | undefined) || []
      const i = escolher(msg, tipos.map((t) => `${t.nome} ${t.duracao}min`))
      if (i < 0) {
        if (await desvioFaq()) {
          await canal.enviarOpcoes(telefone, texto(clinica, 'escolherTipo'), tipos.map((t) => `${t.nome} ${t.duracao}min`))
          return
        }
        await dizer('naoEntendi')
        await canal.enviarOpcoes(telefone, texto(clinica, 'escolherTipo'), tipos.map((t) => `${t.nome} ${t.duracao}min`))
        return
      }
      ctx.tipoEscolhido = tipos[i]
      await buscarVagas('vagas')
      return
    }

    case 'escolhendo_vaga': {
      const vagas = (ctx.vagas as string[] | undefined) || []
      const i = escolher(msg, vagas.map((v) => formatarVagaAmigavel(v, clinica.timezone)))
      if (i < 0) {
        if (await desvioFaq()) {
          await canal.enviarOpcoes(telefone, texto(clinica, 'vagas', { tipo: (ctx.tipoEscolhido as TipoOferecido).nome }), vagas.map((v) => formatarVagaAmigavel(v, clinica.timezone)))
          return
        }
        await dizer('naoEntendi')
        await canal.enviarOpcoes(telefone, texto(clinica, 'vagas', { tipo: (ctx.tipoEscolhido as TipoOferecido).nome }), vagas.map((v) => formatarVagaAmigavel(v, clinica.timezone)))
        return
      }
      const tipo = ctx.tipoEscolhido as TipoOferecido
      const paciente = await pacienteAtual()
      if (!paciente) {
        await salvar('inicio')
        await dizer('apresentacao')
        await dizer('pedirNome')
        await salvar('coletando_nome')
        return
      }
      const inicio = vagas[i]
      const nome = entrada.teste ? `[TESTE] ${paciente.nome}` : paciente.nome
      let uid: string | null = null
      try {
        uid = (await deps.agenda.criar({ eventTypeId: tipo.eventTypeId, inicio, nome, email: paciente.email || `${somenteDigitos(telefone)}@paciente.astro.bot`, timezone: clinica.timezone })).uid
      } catch {
        uid = null
      }
      if (!uid) {
        /* A vaga foi ocupada entre a oferta e a escolha: refaz a busca uma vez. */
        const tentativas = conversa.tentativas_agenda + 1
        if (tentativas >= LIMITE_TENTATIVAS) {
          await salvar('inicio', { tentativas_agenda: tentativas })
          await transferir('limiteTentativas', 'agendamento falhou duas vezes')
          return
        }
        await salvar('escolhendo_vaga', { tentativas_agenda: tentativas })
        await buscarVagas('vagaOcupada')
        return
      }
      const { id } = await repo.criarAgendamento({
        clinicaId: clinica.id,
        pacienteId: paciente.id,
        calBookingUid: uid,
        eventTypeId: tipo.eventTypeId,
        tipo: ctx.reagendando ? 'retorno' : tipo.tipo,
        inicio,
        fim: somarMinutos(inicio, tipo.duracao),
        queixa: String(ctx.queixa || ''),
      })
      ctx.agendamento_id = id
      delete ctx.vagas
      delete ctx.reagendando
      await dizer('confirmacao', { tipo: tipo.nome, data: formatarVagaAmigavel(inicio, clinica.timezone) })
      await salvar('concluido', { tentativas_agenda: 0 })
      return
    }

    case 'aguardando_confirmacao': {
      const t = simplificar(msg)
      const agendamentoId = typeof ctx.agendamento_id === 'string' ? ctx.agendamento_id : ''
      const agendamento = agendamentoId ? await repo.lerAgendamento(agendamentoId) : null
      if (!agendamento) {
        await salvar('inicio')
        await processar(deps, clinica, entrada)
        return
      }
      if (/^(1|sim|confirmo|confirmar|ok|isso|claro|pode ser)\b/.test(t) || t.includes('confirm')) {
        await repo.atualizarAgendamento(agendamento.id, { status: 'confirmado', confirmado_em: agora().toISOString() })
        const paciente = await pacienteAtual()
        await dizer('confirmado', { nome: (paciente?.nome || String(ctx.nome || '')).split(' ')[0] })
        await salvar('concluido')
        return
      }
      if (/^(2|nao|não|reagendar|remarcar|cancelar|cancela|mudar|trocar)\b/.test(t) || t.includes('reagend') || t.includes('remarc') || t.includes('cancel')) {
        if (agendamento.cal_booking_uid) {
          await deps.agenda.cancelar(agendamento.cal_booking_uid, 'Paciente pediu para reagendar pelo WhatsApp').catch(() => undefined)
        }
        await repo.atualizarAgendamento(agendamento.id, { status: 'cancelado' })
        ctx.reagendando = true
        ctx.queixa = ctx.queixa || 'Reagendamento'
        await dizer('cancelado')
        await oferecerTipos()
        return
      }
      if (await desvioFaq()) {
        await dizer('lembrete', { nome: String(ctx.nome || '').split(' ')[0], tipo: agendamento.tipo, hora: formatarVagaAmigavel(agendamento.inicio, clinica.timezone).split(' às ')[1] })
        return
      }
      await dizer('naoEntendi')
      return
    }

    case 'inicio':
    case 'concluido':
    default: {
      const paciente = await repo.buscarPaciente(clinica.id, telefone)
      if (ehUrgente(msg, clinica.palavras_urgencia)) {
        ctx.queixa = msg
        if (paciente) {
          ctx.paciente_id = paciente.id
          ctx.nome = paciente.nome
        }
        await transferir('urgencia', 'urgência: ' + msg.slice(0, 80))
        return
      }
      /* Quem começa com uma pergunta recebe a resposta antes do roteiro. */
      if (paciente) {
        if (await desvioFaq()) {
          await menu(paciente)
          return
        }
        await menu(paciente)
        return
      }
      if (await desvioFaq()) {
        await dizer('apresentacao')
        await dizer('pedirNome')
        await salvar('coletando_nome')
        return
      }
      await dizer('apresentacao')
      await dizer('pedirNome')
      await salvar('coletando_nome')
      return
    }
  }
}
