import { mascararCpf } from '../../../lib/bot/util.ts'
import { agenda, configuracao, evolution, supabaseAdmin, tokenDoWebhook, urlPublica } from './ambiente.ts'
import { rodarMotor } from './bot.ts'
import { camposEditaveis, publica, type LinhaClinica } from './clinica.ts'
import { corpo, ErroHttp, numeroOuNulo, primeiro, textoCurto, textoLongo, type Req, type Res } from './http.ts'
import { registrarMensagem } from './repo.ts'
import { clinicaPorId, exigirClinica, sessaoDaRequisicao, type Sessao } from './sessao.ts'

/**
 * As rotas do painel. Toda uma passa pela sessão do Supabase Auth e filtra
 * por `clinica.id`: um usuário nunca alcança a linha de outra clínica, nem
 * por engano nosso, porque o filtro é o primeiro argumento de cada consulta.
 */

type Recurso = {
  campos: string[]
  ordem: string
  desc?: boolean
  semCriar?: boolean
  select?: string
  busca?: string[]
}

const RECURSOS: Record<string, Recurso> = {
  dentistas: { campos: ['nome', 'especialidade', 'ativo'], ordem: 'nome' },
  procedimentos: { campos: ['nome', 'duracao_min', 'cal_event_type_id', 'descricao', 'ativo', 'ordem'], ordem: 'ordem' },
  base_conhecimento: { campos: ['pergunta', 'resposta', 'ativo'], ordem: 'pergunta' },
  perguntas_sem_resposta: { campos: ['resolvida'], ordem: 'created_at', desc: true, semCriar: true },
  lista_espera: { campos: ['atendido', 'observacao'], ordem: 'created_at', desc: true, semCriar: true, select: '*, pacientes(nome, telefone)' },
  pacientes: { campos: ['nome', 'email'], ordem: 'nome', semCriar: true, busca: ['nome', 'telefone'] },
}

function limparCampos(tabela: string, bruto: Record<string, unknown>) {
  const regra = RECURSOS[tabela]
  const saida: Record<string, unknown> = {}
  for (const campo of regra.campos) {
    if (!Object.prototype.hasOwnProperty.call(bruto, campo)) continue
    const valor = bruto[campo]
    if (campo === 'ativo' || campo === 'atendido' || campo === 'resolvida') saida[campo] = Boolean(valor)
    else if (campo === 'duracao_min' || campo === 'cal_event_type_id' || campo === 'ordem') saida[campo] = numeroOuNulo(valor)
    else if (campo === 'resposta' || campo === 'descricao' || campo === 'observacao') saida[campo] = textoLongo(valor, 3000)
    else saida[campo] = textoCurto(valor, 300)
  }
  return saida
}

function mascarar(linhas: Record<string, unknown>[]) {
  return linhas.map((l) => ('cpf' in l ? { ...l, cpf: mascararCpf(String(l.cpf || '')) } : l))
}

/** [início, fim) do dia de hoje no fuso da clínica, em ISO. */
export function limitesDoDia(timezone: string, agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(agora)
  const p = (t: string) => Number(partes.find((x) => x.type === t)?.value || 0)
  const localComoUtc = Date.UTC(p('year'), p('month') - 1, p('day'), p('hour') % 24, p('minute'), p('second'))
  const deslocamento = localComoUtc - agora.getTime()
  const meiaNoiteLocal = Date.UTC(p('year'), p('month') - 1, p('day')) - deslocamento
  return [new Date(meiaNoiteLocal).toISOString(), new Date(meiaNoiteLocal + 86_400_000).toISOString()] as const
}

async function progresso(clinica: LinhaClinica | null) {
  if (!clinica) return { clinica: false, dentistas: false, procedimentos: false, horarios: false, conhecimento: false, simulador: false, whatsapp: false }
  const db = supabaseAdmin()
  const contar = async (tabela: string) => {
    const { count } = await db.from(tabela).select('id', { count: 'exact', head: true }).eq('clinica_id', clinica.id)
    return (count || 0) > 0
  }
  const [dentistas, procedimentos, conhecimento] = await Promise.all([contar('dentistas'), contar('procedimentos'), contar('base_conhecimento')])
  return {
    clinica: true,
    dentistas,
    procedimentos,
    horarios: Object.keys(clinica.horario_funcionamento || {}).length > 0,
    conhecimento,
    simulador: Boolean(clinica.simulador_testado_em),
    whatsapp: clinica.whatsapp_status === 'conectado',
  }
}

