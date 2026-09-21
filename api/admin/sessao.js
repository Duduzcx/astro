/**
 * Porta do painel: entrar, sair e perguntar se já está dentro.
 *
 * POST  { senha }  entra
 * DELETE           sai
 * GET              diz se a sessão vale e o que está configurado
 *
 * A trava de força bruta usa a própria tabela do banco. Cinco erros vindos da
 * mesma origem em dez minutos fecham a porta por dez minutos. Sem isso, uma
 * senha de agência cai numa tarde de tentativas.
 */
import { cookieDeEntrada, cookieDeSaida, origem, senhaConfere, sessaoValida } from '../_lib/auth.js'
import { prepararBanco, sql, temBanco } from '../_lib/db.js'

export const config = { api: { bodyParser: false } }

function corpoCru(req) {
  return new Promise((resolve, reject) => {
    const partes = []
    let tamanho = 0
    req.on('data', (p) => {
      tamanho += p.length
      if (tamanho > 4096) {
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

function lerCookie(req, nome) {
  for (const parte of String(req.headers?.cookie || '').split(';')) {
    const i = parte.indexOf('=')
    if (i > 0 && parte.slice(0, i).trim() === nome) return parte.slice(i + 1).trim()
  }
  return ''
}

const ERROS_ATE_TRAVAR = 5
const JANELA = '10 minutes'

async function estaTravado(de) {
  if (!temBanco() || !de) return false
  await prepararBanco()
  const s = sql()
  const [linha] = await s`
    SELECT count(*)::int AS erros FROM tentativas_login
    WHERE origem = ${de} AND sucesso = false AND quando > now() - interval '${s.unsafe(JANELA)}'`
  return (linha?.erros || 0) >= ERROS_ATE_TRAVAR
}

async function registrar(de, sucesso) {
  if (!temBanco() || !de) return
  try {
    const s = sql()
    await s`INSERT INTO tentativas_login ${s({ origem: de, sucesso })}`
    /* Limpeza oportunista: a tabela existe para contar tentativas recentes,
       não para virar histórico eterno. */
    if (sucesso) await s`DELETE FROM tentativas_login WHERE quando < now() - interval '1 day'`
  } catch (erro) {
    console.error('registro de tentativa falhou:', erro?.message)
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      dentro: sessaoValida(lerCookie(req, 'astro_sessao')),
      configurado: Boolean(process.env.ADMIN_SENHA && process.env.ADMIN_SEGREDO),
      banco: temBanco(),
      whatsapp: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
      avisoEquipe: Boolean(process.env.EQUIPE_WHATSAPP),
    })
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookieDeSaida())
    return res.status(200).json({ ok: true })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ erro: 'método não permitido' })
  }

  if (!process.env.ADMIN_SENHA || !process.env.ADMIN_SEGREDO) {
    return res.status(503).json({ erro: 'painel não configurado', detalhe: 'faltam ADMIN_SENHA e ADMIN_SEGREDO' })
  }

  const de = origem(req)
  if (await estaTravado(de)) {
    return res.status(429).json({ erro: 'muitas tentativas', detalhe: 'espere dez minutos' })
  }

  let senha = ''
  try {
    senha = JSON.parse((await corpoCru(req)).toString('utf8'))?.senha || ''
  } catch {
    return res.status(400).json({ erro: 'corpo inválido' })
  }

  if (!senhaConfere(senha)) {
    await registrar(de, false)
    /* Uma espera curta e fixa: junto com a trava, tira a graça de tentar em
       massa, e por ser fixa não conta nada sobre a senha. */
    await new Promise((r) => setTimeout(r, 400))
    return res.status(401).json({ erro: 'senha incorreta' })
  }

  await registrar(de, true)
  res.setHeader('Set-Cookie', cookieDeEntrada())
  return res.status(200).json({ ok: true })
}
