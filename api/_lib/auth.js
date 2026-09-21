/**
 * Entrada no painel restrito.
 *
 * Uma senha só, guardada em `ADMIN_SENHA`, comparada em tempo constante. Para
 * uma equipe de duas ou três pessoas isso é adequado e honesto; o que NÃO
 * seria honesto é esconder a rota no cliente e chamar de proteção, porque
 * qualquer pessoa lê o JavaScript que é servido.
 *
 * O que sai da porta é um cookie assinado com HMAC, não a senha. Ele é
 * HttpOnly (JavaScript da página não lê, então XSS não rouba a sessão),
 * Secure (só por HTTPS), SameSite=Lax (não viaja em requisição de outro site,
 * o que corta CSRF nas rotas de escrita) e tem validade.
 *
 * O segredo de assinatura é `ADMIN_SEGREDO`. Sem ele a porta fica fechada:
 * cair para um segredo padrão seria deixar a fechadura sem segredo nenhum.
 */
import crypto from 'node:crypto'

const NOME_COOKIE = 'astro_sessao'
const VALIDADE_HORAS = 12

function segredo() {
  return process.env.ADMIN_SEGREDO || ''
}

function assinar(dados) {
  return crypto.createHmac('sha256', segredo()).update(dados).digest('base64url')
}

/** Compara em tempo constante, tolerando tamanhos diferentes. */
export function iguais(a, b) {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ba.length !== bb.length) {
    /* Ainda assim gasta o tempo de uma comparação, para o tamanho da senha
       não vazar pelo relógio. */
    crypto.timingSafeEqual(ba, ba)
    return false
  }
  return crypto.timingSafeEqual(ba, bb)
}

/** Tamanho mínimo da senha do painel. Abaixo disso a porta não abre. */
export const MINIMO_SENHA = 12

/**
 * Uma senha curta transforma qualquer limite de tentativas em teatro: com
 * seis caracteres, algumas horas de tentativas bastam. Em vez de confiar que
 * alguém vai ler a recomendação no documento, a porta simplesmente não abre.
 */
export function senhaForte() {
  return (process.env.ADMIN_SENHA || '').length >= MINIMO_SENHA
}

export function senhaConfere(tentativa) {
  const certa = process.env.ADMIN_SENHA || ''
  if (!certa || !segredo() || !senhaForte()) return false
  return iguais(tentativa, certa)
}

/** Monta o valor do cookie: validade + assinatura da validade. */
export function criarSessao() {
  const expira = Date.now() + VALIDADE_HORAS * 3600 * 1000
  const corpo = String(expira)
  return `${corpo}.${assinar(corpo)}`
}

export function sessaoValida(valor) {
  if (!valor || !segredo()) return false
  const ponto = valor.lastIndexOf('.')
  if (ponto < 1) return false
  const corpo = valor.slice(0, ponto)
  const assinatura = valor.slice(ponto + 1)
  if (!iguais(assinatura, assinar(corpo))) return false
  const expira = Number(corpo)
  return Number.isFinite(expira) && expira > Date.now()
}

export function cookieDeEntrada() {
  const max = VALIDADE_HORAS * 3600
  return `${NOME_COOKIE}=${criarSessao()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${max}`
}

export function cookieDeSaida() {
  return `${NOME_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

function lerCookies(req) {
  const cru = req.headers?.cookie || ''
  const saida = {}
  for (const parte of cru.split(';')) {
    const i = parte.indexOf('=')
    if (i < 1) continue
    saida[parte.slice(0, i).trim()] = parte.slice(i + 1).trim()
  }
  return saida
}

/**
 * Porteiro das rotas do painel. Devolve true se pode passar; caso contrário
 * já respondeu 401 e quem chamou deve apenas retornar.
 */
export function exigirSessao(req, res) {
  if (!segredo() || !process.env.ADMIN_SENHA) {
    res.status(503).json({ erro: 'painel não configurado', detalhe: 'faltam ADMIN_SENHA e ADMIN_SEGREDO' })
    return false
  }
  if (!sessaoValida(lerCookies(req)[NOME_COOKIE])) {
    res.status(401).json({ erro: 'não autorizado' })
    return false
  }
  return true
}

/**
 * De onde veio a tentativa, para a trava de força bruta.
 *
 * NÃO use o primeiro item de `x-forwarded-for`: esse cabeçalho é escrito por
 * quem chama, e quem está tentando adivinhar a senha manda um valor diferente
 * a cada requisição — a trava por origem nunca fecharia. Foi exatamente isto
 * que a revisão de segurança apontou.
 *
 * A ordem aqui é da fonte mais confiável para a menos: `x-vercel-forwarded-for`
 * é escrito pela própria Vercel e sobrescreve o que o cliente mandou;
 * `x-real-ip` vem do proxy; e, em último caso, o ÚLTIMO item da cadeia de
 * `x-forwarded-for`, que é o que o proxy mais próximo acrescentou — os
 * anteriores podem ser invenção.
 *
 * Mesmo assim a trava por origem não é a defesa principal: quem tem muitos
 * endereços contorna qualquer uma delas. Ver a espera global em sessao.js.
 */
export function origem(req) {
  const daVercel = req.headers['x-vercel-forwarded-for']
  if (daVercel) return String(Array.isArray(daVercel) ? daVercel[0] : daVercel).split(',')[0].trim().slice(0, 60)
  const doProxy = req.headers['x-real-ip']
  if (doProxy) return String(Array.isArray(doProxy) ? doProxy[0] : doProxy).trim().slice(0, 60)
  const cadeia = req.headers['x-forwarded-for']
  if (!cadeia) return ''
  const partes = String(Array.isArray(cadeia) ? cadeia[0] : cadeia).split(',')
  return partes[partes.length - 1].trim().slice(0, 60)
}
