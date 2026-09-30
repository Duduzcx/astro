/**
 * A prospecção pelo número pessoal, para o painel (ver api/_lib/prospeccao.js).
 *
 * GET                 o estado do número, a instrução valendo e, conectado,
 *                     as conversas do aparelho com o lead de cada uma
 * GET ?qr=1           cria a instância se preciso e devolve o QR code
 * GET ?desconectar=1  desliga o número
 * POST { jids }       o robô assume estas conversas e manda a abordagem
 * PATCH { lead, prospeccao }  'bot', 'pausado' ou '' num lead
 * PUT { instrucao }   grava a instrução mestre de prospecção
 * PUT { gatilho }     grava as frases gatilho (uma por linha)
 */
import { exigirSessao } from '../_lib/auth.js'
import { gravarConfig } from '../_lib/config.js'
import { temBanco } from '../_lib/db.js'
import { temInteligencia } from '../_lib/inteligencia.js'
import {
  GATILHO_PADRAO,
  INSTRUCAO_PROSPECCAO_PADRAO,
  assumirConversas,
  conectarNumero,
  conversasDoAparelho,
  desconectarNumero,
  estadoDoNumero,
  gatilhoDeProspeccao,
  instrucaoDeProspeccao,
  marcarProspeccao,
  mensagensDaConversa,
  ponteRegistrada,
} from '../_lib/prospeccao.js'
import { corpo, ErroHttp } from '../crm/_lib/http.js'

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (!exigirSessao(req, res)) return
  try {
    if (req.method === 'GET') {
      if (req.query.qr) return res.status(200).json(await conectarNumero())
      if (req.query.desconectar) {
        await desconectarNumero()
        return res.status(200).json({ ok: true })
      }
      /* ?conversa=<jid> devolve as mensagens daquela conversa, para o painel
         abrir e ler antes de o robô assumir. */
      if (req.query.conversa) {
        return res.status(200).json({ mensagens: await mensagensDaConversa(String(req.query.conversa)) })
      }
      const estado = await estadoDoNumero()
      const instrucao = await instrucaoDeProspeccao()
      const gatilho = await gatilhoDeProspeccao()
      const ponte = await ponteRegistrada()
      const conversas = estado.estado === 'conectado' ? await conversasDoAparelho().catch(() => []) : []
      return res.status(200).json({
        estado,
        instrucao,
        instrucaoPadrao: INSTRUCAO_PROSPECCAO_PADRAO,
        gatilho,
        gatilhoPadrao: GATILHO_PADRAO,
        conversas,
        ponte,
        inteligencia: temInteligencia(),
        banco: temBanco(),
      })
    }
    if (req.method === 'POST') {
      const dados = await corpo(req)
      /* Aceita as conversas marcadas (jids) e/ou um número digitado à mão,
         para prospectar quem não está na lista. O número vira o jid do
         WhatsApp; DDI 55 é assumido quando vêm só 10 ou 11 dígitos. */
      const jids = Array.isArray(dados?.jids) ? dados.jids.map(String) : []
      if (dados?.numero) {
        let d = String(dados.numero).replace(/\D/g, '')
        if (d.length >= 10 && d.length <= 11) d = `55${d}`
        if (d.length >= 12) jids.push(`${d}@s.whatsapp.net`)
      }
      if (jids.length === 0) return res.status(400).json({ erro: 'escolha uma conversa ou digite um número' })
      return res.status(200).json({ resultados: await assumirConversas(jids) })
    }
    if (req.method === 'PATCH') {
      if (!temBanco()) return res.status(503).json({ erro: 'banco não configurado' })
      const dados = await corpo(req)
      const lead = await marcarProspeccao(Number(dados?.lead), String(dados?.prospeccao ?? ''))
      if (!lead) return res.status(404).json({ erro: 'lead não encontrado' })
      return res.status(200).json({ lead })
    }
    if (req.method === 'PUT') {
      if (!temBanco()) return res.status(503).json({ erro: 'banco não configurado' })
      const dados = await corpo(req)
      const saida = {}
      if (typeof dados?.instrucao === 'string') {
        const instrucao = dados.instrucao.slice(0, 6000).trim()
        await gravarConfig('prospeccao_instrucao', instrucao || INSTRUCAO_PROSPECCAO_PADRAO)
        saida.instrucao = instrucao || INSTRUCAO_PROSPECCAO_PADRAO
      }
      if (typeof dados?.gatilho === 'string') {
        const gatilho = dados.gatilho.slice(0, 600).trim()
        await gravarConfig('prospeccao_gatilho', gatilho || GATILHO_PADRAO)
        saida.gatilho = gatilho || GATILHO_PADRAO
      }
      if (Object.keys(saida).length === 0) return res.status(400).json({ erro: 'nada para gravar' })
      return res.status(200).json(saida)
    }
    res.setHeader('Allow', 'GET, POST, PATCH, PUT')
    return res.status(405).json({ erro: 'método não permitido' })
  } catch (erro) {
    if (erro instanceof ErroHttp) return res.status(erro.codigo).json({ erro: erro.message })
    console.error('prospecção falhou:', erro?.message)
    return res.status(500).json({ erro: erro?.message || 'falha interna' })
  }
}
