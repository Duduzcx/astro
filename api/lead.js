/**
 * Recebe um lead do chat do site.
 *
 * Rota pública, então trata tudo o que chega como hostil: método, tamanho do
 * corpo, origem e campos. O que ela NUNCA faz é responder "recebido" sem ter
 * onde guardar — quando o banco não está configurado, diz isso, e o chat cai
 * para o WhatsApp, que é o caminho que sempre funciona.
 */
import { avisarEquipe, criarLead, temBanco, texto } from './_lib/leads.js'

export const config = { api: { bodyParser: false } }

const LIMITE_CORPO = 64 * 1024

function corpoCru(req) {
  return new Promise((resolve, reject) => {
    const partes = []
    let tamanho = 0
    req.on('data', (p) => {
      tamanho += p.length
      if (tamanho > LIMITE_CORPO) {
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

/**
 * Só aceita envio da própria página. Não é fechadura — cabeçalho se forja —
 * mas corta o roteiro bobo que varre a internet postando em endpoints.
 */
function mesmaOrigem(req) {
  const origem = req.headers.origin
  if (!origem) return true
  try {
    const host = new URL(origem).host
    return host === req.headers.host
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ erro: 'método não permitido' })
  }
  if (!mesmaOrigem(req)) return res.status(403).json({ erro: 'origem não permitida' })

  let dados
  try {
    dados = JSON.parse((await corpoCru(req)).toString('utf8'))
  } catch {
    return res.status(400).json({ erro: 'corpo inválido' })
  }

  /* Uma isca: o chat manda este campo sempre vazio. Preenchido, é robô.
     Responde 200 para o robô não aprender nada, e nada é guardado. */
  if (texto(dados?.armadilha, 20)) return res.status(200).json({ ok: true })

  const contato = texto(dados?.contato, 160)
  if (!contato) return res.status(400).json({ erro: 'contato é obrigatório' })

  if (!temBanco()) {
    /* Honestidade acima de tudo: sem banco não há onde guardar, e dizer
       "recebido" seria perder o lead em silêncio. O chat sabe ler isto e
       manda a pessoa para o WhatsApp com a conversa pronta. */
    return res.status(503).json({ erro: 'banco não configurado', use: 'whatsapp' })
  }

  try {
    const lead = await criarLead({ ...dados, canal: 'chat' })
    /* O aviso não pode derrubar o lead: ele já está salvo. */
    avisarEquipe(lead).catch(() => {})
    return res.status(201).json({ ok: true, id: lead.id })
  } catch (erro) {
    console.error('falha ao guardar lead:', erro?.message)
    return res.status(500).json({ erro: 'não foi possível guardar', use: 'whatsapp' })
  }
}
