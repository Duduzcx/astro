

/** O que a Vercel entrega a uma função em Node: a requisição com query e corpo já lidos. */

export class ErroHttp extends Error {
  codigo
  constructor(codigo        , mensagem        ) {
    super(mensagem)
    this.codigo = codigo
  }
}

/* 3 MB: um áudio de WhatsApp de uns minutos, em base64, vem junto do webhook. */
const LIMITE_CORPO = 3 * 1024 * 1024

/** O corpo como objeto: o que a Vercel já leu, ou o fluxo cru (harness local). */
export async function corpo(req     )                                   {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return req.body ? (JSON.parse(req.body)                           ) : {}
    if (typeof req.body === 'object') return req.body
    return {}
  }
  const partes           = []
  let tamanho = 0
  for await (const pedaco of req) {
    const buf = pedaco
    tamanho += buf.length
    if (tamanho > LIMITE_CORPO) throw new ErroHttp(413, 'corpo grande demais')
    partes.push(buf)
  }
  const texto = Buffer.concat(partes).toString('utf8')
  if (!texto.trim()) return {}
  try {
    return JSON.parse(texto)
  } catch {
    throw new ErroHttp(400, 'corpo inválido')
  }
}

export function textoCurto(valor         , limite = 500)         {
  return String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limite)
}

export function textoLongo(valor         , limite = 4000)         {
  return String(valor ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, limite)
}

export function numeroOuNulo(valor         )                {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

export function primeiro(valor                               )         {
  return Array.isArray(valor) ? valor[0] || '' : valor || ''
}