export async function rotasPainel(partes: string[], req: Req, res: Res) {
  const sessao = await sessaoDaRequisicao(req)
  const metodo = req.method || 'GET'
  const [raiz, a, b] = partes

  if (raiz === 'eu' && metodo === 'GET') {
    return res.status(200).json({
      usuario: sessao.usuario,
      papel: sessao.papel,
      clinica: sessao.clinica ? publica(sessao.clinica) : null,
      progresso: await progresso(sessao.clinica),
      servicos: configuracao(),
    })
  }

  if (raiz === 'clinica') return clinica(sessao, metodo, req, res)
  if (raiz === 'recursos' && a) return recursos(sessao, a, b, metodo, req, res)
  if (raiz === 'dashboard' && metodo === 'GET') return dashboard(sessao, res)
  if (raiz === 'conversas') return conversas(sessao, a, b, metodo, req, res)
  if (raiz === 'agendamentos') return agendamentos(sessao, a, b, metodo, res)
  if (raiz === 'instancia') return instancia(sessao, metodo, res)
  if (raiz === 'simulador') return simulador(sessao, a, metodo, req, res)

  throw new ErroHttp(404, 'rota desconhecida')
}

async function clinica(sessao: Sessao, metodo: string, req: Req, res: Res) {
  const db = supabaseAdmin()
  if (metodo === 'POST') {
    if (sessao.clinica) throw new ErroHttp(409, 'esta conta já tem uma clínica')
    const dados = camposEditaveis(await corpo(req), true)
    if (!dados.nome) throw new ErroHttp(400, 'o nome da clínica é obrigatório')
    const { data: nova, error } = await db.from('config_clinica').insert({ ...dados, ativo: true }).select('*').single()
    if (error || !nova) throw new ErroHttp(500, 'não foi possível criar a clínica')
    const { error: erroLigacao } = await db.from('usuarios_clinica').insert({ user_id: sessao.usuario.id, clinica_id: nova.id, papel: 'admin' })
    if (erroLigacao) {
      await db.from('config_clinica').delete().eq('id', nova.id)
      throw new ErroHttp(500, 'não foi possível ligar o usuário à clínica')
    }
    const criada = await clinicaPorId(String(nova.id))
    return res.status(201).json({ clinica: criada ? publica(criada) : null })
  }
  if (metodo === 'PUT') {
    const atual = exigirClinica(sessao)
    const dados = camposEditaveis(await corpo(req))
    if (Object.keys(dados).length === 0) throw new ErroHttp(400, 'nada para mudar')
    const { error } = await db.from('config_clinica').update({ ...dados, updated_at: new Date().toISOString() }).eq('id', atual.id)
    if (error) throw new ErroHttp(500, 'não foi possível gravar')
    const nova = await clinicaPorId(atual.id)
    return res.status(200).json({ clinica: nova ? publica(nova) : null })
  }
  res.setHeader('Allow', 'POST, PUT')
  return res.status(405).json({ erro: 'método não permitido' })
}

