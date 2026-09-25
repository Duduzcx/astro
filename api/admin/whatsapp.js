/**
 * A automação do WhatsApp, para o painel.
 *
 * GET          o estado: conexão com a Meta (conferida de verdade, não só
 *              "tem variável"), credenciais presentes, chave geral, textos
 *              e instrução valendo
 * GET ?logs=1  as últimas interações do robô (WhatsApp e chat do site)
 * PUT          grava textos, instrução e/ou a chave geral — só o que vier
 *
 * As credenciais (token, id do número, segredo) NUNCA passam por aqui nem
 * ficam no banco: moram nas variáveis de ambiente da Vercel. Um banco com
 * token dentro é um token a mais para vazar, e o painel só precisa saber se
 * elas existem e se a Meta as aceita.
 *
 * Guardar textos no banco em vez de no código existe por um motivo prático:
 * mudar uma frase do atendimento não pode exigir um programador e um deploy.
 */
import { exigirSessao } from '../_lib/auth.js'
import { botAtivo, gravarConfig, lerConfig } from '../_lib/config.js'
import { temBanco } from '../_lib/db.js'
import { listarLogs } from '../_lib/logs.js'
import { TEXTOS_PADRAO } from '../_lib/whatsapp-textos.js'
import { INSTRUCAO_PADRAO } from '../bot.js'

const GRAPH = 'https://graph.facebook.com/v21.0'

/**
 * Pergunta à Meta se o token e o número valem. É a diferença entre
 * "Conectado" e "tem variável cadastrada": um token vencido tem variável e
 * não atende ninguém.
 */
async function conferirConexao() {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) {
    return { estado: 'desconectado', detalhe: 'faltam WHATSAPP_TOKEN e WHATSAPP_PHONE_ID na Vercel' }
  }
  try {
    const r = await fetch(`${GRAPH}/${phoneId}?fields=display_phone_number,verified_name,quality_rating`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    })
    if (!r.ok) {
      const motivo = r.status === 401 || r.status === 403 ? 'a Meta recusou o token' : `a Meta respondeu ${r.status}`
      return { estado: 'desconectado', detalhe: `${motivo} — confira WHATSAPP_TOKEN e WHATSAPP_PHONE_ID` }
    }
    const dados = await r.json()
    const partes = [dados?.verified_name, dados?.display_phone_number].filter(Boolean)
    return {
      estado: 'conectado',
      detalhe: partes.length ? partes.join(' · ') : 'número reconhecido pela Meta',
      qualidade: dados?.quality_rating || '',
    }
  } catch (erro) {
    return { estado: 'desconectado', detalhe: `sem resposta da Meta (${erro?.name === 'TimeoutError' ? 'tempo esgotado' : 'rede'})` }
  }
}

export const config = { api: { bodyParser: false } }

function corpoCru(req) {
  return new Promise((resolve, reject) => {
    const partes = []
    let tamanho = 0
    req.on('data', (p) => {
      tamanho += p.length
      if (tamanho > 32 * 1024) {
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

/** Só as chaves conhecidas entram, cada uma com teto de tamanho. */
function limpar(bruto) {
  const saida = {}
  for (const chave of Object.keys(TEXTOS_PADRAO)) {
    const valor = String(bruto?.[chave] ?? '').slice(0, 3000).trim()
    saida[chave] = valor || TEXTOS_PADRAO[chave]
  }
  return saida
}

export default async function handler(req, res) {
  if (!exigirSessao(req, res)) return

  if (req.method === 'GET') {
    if (req.query.logs) {
      return res.status(200).json({ logs: await listarLogs(100) })
    }
    const [textos, instrucao, ativo, conexao] = await Promise.all([
      lerConfig('whatsapp_textos', TEXTOS_PADRAO),
      lerConfig('bot_instrucao', INSTRUCAO_PADRAO),
      botAtivo(),
      conferirConexao(),
    ])
    return res.status(200).json({
      textos: { ...TEXTOS_PADRAO, ...textos },
      padrao: TEXTOS_PADRAO,
      instrucao: typeof instrucao === 'string' ? instrucao : INSTRUCAO_PADRAO,
      instrucaoPadrao: INSTRUCAO_PADRAO,
      /* A inteligência do chat do site: ligada só se houver chave. */
      inteligencia: process.env.ANTHROPIC_API_KEY ? 'claude' : process.env.OPENAI_API_KEY ? 'openai' : '',
      ativo,
      conexao,
      credenciais: {
        token: Boolean(process.env.WHATSAPP_TOKEN),
        phoneId: Boolean(process.env.WHATSAPP_PHONE_ID),
        verifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
        appSecret: Boolean(process.env.WHATSAPP_APP_SECRET),
      },
      ligado: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
      assinado: Boolean(process.env.WHATSAPP_APP_SECRET),
      avisoEquipe: process.env.EQUIPE_WHATSAPP ? 'configurado' : '',
      editavel: temBanco(),
    })
  }

  if (req.method === 'PUT') {
    if (!temBanco()) return res.status(503).json({ erro: 'banco não configurado' })
    try {
      const dados = JSON.parse((await corpoCru(req)).toString('utf8'))
      /* Só grava o que veio. O interruptor manda `{ ativo }` sozinho, e a
         versão anterior reescrevia os textos com o padrão de fábrica em
         qualquer PUT sem `textos` — apagava o que a equipe tinha escrito. */
      let textos = null
      if (dados?.textos && typeof dados.textos === 'object') {
        textos = limpar(dados.textos)
        await gravarConfig('whatsapp_textos', textos)
      }
      if (typeof dados?.instrucao === 'string') {
        /* A instrução é o que a inteligência lê antes de falar pela empresa.
           Vazia, volta ao padrão: um atendimento sem instrução inventa. */
        const instrucao = dados.instrucao.slice(0, 6000).trim()
        await gravarConfig('bot_instrucao', instrucao || INSTRUCAO_PADRAO)
      }
      if (typeof dados?.ativo === 'boolean') await gravarConfig('bot_ativo', dados.ativo)
      return res.status(200).json({ ok: true, textos, ativo: await botAtivo() })
    } catch (erro) {
      console.error('falha ao gravar a automação:', erro?.message)
      return res.status(400).json({ erro: 'não foi possível gravar' })
    }
  }

  res.setHeader('Allow', 'GET, PUT')
  return res.status(405).json({ erro: 'método não permitido' })
}
