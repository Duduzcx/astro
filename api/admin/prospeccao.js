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
 * PUT { modo }        'responder' (só responde) ou 'ativo' (empurrão e abordagem a frio)
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
  modoDeProspeccao,
  MODOS_DO_ROBO,
  podeAbordarAFrio,
  quarentenaAte,
  SEGMENTOS,
  segmentoPadrao,
  sincronizarConversas,
  ponteRegistrada,
} from '../_lib/prospeccao.js'
import { corpo, ErroHttp } from '../crm/_lib/http.js'

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (!exigirSessao(req, res)) return
  try {
    if (req.method === 'GET') {
      if (req.query.qr) return res.status(200).json(await conectarNumero())
      /* ?sincronizar=1: antes de listar, pede ao telefone a lista de novo. */
      if (req.query.sincronizar) await sincronizarConversas()
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
      const modo = await modoDeProspeccao()
      const quarentena = await quarentenaAte()
      const segmento = await segmentoPadrao()
      const ponte = await ponteRegistrada()
      const conversas = estado.estado === 'conectado' ? await conversasDoAparelho().catch(() => []) : []
      return res.status(200).json({
        estado,
        instrucao,
        instrucaoPadrao: INSTRUCAO_PROSPECCAO_PADRAO,
        gatilho,
        gatilhoPadrao: GATILHO_PADRAO,
        modo,
        quarentenaAte: quarentena,
        segmento,
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
        /* Todas as travas da abordagem a frio num lugar só (prospeccao.js). */
        const decisao = await podeAbordarAFrio(String(dados.numero))
        if (decisao.erro) return res.status(409).json({ erro: decisao.erro })
        jids.push(decisao.jid)
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
        /* Igual ao padrão grava vazio: quando o padrão de fábrica melhorar, a
           melhora vale sem precisar salvar de novo. */
        await gravarConfig('prospeccao_instrucao', instrucao === INSTRUCAO_PROSPECCAO_PADRAO ? '' : instrucao)
        saida.instrucao = instrucao || INSTRUCAO_PROSPECCAO_PADRAO
      }
      /* { quarentena: horas } depois de uma restrição do WhatsApp: nada
         proativo até a data, e o modo volta a "só responde". */
      if (typeof dados?.quarentena === 'number' && Number.isFinite(dados.quarentena)) {
        const horas = Math.min(24 * 14, Math.max(0, dados.quarentena))
        const ate = horas > 0 ? new Date(Date.now() + horas * 3600 * 1000).toISOString() : ''
        await gravarConfig('quarentena_ate', ate)
        if (ate) await gravarConfig('prospeccao_modo', 'responder')
        saida.quarentenaAte = ate || null
      }
      if (typeof dados?.segmento === 'string') {
        if (!SEGMENTOS.includes(dados.segmento)) return res.status(400).json({ erro: 'segmento desconhecido' })
        await gravarConfig('prospeccao_segmento', dados.segmento)
        saida.segmento = dados.segmento
      }
      if (typeof dados?.modo === 'string') {
        if (!MODOS_DO_ROBO.includes(dados.modo)) return res.status(400).json({ erro: 'modo desconhecido' })
        await gravarConfig('prospeccao_modo', dados.modo)
        saida.modo = dados.modo
      }
      if (typeof dados?.gatilho === 'string') {
        const gatilho = dados.gatilho.slice(0, 600).trim()
        await gravarConfig('prospeccao_gatilho', gatilho === GATILHO_PADRAO ? '' : gatilho)
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