async function recursos(sessao: Sessao, tabela: string, id: string | undefined, metodo: string, req: Req, res: Res) {
  const regra = RECURSOS[tabela]
  if (!regra) throw new ErroHttp(404, 'recurso desconhecido')
  const cli = exigirClinica(sessao)
  const db = supabaseAdmin()

  if (metodo === 'GET') {
    let consulta = db.from(tabela).select(regra.select || '*').eq('clinica_id', cli.id)
    const busca = textoCurto(primeiro(req.query.busca), 80)
    if (busca && regra.busca) consulta = consulta.or(regra.busca.map((c) => `${c}.ilike.%${busca.replace(/[%,()]/g, '')}%`).join(','))
    if (tabela === 'perguntas_sem_resposta' && primeiro(req.query.pendentes)) consulta = consulta.eq('resolvida', false)
    const { data, error } = await consulta.order(regra.ordem, { ascending: !regra.desc }).limit(300)
    if (error) throw new ErroHttp(500, 'não foi possível listar')
    return res.status(200).json({ itens: mascarar((data || []) as unknown as Record<string, unknown>[]) })
  }
  if (metodo === 'POST') {
    if (regra.semCriar) throw new ErroHttp(405, 'este recurso não é criado pelo painel')
    const dados = limparCampos(tabela, await corpo(req))
    const { data, error } = await db.from(tabela).insert({ ...dados, clinica_id: cli.id }).select('*').single()
    if (error) throw new ErroHttp(400, 'não foi possível criar: confira os campos')
    return res.status(201).json({ item: data })
  }
  if (metodo === 'PUT' && id) {
    const dados = limparCampos(tabela, await corpo(req))
    if (Object.keys(dados).length === 0) throw new ErroHttp(400, 'nada para mudar')
    const { data, error } = await db.from(tabela).update(dados).eq('id', id).eq('clinica_id', cli.id).select('*').maybeSingle()
    if (error) throw new ErroHttp(400, 'não foi possível gravar')
    if (!data) throw new ErroHttp(404, 'não encontrado')
    return res.status(200).json({ item: mascarar([data as Record<string, unknown>])[0] })
  }
  if (metodo === 'DELETE' && id) {
    if (tabela === 'pacientes') throw new ErroHttp(405, 'paciente não se apaga pelo painel')
    const { error } = await db.from(tabela).delete().eq('id', id).eq('clinica_id', cli.id)
    if (error) throw new ErroHttp(400, 'não foi possível apagar')
    return res.status(200).json({ ok: true })
  }
  res.setHeader('Allow', 'GET, POST, PUT, DELETE')
  return res.status(405).json({ erro: 'método não permitido' })
}

async function dashboard(sessao: Sessao, res: Res) {
  const cli = exigirClinica(sessao)
  const db = supabaseAdmin()
  const [inicio, fim] = limitesDoDia(cli.timezone)
  const [hoje, conversasHumano, semResposta, espera] = await Promise.all([
    db.from('agendamentos').select('id, inicio, fim, tipo, status, pacientes(nome, telefone)').eq('clinica_id', cli.id).gte('inicio', inicio).lt('inicio', fim).neq('status', 'cancelado').order('inicio'),
    db.from('conversas').select('telefone, contexto, ultima_mensagem_em').eq('clinica_id', cli.id).eq('humano_ativo', true).order('ultima_mensagem_em', { ascending: false }).limit(50),
    db.from('perguntas_sem_resposta').select('id', { count: 'exact', head: true }).eq('clinica_id', cli.id).eq('resolvida', false),
    db.from('lista_espera').select('id', { count: 'exact', head: true }).eq('clinica_id', cli.id).eq('atendido', false),
  ])
  type Hoje = { status: string; pacientes: { nome: string; telefone: string } | { nome: string; telefone: string }[] | null }
  const agendamentosHoje = ((hoje.data || []) as unknown as Hoje[]).map((a) => ({ ...a, pacientes: Array.isArray(a.pacientes) ? a.pacientes[0] || null : a.pacientes }))
  const humano = (conversasHumano.data || []) as { telefone: string; contexto: Record<string, unknown> | null; ultima_mensagem_em: string }[]
  return res.status(200).json({
    hoje: agendamentosHoje.map((a) => ({ ...a, pacientes: a.pacientes ? { nome: a.pacientes.nome, telefone: a.pacientes.telefone } : null })),
    confirmados: agendamentosHoje.filter((a) => a.status === 'confirmado').length,
    pendentes: agendamentosHoje.filter((a) => a.status === 'agendado').length,
    urgencias: humano.filter((c) => c.contexto?.motivo_humano === 'urgencia').length,
    humanoAtivo: humano.length,
    conversasHumano: humano.map((c) => ({ telefone: c.telefone, motivo: String(c.contexto?.motivo_humano || ''), quando: c.ultima_mensagem_em })),
    perguntasSemResposta: semResposta.count || 0,
    listaEspera: espera.count || 0,
    whatsapp: cli.whatsapp_status,
  })
}

