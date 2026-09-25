import type { IncomingMessage, ServerResponse } from 'node:http'

/** O que a Vercel entrega a uma função em Node: a requisição com query e corpo já lidos. */
export type Req = IncomingMessage & {
  query: Record<string, string | string[] | undefined>
  body?: unknown
}

export type Res = ServerResponse & {
  status(codigo: number): Res
  json(dados: unknown): Res
  send(dados: unknown): Res
}

export class ErroHttp extends Error {
  codigo: number
  constructor(codigo: number, mensagem: string) {
    super(mensagem)
    this.codigo = codigo
  }
}

const LIMITE_CORPO = 256 * 1024

/** O corpo como objeto: o que a Vercel já leu, ou o fluxo cru (harness local). */
export async function corpo(req: Req): Promise<Record<string, unknown>> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return req.body ? (JSON.parse(req.body) as Record<string, unknown>) : {}
    if (typeof req.body === 'object') return req.body as Record<string, unknown>
    return {}
  }
  const partes: Buffer[] = []
  let tamanho = 0
  for await (const pedaco of req) {
    const buf = pedaco as Buffer
    tamanho += buf.length
    if (tamanho > LIMITE_CORPO) throw new ErroHttp(413, 'corpo grande demais')
    partes.push(buf)
  }
  const texto = Buffer.concat(partes).toString('utf8')
  if (!texto.trim()) return {}
  try {
    return JSON.parse(texto) as Record<string, unknown>
  } catch {
    throw new ErroHttp(400, 'corpo inválido')
  }
}

export function textoCurto(valor: unknown, limite = 500): string {
  return String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limite)
}

export function textoLongo(valor: unknown, limite = 4000): string {
  return String(valor ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, limite)
}

export function numeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

export function primeiro(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? valor[0] || '' : valor || ''
}
