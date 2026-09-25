import { webhookEvolution } from './_lib/bot.ts'
import { cronLembretes } from './_lib/cron.ts'
import { ErroHttp, type Req, type Res } from './_lib/http.ts'
import { rotasPainel } from './_lib/painel.ts'

/**
 * Uma função só para o CRM inteiro. O plano gratuito da Vercel para em doze
 * funções por deploy, e cada arquivo em /api vira uma; aqui o caminho depois
 * de /api/crm/ decide o que roda:
 *
 *   whatsapp/webhook/{instancia}   o que a Evolution API entrega
 *   cron/lembretes                 o anti-faltas, com CRON_SECRET
 *   (o resto)                      o painel, com a sessão do Supabase Auth
 */
export default async function handler(req: Req, res: Res) {
  const url = new URL(req.url || '/', 'http://local')
  const partes = url.pathname
    .replace(/^\/api\/crm\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((p) => decodeURIComponent(p))
  try {
    if (partes[0] === 'whatsapp' && partes[1] === 'webhook' && partes[2]) return await webhookEvolution(req, res, partes[2])
    if (partes[0] === 'cron' && partes[1] === 'lembretes') return await cronLembretes(req, res)
    return await rotasPainel(partes, req, res)
  } catch (erro) {
    if (erro instanceof ErroHttp) return res.status(erro.codigo).json({ erro: erro.message })
    /* Nada de dado de paciente no log: só a mensagem do erro. */
    console.error('crm falhou:', (erro as Error)?.message)
    if (!res.headersSent) return res.status(500).json({ erro: 'falha interna' })
  }
}
