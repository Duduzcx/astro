import { texto } from './bot/textos.js'
import { formatarVagaAmigavel } from './bot/util.js'
import { segredoDoCron, supabaseAdmin } from './ambiente.js'
import { dependencias, exigirSegredo } from './bot.js'
import { paraClinica } from './clinica.js'

/**
 * Anti-faltas. Chamado de hora em hora (Vercel Cron no plano pago; no plano
 * gratuito, um agendador externo como o cron-job.org, que é grátis e chama
 * a URL com o segredo). Pega as consultas que começam entre 3 e 4 horas a
 * partir de agora, sem lembrete enviado, manda a pergunta de confirmação e
 * põe a conversa em `aguardando_confirmacao`.
 */
export async function cronLembretes(req     , res     ) {
  exigirSegredo(req, segredoDoCron())
  const db = supabaseAdmin()
  const agora = Date.now()
  const de = new Date(agora + 3 * 3_600_000).toISOString()
  const ate = new Date(agora + 4 * 3_600_000).toISOString()
  const { data: pendentes, error } = await db
    .from('agendamentos')
    .select('id, clinica_id, paciente_id, tipo, inicio, pacientes(nome, telefone)')
    .eq('status', 'agendado')
    .is('lembrete_enviado_em', null)
    .gte('inicio', de)
    .lt('inicio', ate)
    .limit(200)
  if (error) return res.status(500).json({ erro: 'não foi possível listar' })

  let enviados = 0
  let pulados = 0
  const clinicas = new Map                                        ()

  for (const linha of (pendentes || [])                      ) {
    const paciente = Array.isArray(linha.pacientes) ? linha.pacientes[0] : linha.pacientes
    if (!paciente || paciente.telefone.startsWith('sim_')) {
      pulados += 1
      continue
    }
    if (!clinicas.has(linha.clinica_id)) {
      const { data } = await db.from('config_clinica').select('*').eq('id', linha.clinica_id).maybeSingle()
      if (data) clinicas.set(linha.clinica_id, paraClinica(data                           ))
    }
    const clinica = clinicas.get(linha.clinica_id)
    if (!clinica || clinica.whatsapp_status !== 'conectado' || !clinica.evolution_instance) {
      pulados += 1
      continue
    }
    try {
      const deps = dependencias(clinica, false)
      const hora = formatarVagaAmigavel(linha.inicio, clinica.timezone).split(' às ')[1] || ''
      await deps.canal.enviarTexto(
        paciente.telefone,
        texto(clinica, 'lembrete', { nome: paciente.nome.split(' ')[0], tipo: linha.tipo, hora }))
      await db.from('agendamentos').update({ lembrete_enviado_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', linha.id)
      const conversa = await deps.repo.lerConversa(clinica.id, paciente.telefone)
      await deps.repo.salvarConversa(clinica.id, paciente.telefone, {
        etapa: 'aguardando_confirmacao',
        contexto: { ...conversa.contexto, agendamento_id: linha.id, nome: paciente.nome },
      })
      enviados += 1
    } catch (erro) {
      console.error('lembrete falhou:', (erro         )?.message)
      pulados += 1
    }
  }
  return res.status(200).json({ ok: true, enviados, pulados, janela: [de, ate] })
}
