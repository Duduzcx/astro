/**
 * Os leads, para o painel.
 *
 * GET    ?situacao=&busca=   lista
 * PATCH  { id, situacao?, anotacoes?, valor_centavos? }   muda um
 * DELETE { id }              apaga um
 *
 * Toda rota daqui passa pelo porteiro. O cookie é SameSite=Lax, então
 * requisição vinda de outro site não o carrega e as escritas ficam cobertas
 * contra CSRF.
 */
import { exigirSessao } from '../_lib/auth.js'
import { apagarLead, atualizarLead, listarLeads, temBanco } from '../_lib/leads.js'

export const config = { api: { bodyParser: false } }

function corpoCru(req) {
  return new Promise((resolve, reject) => {
    const partes = []
    let tamanho = 0
    req.on('data', (p) => {
      tamanho += p.length
      if (tamanho > 16 * 1024) {
        reject(new Error('corpo grande demais'))
        req.destroy()
        return
      }
      partes.push(p)
    })
    req.on('end', () => resolve(Buffer.concat(partes)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (!exigirSessao(req, res)) return
  if (!temBanco()) return res.status(503).json({ erro: 'banco não configurado' })

  try {
    if (req.method === 'GET') {
      const leads = await listarLeads({ situacao: req.query.situacao, busca: req.query.busca })
      return res.status(200).json({ leads })
    }

    if (req.method === 'PATCH') {
      const dados = JSON.parse((await corpoCru(req)).toString('utf8'))
      if (!dados?.id) return res.status(400).json({ erro: 'id é obrigatório' })
      const lead = await atualizarLead(dados.id, dados)
      if (!lead) return res.status(404).json({ erro: 'lead não encontrado' })
      return res.status(200).json({ lead })
    }

    if (req.method === 'DELETE') {
      const dados = JSON.parse((await corpoCru(req)).toString('utf8'))
      if (!dados?.id) return res.status(400).json({ erro: 'id é obrigatório' })
      const foi = await apagarLead(dados.id)
      return res.status(foi ? 200 : 404).json(foi ? { ok: true } : { erro: 'lead não encontrado' })
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE')
    return res.status(405).json({ erro: 'método não permitido' })
  } catch (erro) {
    /* Erro de validação é culpa de quem pediu; o resto é nosso. A mensagem
       volta porque quem está aqui já entrou com senha. */
    const daPessoa = /situação desconhecida|valor inválido|nada para mudar|corpo/.test(erro?.message || '')
    if (!daPessoa) console.error('falha em /admin/leads:', erro?.message)
    return res.status(daPessoa ? 400 : 500).json({ erro: daPessoa ? erro.message : 'falha interna' })
  }
}
