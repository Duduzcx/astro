import { processar } from '../../../lib/bot/motor.ts'
import type { Agenda, Deps, Entrada } from '../../../lib/bot/tipos.ts'
import { lerMensagemDoWebhook } from '../../../lib/evolution.ts'
import { agenda, evolution, faq, supabaseAdmin, tokenDoWebhook } from './ambiente.ts'
import type { LinhaClinica } from './clinica.ts'
import { corpo, ErroHttp, primeiro, type Req, type Res } from './http.ts'
import { canalRegistrador, criarRepo, registrarMensagem } from './repo.ts'
import { clinicaPorInstancia } from './sessao.ts'

/** Sem Cal.com configurado o motor não pode marcar: a agenda avisa em vez de fingir. */
const AGENDA_AUSENTE: Agenda = {
  async vagas() {
    return []
  },
  async criar() {
    throw new Error('CAL_API_KEY não configurada')
  },
  async cancelar() {},
}

export function dependencias(clinica: LinhaClinica, simulador: boolean): Deps {
  const evo = evolution()
  const base = !simulador && evo && clinica.evolution_instance ? evo.canal(clinica.evolution_instance) : null
  return {
    canal: canalRegistrador(clinica.id, base),
    repo: criarRepo(),
    agenda: agenda() ?? AGENDA_AUSENTE,
    faq: faq(),
  }
}

export async function rodarMotor(clinica: LinhaClinica, entrada: Entrada, simulador = false) {
  await processar(dependencias(clinica, simulador), clinica, entrada)
}

/**
 * O webhook da Evolution API: /api/crm/whatsapp/webhook/{instancia}?token=…
 *
 * Quem chama prova que é a Evolution por um destes: o cabeçalho `apikey`
 * igual ao da nossa instalação, ou o token que pusemos na URL ao registrar
 * o webhook. Sem um dos dois, 401 antes de ler qualquer coisa.
 */
export async function webhookEvolution(req: Req, res: Res, instancia: string) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ erro: 'método não permitido' })
  }
  const chaveEsperada = process.env.EVOLUTION_API_KEY || ''
  const tokenEsperado = tokenDoWebhook()
  const chave = String(req.headers.apikey || '')
  const token = primeiro(req.query.token)
  const autorizado = (chaveEsperada && chave === chaveEsperada) || (tokenEsperado && token === tokenEsperado)
  if (!autorizado) return res.status(401).json({ erro: 'não autorizado' })

  const evento = await corpo(req)
  const clinica = await clinicaPorInstancia(instancia)
  if (!clinica) return res.status(404).json({ erro: 'instância desconhecida' })

  /* A Evolution reenvia o que demora. Responde já e trabalha depois, dentro
     desta mesma invocação. */
  res.status(200).json({ ok: true })

  const tipo = String(evento.event || '').toLowerCase().replace(/_/g, '.')
  const db = supabaseAdmin()
  try {
    if (tipo === 'connection.update') {
      const dados = (evento.data || {}) as { state?: string; wuid?: string }
      const estado = String(dados.state || '').toLowerCase()
      if (estado === 'open') {
        let numero: string | null = null
        const evo = evolution()
        if (evo) numero = (await evo.estado(instancia).catch(() => ({ numero: null }))).numero
        await db.from('config_clinica').update({ whatsapp_status: 'conectado', whatsapp_numero: numero, updated_at: new Date().toISOString() }).eq('id', clinica.id)
      } else if (estado === 'close') {
        await db.from('config_clinica').update({ whatsapp_status: 'desconectado', updated_at: new Date().toISOString() }).eq('id', clinica.id)
      }
      return
    }
    if (tipo !== 'messages.upsert') return
    const mensagem = lerMensagemDoWebhook(evento)
    if (!mensagem || mensagem.deMim || !mensagem.texto) return
    /* Idempotência: a Evolution pode entregar o mesmo evento duas vezes. */
    if (mensagem.id) {
      const { error } = await db.from('mensagens_processadas').insert({ wamid: mensagem.id })
      if (error) return
    }
    await registrarMensagem(clinica.id, mensagem.telefone, 'entrada', 'paciente', mensagem.texto, mensagem.id || undefined)
    await rodarMotor(clinica, { telefone: mensagem.telefone, texto: mensagem.texto, nomeExibido: mensagem.nomeExibido })
  } catch (erro) {
    /* Nada de conteúdo no log: só o que aconteceu. */
    console.error('webhook do WhatsApp falhou:', (erro as Error)?.message)
  }
}

export function exigirSegredo(req: Req, segredo: string) {
  if (!segredo) throw new ErroHttp(503, 'CRON_SECRET não configurado')
  const cabecalho = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const alternativo = String(req.headers['x-cron-secret'] || '')
  const consulta = primeiro(req.query.secret)
  if (cabecalho !== segredo && alternativo !== segredo && consulta !== segredo) throw new ErroHttp(401, 'não autorizado')
}
