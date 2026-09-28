
import { somenteDigitos } from './bot/util.js'

/**
 * Cliente da Evolution API (v2), o robô de WhatsApp aberto que conecta um
 * número por QR code. Uma instância por clínica.
 *
 * O envio de opções vai como texto numerado, sempre. Botões de verdade
 * existem na API, mas o WhatsApp deixou de renderizá-los para contas comuns
 * em boa parte dos aparelhos; uma lista "1) 2) 3)" chega em todos, e o
 * motor entende tanto o número quanto o texto da opção na volta.
 */

                                                                     

const EVENTOS = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE']

function traduzirEstado(bruto         )                  {
  const s = String(bruto || '').toLowerCase()
  if (s === 'open' || s === 'connected') return 'conectado'
  if (s === 'connecting' || s === 'qr' || s === 'qrcode') return 'aguardando_qr'
  return 'desconectado'
}

function numeroDoJid(jid         )                {
  const d = somenteDigitos(String(jid || '').split('@')[0] || '')
  return d ? `+${d}` : null
}

export function criarEvolution(env                                                            )                   {
  const base = (env.EVOLUTION_API_URL || '').replace(/\/+$/, '')
  const chave = env.EVOLUTION_API_KEY || ''
  if (!base || !chave) return null

  const pedir = async (caminho        , opcoes              = {}, prazo = 15000) => {
    const r = await fetch(`${base}${caminho}`, {
      ...opcoes,
      headers: { apikey: chave, 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
      signal: AbortSignal.timeout(prazo),
    })
    const texto = await r.text()
    let corpo          = null
    try {
      corpo = texto ? JSON.parse(texto) : null
    } catch {
      corpo = texto
    }
    if (!r.ok) throw new Error(`evolution ${caminho} ${r.status}: ${texto.slice(0, 200)}`)
    return corpo
  }

  const enviarTexto = async (nome        , numero        , texto        ) => {
    await pedir(`/message/sendText/${encodeURIComponent(nome)}`, {
      method: 'POST',
      body: JSON.stringify({ number: somenteDigitos(numero), text: texto, delay: 600, linkPreview: false }),
    })
  }

  return {
    async criarInstancia(nome, webhookUrl) {
      try {
        await pedir('/instance/create', {
          method: 'POST',
          body: JSON.stringify({
            instanceName: nome,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true,
            webhook: { url: webhookUrl, byEvents: false, base64: false, events: EVENTOS },
          }),
        })
      } catch (erro) {
        /* Já existe: segue para o webhook e a conexão. */
        if (!/403|already|exists|em uso|j[aá] existe/i.test(String(erro))) throw erro
      }
      await pedir(`/webhook/set/${encodeURIComponent(nome)}`, {
        method: 'POST',
        body: JSON.stringify({ webhook: { enabled: true, url: webhookUrl, webhookByEvents: false, webhookBase64: false, events: EVENTOS } }),
      }).catch(() => undefined)
    },

    async conectar(nome) {
      const corpo = await pedir(`/instance/connect/${encodeURIComponent(nome)}`)
      const base64 = typeof corpo?.base64 === 'string' ? corpo.base64 : typeof corpo?.code === 'string' && corpo.base64 === undefined ? null : null
      const instancia = corpo?.instance
      if (base64) return { estado: 'aguardando_qr', qr: base64.replace(/^data:image\/\w+;base64,/, '') }
      return { estado: traduzirEstado(instancia?.state || corpo?.state), qr: null }
    },

    async estado(nome) {
      /* Seis segundos: é a pergunta que o painel faz a toda abertura, e com
         a ponte fora do ar o túnel da Cloudflare demora a desistir. */
      const corpo = await pedir(`/instance/connectionState/${encodeURIComponent(nome)}`, {}, 6000)
      const instancia = (corpo?.instance || corpo)
      let numero                = numeroDoJid(instancia?.ownerJid || instancia?.wuid)
      if (!numero) {
        const lista = await pedir(`/instance/fetchInstances?instanceName=${encodeURIComponent(nome)}`).catch(() => null)
        const item = Array.isArray(lista) ? (lista[0]                           ) : (lista                                  )
        const dentro = (item?.instance                                       ) || item || {}
        numero = numeroDoJid(dentro.ownerJid || dentro.owner || dentro.wuid)
      }
      return { estado: traduzirEstado(instancia?.state), numero }
    },

    async desconectar(nome) {
      await pedir(`/instance/logout/${encodeURIComponent(nome)}`, { method: 'DELETE' }).catch(() => undefined)
    },

    async apagar(nome) {
      await pedir(`/instance/delete/${encodeURIComponent(nome)}`, { method: 'DELETE' }).catch(() => undefined)
    },

    enviarTexto,

    /** As conversas que existem no aparelho, como a Evolution as devolve. */
    async conversas(nome) {
      const corpo = await pedir(`/chat/findChats/${encodeURIComponent(nome)}`, { method: 'POST', body: '{}' })
      if (Array.isArray(corpo)) return corpo
      return Array.isArray(corpo?.chats) ? corpo.chats : []
    },

    /** As últimas mensagens de uma conversa (o formato varia entre versões da Evolution; aceita os dois). */
    async mensagens(nome, jid, limite = 40) {
      const corpo = await pedir(`/chat/findMessages/${encodeURIComponent(nome)}`, {
        method: 'POST',
        body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: limite }),
      })
      if (Array.isArray(corpo)) return corpo
      const registros = corpo?.messages?.records ?? corpo?.messages
      return Array.isArray(registros) ? registros : []
    },

    canal(nome) {
      return {
        enviarTexto: (numero, texto) => enviarTexto(nome, numero, texto),
        enviarOpcoes: (numero, texto, opcoes) =>
          enviarTexto(nome, numero, `${texto}\n\n${opcoes.map((o, i) => `${i + 1}) ${o}`).join('\n')}\n\nResponda com o número.`),
      }
    },
  }
}

/** O que interessa de um evento `messages.upsert`: quem, o quê, o id. */
export function lerMensagemDoWebhook(evento         )                                                                                              {
  const e = evento
  const dados = e?.data
  if (!dados) return null
  const chave = (dados.key || {})
  const jid = String(chave.remoteJid || '')
  if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') return null
  const m = (dados.message || {})
  const texto =
    (typeof m.conversation === 'string' && m.conversation) ||
    ((m.extendedTextMessage                                 )?.text ?? '') ||
    ((m.buttonsResponseMessage                                                )?.selectedDisplayText ?? '') ||
    ((m.listResponseMessage                                  )?.title ?? '') ||
    ((m.templateButtonReplyMessage                                                )?.selectedDisplayText ?? '') ||
    ''
  return {
    telefone: `+${somenteDigitos(jid.split('@')[0])}`,
    texto: String(texto).trim(),
    id: String(chave.id || ''),
    nomeExibido: String(dados.pushName || ''),
    deMim: Boolean(chave.fromMe),
  }
}
