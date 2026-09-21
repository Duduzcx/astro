/**
 * Os textos do robô do WhatsApp, editáveis pelo painel.
 *
 * GET  devolve o que está valendo (o do banco, ou o padrão do código)
 * PUT  grava um novo conjunto
 *
 * Guardar no banco em vez de no código existe por um motivo prático: mudar
 * uma frase do atendimento não pode exigir um programador e um deploy.
 */
import { exigirSessao } from '../_lib/auth.js'
import { gravarConfig, lerConfig } from '../_lib/config.js'
import { temBanco } from '../_lib/db.js'
import { TEXTOS_PADRAO } from '../_lib/whatsapp-textos.js'

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
    const textos = await lerConfig('whatsapp_textos', TEXTOS_PADRAO)
    return res.status(200).json({
      textos: { ...TEXTOS_PADRAO, ...textos },
      padrao: TEXTOS_PADRAO,
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
      const textos = limpar(dados?.textos)
      await gravarConfig('whatsapp_textos', textos)
      return res.status(200).json({ ok: true, textos })
    } catch (erro) {
      console.error('falha ao gravar textos do robô:', erro?.message)
      return res.status(400).json({ erro: 'não foi possível gravar' })
    }
  }

  res.setHeader('Allow', 'GET, PUT')
  return res.status(405).json({ erro: 'método não permitido' })
}
