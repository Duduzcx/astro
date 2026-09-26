import type { Canal } from './bot/tipos.ts'
import { somenteDigitos } from './bot/util.ts'

/**
 * Cliente da Evolution API (v2), o robô de WhatsApp aberto que conecta um
 * número por QR code. Uma instância por clínica.
 *
 * O envio de opções vai como texto numerado, sempre. Botões de verdade
 * existem na API, mas o WhatsApp deixou de renderizá-los para contas comuns
 * em boa parte dos aparelhos; uma lista "1) 2) 3)" chega em todos, e o
 * motor entende tanto o número quanto o texto da opção na volta.
 */
export type EstadoInstancia = 'desconectado' | 'aguardando_qr' | 'conectado'

export type Evolution = {
  criarInstancia(nome: string, webhookUrl: string): Promise<void>
  /** Devolve o QR (base64 de PNG, sem o prefixo data:) ou null se já conectada. */
  conectar(nome: string): Promise<{ estado: EstadoInstancia; qr: string | null }>
  estado(nome: string): Promise<{ estado: EstadoInstancia; numero: string | null }>
  desconectar(nome: string): Promise<void>
  apagar(nome: string): Promise<void>
  enviarTexto(nome: string, numero: string, texto: string): Promise<void>
  canal(nome: string): Canal
}

const EVENTOS = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE']

function traduzirEstado(bruto: unknown): EstadoInstancia {
  const s = String(bruto || '').toLowerCase()
  if (s === 'open' || s === 'connected') return 'conectado'
  if (s === 'connecting' || s === 'qr' || s === 'qrcode') return 'aguardando_qr'
  return 'desconectado'
}

function numeroDoJid(jid: unknown): string | null {
  const d = somenteDigitos(String(jid || '').split('@')[0] || '')
  return d ? `+${d}` : null
}

export function criarEvolution(env: { EVOLUTION_API_URL?: string; EVOLUTION_API_KEY?: string }): Evolution | null {
  const base = (env.EVOLUTION_API_URL || '').replace(/\/+$/, '')
  const chave = env.EVOLUTION_API_KEY || ''
  if (!base || !chave) return null

  const pedir = async (caminho: string, opcoes: RequestInit = {}) => {
    const r = await fetch(`${base}${caminho}`, {
      ...opcoes,
      headers: { apikey: chave, 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
      signal: AbortSignal.timeout(15000),
    })
    const texto = await r.text()
    let corpo: unknown = null
    try {
      corpo = texto ? JSON.parse(texto) : null
    } catch {
      corpo = texto
    }
    if (!r.ok) throw new Error(`evolution ${caminho} ${r.status}: ${texto.slice(0, 200)}`)
    return corpo as Record<string, unknown>
  }

  const enviarTexto = async (nome: string, numero: string, texto: string) => {
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
      const instancia = corpo?.instance as { state?: string } | undefined
      if (base64) return { estado: 'aguardando_qr', qr: base64.replace(/^data:image\/\w+;base64,/, '') }
      return { estado: traduzirEstado(instancia?.state || corpo?.state), qr: null }
    },

    async estado(nome) {
      const corpo = await pedir(`/instance/connectionState/${encodeURIComponent(nome)}`)
      const instancia = (corpo?.instance || corpo) as { state?: string; ownerJid?: string; wuid?: string }
      let numero: string | null = numeroDoJid(instancia?.ownerJid || instancia?.wuid)
      if (!numero) {
        const lista = await pedir(`/instance/fetchInstances?instanceName=${encodeURIComponent(nome)}`).catch(() => null)
        const item = Array.isArray(lista) ? (lista[0] as Record<string, unknown>) : (lista as Record<string, unknown> | null)
        const dentro = (item?.instance as Record<string, unknown> | undefined) || item || {}
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
export function lerMensagemDoWebhook(evento: unknown): { telefone: string; texto: string; id: string; nomeExibido: string; deMim: boolean } | null {
  const e = evento as { data?: Record<string, unknown> } | null
  const dados = e?.data
  if (!dados) return null
  const chave = (dados.key || {}) as { remoteJid?: string; fromMe?: boolean; id?: string }
  const jid = String(chave.remoteJid || '')
  if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') return null
  const m = (dados.message || {}) as Record<string, unknown>
  const texto =
    (typeof m.conversation === 'string' && m.conversation) ||
    ((m.extendedTextMessage as { text?: string } | undefined)?.text ?? '') ||
    ((m.buttonsResponseMessage as { selectedDisplayText?: string } | undefined)?.selectedDisplayText ?? '') ||
    ((m.listResponseMessage as { title?: string } | undefined)?.title ?? '') ||
    ((m.templateButtonReplyMessage as { selectedDisplayText?: string } | undefined)?.selectedDisplayText ?? '') ||
    ''
  return {
    telefone: `+${somenteDigitos(jid.split('@')[0])}`,
    texto: String(texto).trim(),
    id: String(chave.id || ''),
    nomeExibido: String(dados.pushName || ''),
    deMim: Boolean(chave.fromMe),
  }
}
