/**
 * Os números do painel: total, semana, conversão, receita fechada, funil por
 * situação, entrada por semana e por canal.
 */
import { exigirSessao } from '../_lib/auth.js'
import { resumo, temBanco } from '../_lib/leads.js'

export default async function handler(req, res) {
  if (!exigirSessao(req, res)) return
  if (!temBanco()) return res.status(503).json({ erro: 'banco não configurado' })
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ erro: 'método não permitido' })
  }
  try {
    return res.status(200).json(await resumo())
  } catch (erro) {
    console.error('falha no resumo:', erro?.message)
    return res.status(500).json({ erro: 'falha interna' })
  }
}
