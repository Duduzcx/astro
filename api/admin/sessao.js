/**
 * Porta do painel: entrar, sair e perguntar se já está dentro.
 *
 * POST  { senha }  entra
 * DELETE           sai
 * GET              diz se a sessão vale e o que está configurado
 *
 * A trava de força bruta usa a própria tabela do banco, em dois níveis: por
 * origem e global. A explicação de por que são dois está junto das
 * constantes, mais abaixo.
 */
import {
  cookieDeEntrada,
  cookieDeSaida,
  MINIMO_SENHA,
  origem,
  senhaConfere,
  senhaForte,
  sessaoValida,
} from '../_lib/auth.js'
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

/* Duas travas, e a segunda existe porque a primeira é contornável.

   A trava POR ORIGEM fecha em cinco erros. Ela cuida do caso comum — alguém
   tentando a senha de um lugar só — mas quem tem muitos endereços passa por
   ela, e foi este o furo que a revisão de segurança apontou.

   A trava GLOBAL não depende de nada que quem chama escolha, então nenhuma
   troca de endereço a levanta. Ela é folgada de propósito: quarenta erros em
   dez minutos é muito acima do que uma equipe de três pessoas produz, e
   segura um ataque em cerca de cinco mil tentativas por dia — nada contra as
   doze letras mínimas que a senha agora é obrigada a ter.

   Por que folgada e não apertada: uma trava global apertada seria um botão de
   desligar o painel à disposição de qualquer um. Preferi o teto alto somado à
   senha forte obrigatória, que é o que de fato impede a adivinhação. */
const ERROS_ATE_TRAVAR = 5
const ERROS_GLOBAIS_ATE_TRAVAR = 40
const JANELA = '10 minutes'

async function travas(de) {
  if (!temBanco()) return { porOrigem: false, global: false }
  await prepararBanco()
  const s = sql()
  const [linha] = await s`
    SELECT
      count(*) FILTER (WHERE ${de} <> '' AND origem = ${de})::int AS daOrigem,
      count(*)::int AS total
    FROM tentativas_login
    WHERE sucesso = false AND quando > now() - interval '${s.unsafe(JANELA)}'`
  return {
    porOrigem: (linha?.daorigem || 0) >= ERROS_ATE_TRAVAR,
    global: (linha?.total || 0) >= ERROS_GLOBAIS_ATE_TRAVAR,
  }
}

async function registrar(de, sucesso) {
  /* Registra mesmo sem origem conhecida. Pular o registro deixaria a trava
     global cega justamente para quem chega sem cabeçalho nenhum, que é o
     caminho que um atacante escolheria. */
  if (!temBanco()) return
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
  if (!senhaForte()) {
    /* A porta não abre com senha curta, e diz por quê: é melhor a equipe
       descobrir isto na primeira tentativa do que nunca. */
    return res.status(503).json({
      erro: 'senha do painel fraca demais',
      detalhe: `ADMIN_SENHA precisa de pelo menos ${MINIMO_SENHA} caracteres`,
    })
  }

  const de = origem(req)
  const trava = await travas(de)
  if (trava.porOrigem || trava.global) {
    return res.status(429).json({
      erro: 'muitas tentativas',
      detalhe: trava.global ? 'a porta está fechada por dez minutos' : 'espere dez minutos',
    })
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