async function conversas(sessao: Sessao, telefone: string | undefined, acao: string | undefined, metodo: string, req: Req, res: Res) {
  const cli = exigirClinica(sessao)
  const db = supabaseAdmin()

  if (!telefone && metodo === 'GET') {
    const { data } = await db.from('conversas').select('telefone, etapa, humano_ativo, contexto, ultima_mensagem_em').eq('clinica_id', cli.id).order('ultima_mensagem_em', { ascending: false, nullsFirst: false }).limit(100)
    const lista = (data || []) as { telefone: string; etapa: string; humano_ativo: boolean; contexto: Record<string, unknown> | null; ultima_mensagem_em: string | null }[]
    const telefones = lista.map((c) => c.telefone)
    const [pacientes, ultimas] = await Promise.all([
      telefones.length ? db.from('pacientes').select('telefone, nome').eq('clinica_id', cli.id).in('telefone', telefones) : Promise.resolve({ data: [] }),
      telefones.length ? db.from('mensagens').select('telefone, conteudo, direcao, origem, created_at').eq('clinica_id', cli.id).order('created_at', { ascending: false }).limit(400) : Promise.resolve({ data: [] }),
    ])
    const nomes = new Map(((pacientes.data || []) as { telefone: string; nome: string }[]).map((p) => [p.telefone, p.nome]))
    const ultima = new Map<string, { conteudo: string; direcao: string; origem: string; created_at: string }>()
    for (const m of (ultimas.data || []) as { telefone: string; conteudo: string; direcao: string; origem: string; created_at: string }[]) {
      if (!ultima.has(m.telefone)) ultima.set(m.telefone, m)
    }
    return res.status(200).json({
      conversas: lista.map((c) => ({
        telefone: c.telefone,
        nome: nomes.get(c.telefone) || null,
        etapa: c.etapa,
        humano_ativo: c.humano_ativo,
        motivo: String(c.contexto?.motivo_humano || ''),
        sinalizada: Boolean(c.contexto?.sinalizada),
        ultima_mensagem_em: c.ultima_mensagem_em,
        ultima: ultima.get(c.telefone) || null,
      })),
    })
  }

  if (!telefone) throw new ErroHttp(404, 'rota desconhecida')

  if (!acao && metodo === 'GET') {
    const [conversa, paciente, mensagens] = await Promise.all([
      db.from('conversas').select('etapa, humano_ativo, contexto, tentativas_agenda, ultima_mensagem_em').eq('clinica_id', cli.id).eq('telefone', telefone).maybeSingle(),
      db.from('pacientes').select('id, nome, telefone, email, cpf, created_at').eq('clinica_id', cli.id).eq('telefone', telefone).maybeSingle(),
      db.from('mensagens').select('id, direcao, origem, conteudo, created_at').eq('clinica_id', cli.id).eq('telefone', telefone).order('created_at', { ascending: false }).limit(200),
    ])
    const c = conversa.data as { etapa: string; humano_ativo: boolean; contexto: Record<string, unknown> | null; tentativas_agenda: number; ultima_mensagem_em: string | null } | null
    return res.status(200).json({
      conversa: c ? { etapa: c.etapa, humano_ativo: c.humano_ativo, motivo: String(c.contexto?.motivo_humano || ''), detalhe: String(c.contexto?.motivo_detalhe || ''), sinalizada: Boolean(c.contexto?.sinalizada), ultima_mensagem_em: c.ultima_mensagem_em } : null,
      paciente: paciente.data ? mascarar([paciente.data as Record<string, unknown>])[0] : null,
      mensagens: ((mensagens.data || []) as Record<string, unknown>[]).reverse(),
    })
  }

  if (metodo !== 'POST') throw new ErroHttp(405, 'método não permitido')
  if (acao === 'assumir') {
    await db.from('conversas').upsert({ clinica_id: cli.id, telefone, humano_ativo: true, updated_at: new Date().toISOString() }, { onConflict: 'clinica_id,telefone' })
    return res.status(200).json({ ok: true })
  }
  if (acao === 'devolver') {
    await db.from('conversas').upsert({ clinica_id: cli.id, telefone, humano_ativo: false, etapa: 'inicio', contexto: {}, tentativas_agenda: 0, updated_at: new Date().toISOString() }, { onConflict: 'clinica_id,telefone' })
    return res.status(200).json({ ok: true })
  }
  if (acao === 'enviar') {
    const texto = textoLongo((await corpo(req)).texto, 4000)
    if (!texto) throw new ErroHttp(400, 'mensagem vazia')
    if (!telefone.startsWith('sim_')) {
      const evo = evolution()
      if (!evo || !cli.evolution_instance) throw new ErroHttp(503, 'WhatsApp não conectado')
      await evo.enviarTexto(cli.evolution_instance, telefone, texto)
    }
    await registrarMensagem(cli.id, telefone, 'saida', 'humano', texto)
    return res.status(200).json({ ok: true })
  }
  throw new ErroHttp(404, 'ação desconhecida')
}

async function agendamentos(sessao: Sessao, id: string | undefined, acao: string | undefined, metodo: string, res: Res) {
  const cli = exigirClinica(sessao)
  const db = supabaseAdmin()
  if (!id && metodo === 'GET') {
    const { data, error } = await db.from('agendamentos').select('*, pacientes(nome, telefone)').eq('clinica_id', cli.id).order('inicio', { ascending: false }).limit(400)
    if (error) throw new ErroHttp(500, 'não foi possível listar')
    return res.status(200).json({ itens: data || [] })
  }
  if (id && acao && metodo === 'POST') {
    const { data } = await db.from('agendamentos').select('id, cal_booking_uid, status').eq('id', id).eq('clinica_id', cli.id).maybeSingle()
    if (!data) throw new ErroHttp(404, 'agendamento não encontrado')
    const alvo = { cancelar: 'cancelado', faltou: 'faltou', concluido: 'concluido' }[acao]
    if (!alvo) throw new ErroHttp(404, 'ação desconhecida')
    if (acao === 'cancelar' && data.cal_booking_uid) {
      const cal = agenda()
      if (cal) await cal.cancelar(String(data.cal_booking_uid), 'Cancelado pela recepção').catch((erro: Error) => console.error('cancelamento no Cal.com falhou:', erro?.message))
    }
    await db.from('agendamentos').update({ status: alvo, updated_at: new Date().toISOString() }).eq('id', id)
    return res.status(200).json({ ok: true, status: alvo })
  }
  throw new ErroHttp(405, 'método não permitido')
}

async function instancia(sessao: Sessao, metodo: string, res: Res) {
  const cli = exigirClinica(sessao)
  const db = supabaseAdmin()
  const evo = evolution()
  if (!evo) throw new ErroHttp(503, 'Evolution API não configurada (EVOLUTION_API_URL e EVOLUTION_API_KEY)')
  const nome = cli.evolution_instance || `clinica_${cli.id.replace(/-/g, '').slice(0, 12)}`
  const gravar = async (estado: LinhaClinica['whatsapp_status'], numero?: string | null) => {
    const mudancas: Record<string, unknown> = { evolution_instance: nome, whatsapp_status: estado, updated_at: new Date().toISOString() }
    if (numero !== undefined) mudancas.whatsapp_numero = numero
    await db.from('config_clinica').update(mudancas).eq('id', cli.id)
  }

  if (metodo === 'POST') {
    const webhook = `${urlPublica()}/api/crm/whatsapp/webhook/${encodeURIComponent(nome)}?token=${encodeURIComponent(tokenDoWebhook())}`
    await evo.criarInstancia(nome, webhook)
    const conexao = await evo.conectar(nome)
    await gravar(conexao.estado === 'conectado' ? 'conectado' : 'aguardando_qr')
    return res.status(200).json({ estado: conexao.estado === 'conectado' ? 'conectado' : 'aguardando_qr', qr: conexao.qr, instancia: nome })
  }
  if (metodo === 'GET') {
    if (!cli.evolution_instance) return res.status(200).json({ estado: 'desconectado', qr: null, numero: null, instancia: null })
    const estado = await evo.estado(nome).catch(() => ({ estado: 'desconectado' as const, numero: null }))
    if (estado.estado === 'conectado') {
      await gravar('conectado', estado.numero ?? cli.whatsapp_numero)
      return res.status(200).json({ estado: 'conectado', qr: null, numero: estado.numero ?? cli.whatsapp_numero, instancia: nome })
    }
    const conexao = await evo.conectar(nome).catch(() => ({ estado: 'desconectado' as const, qr: null }))
    await gravar(conexao.qr ? 'aguardando_qr' : 'desconectado')
    return res.status(200).json({ estado: conexao.qr ? 'aguardando_qr' : 'desconectado', qr: conexao.qr, numero: null, instancia: nome })
  }
  if (metodo === 'DELETE') {
    await evo.desconectar(nome)
    await evo.apagar(nome)
    await gravar('desconectado', null)
    return res.status(200).json({ ok: true, estado: 'desconectado' })
  }
  throw new ErroHttp(405, 'método não permitido')
}

async function simulador(sessao: Sessao, acao: string | undefined, metodo: string, req: Req, res: Res) {
  const cli = exigirClinica(sessao)
  const db = supabaseAdmin()
  const telefone = `sim_${sessao.usuario.id}`

  const estadoAtual = async () => {
    const [mensagens, conversa] = await Promise.all([
      db.from('mensagens').select('id, direcao, origem, conteudo, created_at').eq('clinica_id', cli.id).eq('telefone', telefone).order('created_at', { ascending: false }).limit(120),
      db.from('conversas').select('etapa, humano_ativo, contexto').eq('clinica_id', cli.id).eq('telefone', telefone).maybeSingle(),
    ])
    const c = conversa.data as { etapa: string; humano_ativo: boolean; contexto: Record<string, unknown> | null } | null
    return {
      telefone,
      mensagens: ((mensagens.data || []) as Record<string, unknown>[]).reverse(),
      conversa: c ? { etapa: c.etapa, humano_ativo: c.humano_ativo, motivo: String(c.contexto?.motivo_humano || '') } : null,
      testado: Boolean(cli.simulador_testado_em),
    }
  }

  const cancelarTestes = async () => {
    const { data: pacientes } = await db.from('pacientes').select('id').eq('clinica_id', cli.id).like('telefone', 'sim\\_%')
    const ids = ((pacientes || []) as { id: string }[]).map((p) => p.id)
    if (ids.length === 0) return 0
    const { data: abertos } = await db.from('agendamentos').select('id, cal_booking_uid').eq('clinica_id', cli.id).in('paciente_id', ids).in('status', ['agendado', 'confirmado'])
    const cal = agenda()
    let cancelados = 0
    for (const a of (abertos || []) as { id: string; cal_booking_uid: string | null }[]) {
      if (cal && a.cal_booking_uid) await cal.cancelar(a.cal_booking_uid, 'Teste do simulador').catch(() => undefined)
      await db.from('agendamentos').update({ status: 'cancelado', updated_at: new Date().toISOString() }).eq('id', a.id)
      cancelados += 1
    }
    return cancelados
  }

  if (metodo === 'GET' && !acao) return res.status(200).json(await estadoAtual())

  if (metodo === 'POST' && acao === 'cancelar-testes') {
    return res.status(200).json({ ok: true, cancelados: await cancelarTestes() })
  }

  if (metodo === 'POST' && !acao) {
    const texto = textoLongo((await corpo(req)).texto, 1000)
    if (!texto) throw new ErroHttp(400, 'mensagem vazia')
    await registrarMensagem(cli.id, telefone, 'entrada', 'paciente', texto)
    await rodarMotor(cli, { telefone, texto, teste: true }, true)
    if (!cli.simulador_testado_em) {
      await db.from('config_clinica').update({ simulador_testado_em: new Date().toISOString() }).eq('id', cli.id)
    }
    return res.status(200).json(await estadoAtual())
  }

  if (metodo === 'DELETE' && !acao) {
    await cancelarTestes()
    const { data: paciente } = await db.from('pacientes').select('id').eq('clinica_id', cli.id).eq('telefone', telefone).maybeSingle()
    if (paciente?.id) {
      await db.from('agendamentos').delete().eq('paciente_id', paciente.id)
      await db.from('lista_espera').delete().eq('paciente_id', paciente.id)
    }
    await db.from('mensagens').delete().eq('clinica_id', cli.id).eq('telefone', telefone)
    await db.from('conversas').delete().eq('clinica_id', cli.id).eq('telefone', telefone)
    await db.from('perguntas_sem_resposta').delete().eq('clinica_id', cli.id).eq('telefone', telefone)
    await db.from('pacientes').delete().eq('clinica_id', cli.id).eq('telefone', telefone)
    return res.status(200).json({ ok: true })
  }

  throw new ErroHttp(405, 'método não permitido')
}
