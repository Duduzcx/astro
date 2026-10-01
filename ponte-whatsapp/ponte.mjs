/**
 * A ponte do WhatsApp pessoal.
 *
 * Liga o número pelo QR code, do mesmo jeito que o WhatsApp Web (é o
 * protocolo de aparelho conectado, via Baileys), e fala com o painel do site
 * no mesmo formato que a Evolution API — só o pedaço que o site usa: estado,
 * QR, lista de conversas, histórico de uma conversa, enviar texto. Nada de
 * Docker nem banco: os dados ficam em `dados/` ao lado deste arquivo.
 *
 * Roda no seu PC ou em qualquer servidor com Node. No PC, abre sozinha um
 * túnel público (Cloudflare, sem conta) e avisa o site do endereço; o site
 * guarda e passa a chamar a ponte por ele. O endereço muda a cada vez que a
 * ponte sobe, e é por isso que ela se registra sozinha, na subida e de dez
 * em dez minutos.
 *
 * Segurança: toda chamada precisa do cabeçalho `apikey` igual a PONTE_CHAVE,
 * que é a mesma EVOLUTION_API_KEY cadastrada na Vercel. Quem não tem a chave
 * recebe 401 antes de qualquer coisa.
 *
 * O que o site recebe: cada mensagem nova (sua ou da outra pessoa) vai para
 * o webhook do site como `messages.upsert`, no formato da Evolution. O site
 * decide sozinho o que responder — só conversas que você marcou no painel.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  /* Apelidada: o nome original começa com "use" e o lint a confunde com um
     hook do React, que ela não é. */
  useMultiFileAuthState as estadoDeAutenticacao,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import QRCode from 'qrcode'
import { Tunnel, bin, install } from 'cloudflared'

const RAIZ = path.dirname(fileURLToPath(import.meta.url))

/** Lê o .env ao lado, sem dependência: CHAVE=valor por linha, # comenta. */
function lerEnv(caminho) {
  const saida = {}
  if (!fs.existsSync(caminho)) return saida
  for (const linha of fs.readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const limpa = linha.trim()
    if (!limpa || limpa.startsWith('#')) continue
    const i = limpa.indexOf('=')
    if (i < 0) continue
    saida[limpa.slice(0, i).trim()] = limpa
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return saida
}

const env = { ...lerEnv(path.join(RAIZ, '.env')), ...process.env }
const SITE = (env.SITE_URL || 'https://astrosolucoes.vercel.app').replace(/\/+$/, '')
const CHAVE = env.PONTE_CHAVE || ''
const INSTANCIA = env.INSTANCIA || 'astro-pessoal'
/* PORT (maiúsculo) é o que os hospedeiros injetam (Fly, Render, Railway);
   PORTA é o nome local. No servidor, o próprio host dá o endereço público,
   então URL_PUBLICA é definida e o túnel não sobe. */
const PORTA = Number(env.PORT || env.PORTA || 3777)
const SEM_TUNEL = env.SEM_TUNEL === '1'
const URL_FIXA = (env.URL_PUBLICA || '').replace(/\/+$/, '')
/* PASTA_DADOS: outra pasta de sessão, para testar sem mexer na sessão de verdade. */
const DADOS = env.PASTA_DADOS || path.join(RAIZ, 'dados')

if (CHAVE.length < 16) {
  console.error('PONTE_CHAVE ausente ou curta demais no .env (mínimo 16 caracteres). Veja .env.exemplo.')
  process.exit(1)
}
fs.mkdirSync(DADOS, { recursive: true })

/* O diário: cada evento que importa vai para o terminal e para
   dados/eventos.log, e as últimas linhas saem em GET /diagnostico. Sem isto a
   primeira ligação não recebeu a lista de conversas e não havia como saber
   por quê. */
const ARQUIVO_EVENTOS = path.join(DADOS, 'eventos.log')
const eventos = []
function registrarEvento(texto) {
  const linha = `${new Date().toISOString()} ${texto}`
  console.log(linha)
  eventos.push(linha)
  if (eventos.length > 300) eventos.shift()
  fs.appendFile(ARQUIVO_EVENTOS, linha + '\n', () => undefined)
}

/* ------------------------------------------------------------------------
   A loja: conversas, nomes e as últimas mensagens de cada conversa. Vive em
   memória e cai num arquivo, para a lista sobreviver a uma reinicialização
   (o WhatsApp só manda o histórico na primeira ligação). */
const ARQUIVO_LOJA = path.join(DADOS, 'loja.json')
const POR_CONVERSA = 200
const VERSAO = '2026-09-30f'
const loja = { conversas: new Map(), nomes: new Map(), mensagens: new Map() }
/* Status de entrega, no nome que o WhatsApp usa: 0 erro, 1 pendente (não
   saiu), 2 no servidor, 3 entregue no aparelho, 4 lida, 5 tocada. */
const STATUS = ['ERRO', 'PENDENTE', 'SERVIDOR', 'ENTREGUE', 'LIDA', 'TOCADA']
function nomeDoStatus(v) {
  if (typeof v === 'number') return STATUS[v] || String(v)
  const s = String(v || '')
  return { PENDING: 'PENDENTE', SERVER_ACK: 'SERVIDOR', DELIVERY_ACK: 'ENTREGUE', READ: 'LIDA', PLAYED: 'TOCADA', ERROR: 'ERRO' }[s] || s
}
/* Só a contagem por status dos últimos envios: diz se as mensagens estão
   saindo (servidor/entregue) ou presas (pendente), sem expor número nem texto. */
function resumoDosEnvios() {
  const todas = []
  for (const lista of loja.mensagens.values()) for (const m of lista) if (m?.key?.fromMe) todas.push(m)
  todas.sort((a, b) => numero(a.messageTimestamp) - numero(b.messageTimestamp))
  const contagem = {}
  for (const m of todas.slice(-50)) {
    const n = nomeDoStatus(m.status)
    contagem[n] = (contagem[n] || 0) + 1
  }
  return { ultimos: Math.min(50, todas.length), porStatus: contagem }
}

/* O conteúdo das últimas mensagens que a ponte enviou, por id. Quando o
   celular de quem recebe não consegue decifrar ("Aguardando mensagem. Essa
   ação pode levar alguns instantes"), ele pede o reenvio, e a Baileys só
   reenvia se `getMessage` devolver o conteúdo original. Sem isto, a mensagem
   ficava presa para sempre, inclusive no seu próprio celular. */
const enviadas = new Map()
function lembrarEnviada(info) {
  const id = info?.key?.id
  if (!id || !info?.message) return
  enviadas.set(id, info.message)
  if (enviadas.size > 500) enviadas.delete(enviadas.keys().next().value)
}
/* Envia como uma pessoa: lê antes (3 a 6 s), mostra "digitando" num tempo
   proporcional ao texto (2,5 a 10 s), manda, e entre balões espera mais um
   pouco. Uma fila por conversa, para dois pedidos não se cruzarem. O site
   recebe 202 na hora: a espera acontece aqui, não na função da Vercel. */
const filasDeEnvio = new Map()
const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function enviarComoGente(jid, partes) {
  const anterior = filasDeEnvio.get(jid) || Promise.resolve()
  const tarefa = anterior.then(async () => {
    await pausa(3000 + Math.random() * 3000)
    for (const [i, parte] of partes.entries()) {
      if (!sock || estado !== 'conectado') return registrarEvento('envio adiado perdido: número não conectado')
      const digitando = Math.min(10000, Math.max(2500, parte.length * 55))
      await sock.sendPresenceUpdate('composing', jid).catch(() => {})
      await pausa(digitando)
      try {
        const enviada = await sock.sendMessage(jid, { text: parte })
        lembrarEnviada(enviada)
      } catch (erro) {
        registrarEvento(`envio falhou: ${erro?.message}`)
      }
      await sock.sendPresenceUpdate('paused', jid).catch(() => {})
      if (i < partes.length - 1) await pausa(2500 + Math.random() * 2500)
    }
  })
  filasDeEnvio.set(jid, tarefa.catch(() => {}))
  await tarefa
}

function conteudoDaMensagem(key) {
  const id = String(key?.id || '')
  if (!id) return undefined
  if (enviadas.has(id)) return enviadas.get(id)
  for (const lista of loja.mensagens.values()) {
    const achada = lista.find((m) => m?.key?.id === id)
    if (achada?.message) return achada.message
  }
  return undefined
}

const numero = (valor) =>
  typeof valor === 'number' ? valor : valor && typeof valor === 'object' ? Number(valor.low ?? valor) || 0 : Number(valor) || 0

/* O WhatsApp passou a identificar contatos por um id próprio (@lid) além do
   telefone. A ponte aprende o par lid → telefone com o que chega (contatos
   do histórico e chaves de mensagem com o telefone ao lado) e traduz na
   hora de guardar. Um @lid ainda sem tradução fica de fora até aparecer. */
const lidParaTelefone = new Map()
const aprenderLid = (lid, telefone) => {
  if (lid && telefone && String(lid).endsWith('@lid') && String(telefone).endsWith('@s.whatsapp.net')) {
    lidParaTelefone.set(String(lid), String(telefone))
    if (lidParaTelefone.size > 5000) lidParaTelefone.delete(lidParaTelefone.keys().next().value)
  }
}

/** Um jid de pessoa, no formato de telefone. Grupos e avisos ficam de fora. */
function jidDePessoa(chave) {
  let jid = String(chave?.remoteJid || '')
  if (jid.endsWith('@lid')) {
    const alternativo = String(chave?.remoteJidAlt || chave?.senderPn || '')
    if (alternativo.endsWith('@s.whatsapp.net')) aprenderLid(jid, alternativo)
    jid = alternativo || lidParaTelefone.get(jid) || ''
  }
  if (!jid.endsWith('@s.whatsapp.net')) return null
  return jid
}

/** Uma mensagem do Baileys vira um objeto simples, com o relógio em segundos. */
function simplificar(m) {
  const plana = JSON.parse(JSON.stringify(m))
  plana.messageTimestamp = numero(m.messageTimestamp)
  return plana
}

/* Só a FORMA das últimas mensagens (o sufixo do id e quais campos existem),
   nunca número nem texto: é o que diz por que jidDePessoa rejeitou. */
const estruturas = []
function anotarEstrutura(m, aceito) {
  const jid = String(m?.key?.remoteJid || '')
  const sufixo = jid.includes('@') ? '@' + jid.split('@')[1] : '(sem @)'
  estruturas.push({
    sufixo,
    temAlt: Boolean(m?.key?.remoteJidAlt),
    temSenderPn: Boolean(m?.key?.senderPn),
    temParticipant: Boolean(m?.key?.participant),
    temParticipantPn: Boolean(m?.key?.participantPn),
    fromMe: Boolean(m?.key?.fromMe),
    tipos: Object.keys(m?.message || {}).slice(0, 3),
    aceito,
  })
  if (estruturas.length > 20) estruturas.shift()
}

function guardarMensagem(m, avisar) {
  const jid = jidDePessoa(m.key)
  anotarEstrutura(m, Boolean(jid && m.message))
  if (!jid || !m.message) return
  const plana = { ...simplificar(m), key: { ...simplificar(m).key, remoteJid: jid } }
  const lista = loja.mensagens.get(jid) || []
  if (lista.some((x) => x.key.id === plana.key.id)) return
  lista.push(plana)
  lista.sort((a, b) => a.messageTimestamp - b.messageTimestamp)
  loja.mensagens.set(jid, lista.slice(-POR_CONVERSA))
  const conversa = loja.conversas.get(jid) || { id: jid }
  if (!plana.key.fromMe && plana.pushName) conversa.nome = plana.pushName
  conversa.quando = Math.max(conversa.quando || 0, plana.messageTimestamp)
  loja.conversas.set(jid, conversa)
  agendarGravacao()
  if (avisar) void encaminharAoSite(m, plana)
}

let gravacao = 0
function agendarGravacao() {
  clearTimeout(gravacao)
  gravacao = setTimeout(() => {
    const dados = {
      conversas: [...loja.conversas.values()],
      nomes: [...loja.nomes.entries()],
      mensagens: Object.fromEntries(loja.mensagens),
    }
    fs.writeFile(ARQUIVO_LOJA, JSON.stringify(dados), () => undefined)
  }, 2000)
}

function carregarLoja() {
  if (!fs.existsSync(ARQUIVO_LOJA)) return
  try {
    const dados = JSON.parse(fs.readFileSync(ARQUIVO_LOJA, 'utf8'))
    for (const c of dados.conversas || []) loja.conversas.set(c.id, c)
    for (const [jid, nome] of dados.nomes || []) loja.nomes.set(jid, nome)
    for (const [jid, lista] of Object.entries(dados.mensagens || {})) loja.mensagens.set(jid, lista)
  } catch {
    console.warn('loja.json ilegível; começando do zero')
  }
}
carregarLoja()

/* ------------------------------------------------------------------------
   O site: webhook das mensagens e registro do endereço público. */
let webhook = `${SITE}/api/crm/whatsapp/webhook/${encodeURIComponent(INSTANCIA)}`
let urlPublica = URL_FIXA

/* Áudio de quem responde: baixa e manda junto (base64) para o site
   transcrever e responder ao conteúdo. Só de fora (não fromMe), até 2 MB.
   Se não baixar, o site recebe a mensagem sem o áudio e pede por texto. */
const ESPERA_PARA_JUNTAR = 8000
const aguardando = new Map()
function textoSimples(plana) {
  const msg = plana?.message || {}
  return String(msg.conversation || msg.extendedTextMessage?.text || '').trim()
}

async function encaminharAoSite(m, plana) {
  /* Texto de quem responde: junta o que chegar nos próximos 8 s ("Boa
     tarde", "Tudo bem?") e manda uma vez só, com o id da última. Áudio e
     mensagens do dono vão na hora. */
  const textoRecebido = !plana?.key?.fromMe ? textoSimples(plana) : ''
  if (textoRecebido) {
    const jid = String(plana.key.remoteJid || '')
    const fila = aguardando.get(jid) || { textos: [], ultima: plana, temporizador: null }
    fila.textos.push(textoRecebido)
    fila.ultima = plana
    clearTimeout(fila.temporizador)
    fila.temporizador = setTimeout(() => {
      aguardando.delete(jid)
      void avisarSite('messages.upsert', { ...fila.ultima, message: { conversation: fila.textos.join('\n') } })
    }, ESPERA_PARA_JUNTAR)
    aguardando.set(jid, fila)
    return
  }
  let carga = plana
  const audio =
    m?.message?.audioMessage || m?.message?.ephemeralMessage?.message?.audioMessage || m?.message?.viewOnceMessage?.message?.audioMessage
  if (audio && !plana?.key?.fromMe && sock) {
    try {
      const buf = await downloadMediaMessage(m, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage })
      if (buf && buf.length <= 2 * 1024 * 1024) {
        carga = { ...plana, audioBase64: Buffer.from(buf).toString('base64'), audioMime: String(audio.mimetype || 'audio/ogg') }
      } else {
        registrarEvento('áudio grande demais para encaminhar (mais de 2 MB)')
      }
    } catch (erro) {
      registrarEvento(`áudio não baixou: ${erro?.message}`)
    }
  }
  await avisarSite('messages.upsert', carga)
}

async function avisarSite(evento, data) {
  try {
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CHAVE },
      body: JSON.stringify({ event: evento, instance: INSTANCIA, data }),
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) registrarEvento(`webhook do site respondeu ${r.status}`)
  } catch (erro) {
    registrarEvento(`webhook do site falhou: ${erro?.message}`)
  }
}

let registrada = false
async function registrarNoSite() {
  if (!urlPublica) return
  try {
    const r = await fetch(`${SITE}/api/crm/ponte/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CHAVE },
      body: JSON.stringify({ url: urlPublica, instancia: INSTANCIA }),
      signal: AbortSignal.timeout(15000),
    })
    const corpo = await r.json().catch(() => ({}))
    registrada = r.ok
    if (r.ok) registrarEvento(`registrada no site: ${urlPublica}`)
    else registrarEvento(`o site recusou o registro (${r.status}): ${corpo?.erro || ''} — confira EVOLUTION_API_KEY na Vercel`)
  } catch (erro) {
    registrada = false
    registrarEvento(`registro no site falhou: ${erro?.message}`)
  }
}

/* ------------------------------------------------------------------------
   O WhatsApp. */
let sock = null
let estado = 'desconectado'
let qrAtual = null
let meuNumero = null
let ligando = false
let reconectando = false

async function ligar() {
  if (ligando || sock) return
  ligando = true
  try {
    const { state, saveCreds } = await estadoDeAutenticacao(path.join(DADOS, 'auth'))
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }))
    const silencioso = pino({ level: 'silent' })
    /* Só avisos e erros da Baileys, no diário, sem números (mascarados) e
       sem texto de mensagem: é onde aparece por que um envio não sai. */
    const avisos = pino(
      { level: 'warn' },
      { write: (linha) => registrarEvento(`baileys: ${String(linha).replace(/\d{7,}/g, '…').slice(0, 240)}`) },
    )
    sock = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, silencioso) },
      logger: avisos,
      getMessage: async (key) => conteudoDaMensagem(key),
      /* Histórico completo DESLIGADO: medido duas vezes nesta conta, ligá-lo
         faz o WhatsApp derrubar a conexão com 428 em loop, sem nunca chegar
         ao QR. Desligado, o pareamento conecta e o telefone ainda manda um
         pacote com as conversas recentes (que é o que interessa para
         prospectar). HISTORICO_COMPLETO=1 religa, por sua conta e risco. */
      browser: env.NAVEGADOR === 'desktop' ? Browsers.macOS('Desktop') : Browsers.macOS('Chrome'),
      syncFullHistory: env.HISTORICO_COMPLETO === '1',
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    })
    estado = 'conectando'
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        qrAtual = await QRCode.toDataURL(qr)
        estado = 'aguardando_qr'
        registrarEvento('QR code novo. Leia no celular (WhatsApp → Aparelhos conectados) ou abra o painel do site.')
        console.log(await QRCode.toString(qr, { type: 'terminal', small: true }))
      }
      if (connection === 'open') {
        qrAtual = null
        estado = 'conectado'
        meuNumero = `+${String(sock.user?.id || '').split('@')[0].split(':')[0].replace(/\D/g, '')}`
        registrarEvento(`conectado como ${meuNumero}`)
        /* Puxa o estado do app (a lista de conversas e contatos) do telefone,
           já que o pacote de histórico automático não vem nesta conta. Cada
           faixa que volta vira `messaging-history.set`. Falhar não atrapalha. */
        setTimeout(() => {
          sock
            ?.resyncAppState(['critical_unblock_low', 'regular_high', 'regular_low', 'regular'], true)
            .then(() => registrarEvento('sincronia de conversas pedida ao telefone'))
            .catch((erro) => registrarEvento(`sincronia de conversas falhou: ${erro?.message}`))
        }, 4000)
        /* Se o pacote de histórico não vier em meio minuto, o diário diz —
           é o sintoma de "lista vazia", e a saída é desconectar e ligar de
           novo, ou mandar uma mensagem (a conversa entra ao chegar). */
        const conversasAntes = loja.conversas.size
        setTimeout(() => {
          if (estado === 'conectado' && loja.conversas.size === conversasAntes) {
            registrarEvento(`aviso: nenhum pacote de histórico em 30 s (${loja.conversas.size} conversas na loja). Se a lista ficar vazia, desconecte e leia o QR de novo.`)
          }
        }, 30000)
      }
      if (connection === 'close') {
        const codigo = lastDisconnect?.error?.output?.statusCode
        qrAtual = null
        if (codigo === DisconnectReason.loggedOut) {
          estado = 'desconectado'
          meuNumero = null
          registrarEvento('o número saiu (desconectado pelo celular ou pelo painel); preparando um QR novo')
          /* Sessão encerrada do outro lado: liga de novo, do zero, para o QR
             já estar pronto quando alguém abrir o painel. A ordem importa:
             primeiro solta o soquete velho e o seu gravador de credenciais,
             só depois apaga a pasta — senão a gravação atrasada das
             credenciais mortas ressuscitava a sessão encerrada, e a ponte
             entrava em círculo de "o número saiu" a cada três segundos. */
          const velho = sock
          sock = null
          velho?.ev.removeAllListeners('creds.update')
          setTimeout(() => {
            fs.rmSync(path.join(DADOS, 'auth'), { recursive: true, force: true })
            void ligar()
          }, 1500)
          return
        } else {
          estado = 'conectando'
          const velho = sock
          sock = null
          velho?.ev.removeAllListeners()
          /* Uma reconexão pendente por vez: o 428 chega em rajada (vários
             "close" por segundo), e sem esta trava cada um agendava um
             `ligar()`, empilhando dezenas de tentativas que martelavam o
             WhatsApp e realimentavam o próprio 428. */
          if (!reconectando) {
            reconectando = true
            registrarEvento(`conexão caiu (${codigo || 'sem código'}); tentando de novo em 5s`)
            setTimeout(() => {
              reconectando = false
              ligando = false
              void ligar()
            }, 5000)
          }
          return
        }
      }
    })
    /* As confirmações (saiu do servidor, entregou, leu) chegam depois do
       envio; sem isto o registro ficava "PENDENTE" para sempre e não dava
       para saber se a mensagem saiu. */
    sock.ev.on('messages.update', (atualizacoes) => {
      let mudou = false
      for (const { key, update } of atualizacoes || []) {
        if (update?.status == null || !key?.id) continue
        const jid = jidDePessoa(key)
        const lista = jid ? loja.mensagens.get(jid) : null
        const m = lista?.find((x) => x?.key?.id === key.id)
        if (m) {
          m.status = nomeDoStatus(update.status)
          mudou = true
        }
      }
      if (mudou) agendarGravacao()
    })
    sock.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest, progress }) => {
      registrarEvento(`histórico: ${(chats || []).length} conversas, ${(contacts || []).length} contatos, ${(messages || []).length} mensagens${isLatest ? ' (último pacote)' : ''}${progress != null ? ` ${progress}%` : ''}`)
      for (const c of contacts || []) aprenderLid(c.lid, c.id)
      for (const c of chats || []) {
        aprenderLid(c.lidJid || c.lid, c.pnJid || c.id)
        const jid = jidDePessoa({ remoteJid: c.id })
        if (!jid) continue
        const atual = loja.conversas.get(jid) || { id: jid }
        if (c.name) atual.nome = c.name
        atual.quando = Math.max(atual.quando || 0, numero(c.conversationTimestamp))
        loja.conversas.set(jid, atual)
      }
      for (const c of contacts || []) if (c.id && (c.name || c.notify)) loja.nomes.set(c.id, c.name || c.notify)
      for (const m of messages || []) guardarMensagem(m, false)
      agendarGravacao()
      registrarEvento(`na loja agora: ${loja.conversas.size} conversas com telefone, ${lidParaTelefone.size} ids traduzidos`)
    })
    sock.ev.on('contacts.upsert', (lista) => {
      for (const c of lista || []) if (c.id && (c.name || c.notify)) loja.nomes.set(c.id, c.name || c.notify)
    })
    sock.ev.on('messages.upsert', ({ messages, type }) => {
      registrarEvento(`mensagens: ${(messages || []).length} (${type})`)
      for (const m of messages || []) guardarMensagem(m, type === 'notify')
    })
    sock.ev.on('chats.upsert', (lista) => {
      for (const c of lista || []) {
        aprenderLid(c.lidJid || c.lid, c.pnJid || c.id)
        const jid = jidDePessoa({ remoteJid: c.id })
        if (!jid) continue
        const atual = loja.conversas.get(jid) || { id: jid }
        if (c.name) atual.nome = c.name
        atual.quando = Math.max(atual.quando || 0, numero(c.conversationTimestamp))
        loja.conversas.set(jid, atual)
      }
      agendarGravacao()
    })
  } finally {
    ligando = false
  }
}

/* ------------------------------------------------------------------------
   A API que o site chama (o pedaço da Evolution que ele usa). */
const textoDaMensagem = (m) => {
  const c = m?.message || {}
  return c.conversation || c.extendedTextMessage?.text || c.imageMessage?.caption || c.videoMessage?.caption || ''
}

function listaDeConversas() {
  return [...loja.conversas.values()]
    .map((c) => {
      const mensagens = loja.mensagens.get(c.id) || []
      const ultima = mensagens[mensagens.length - 1] || null
      return {
        id: c.id,
        remoteJid: c.id,
        name: c.nome || loja.nomes.get(c.id) || '',
        pushName: c.nome || loja.nomes.get(c.id) || '',
        lastMessage: ultima,
        updatedAt: new Date((c.quando || ultima?.messageTimestamp || 0) * 1000).toISOString(),
      }
    })
    /* Mostra a conversa se ela tem um nome OU uma última mensagem de texto:
       o pareamento pode trazer a conversa (com nome) antes de qualquer
       mensagem, e exigir texto a escondia. */
    .filter((c) => c.name || (c.lastMessage && textoDaMensagem(c.lastMessage)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function corpo(req) {
  return new Promise((resolve, reject) => {
    const partes = []
    let tamanho = 0
    req.on('data', (p) => {
      tamanho += p.length
      if (tamanho > 512 * 1024) {
        reject(new Error('corpo grande demais'))
        req.destroy()
        return
      }
      partes.push(p)
    })
    req.on('end', () => {
      const texto = Buffer.concat(partes).toString('utf8')
      try {
        resolve(texto.trim() ? JSON.parse(texto) : {})
      } catch {
        reject(new Error('corpo inválido'))
      }
    })
    req.on('error', reject)
  })
}

const responder = (res, codigo, dados) => {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(dados))
}

async function tratar(req, res) {
  const url = new URL(req.url || '/', 'http://ponte')
  const partes = url.pathname.split('/').filter(Boolean)
  if (partes.length === 0) {
    return responder(res, 200, { ok: true, ponte: 'astro', estado, numero: meuNumero, publica: urlPublica || null })
  }
  if (String(req.headers.apikey || '') !== CHAVE) return responder(res, 401, { erro: 'chave inválida' })

  const [a, b] = partes
  try {
    if (a === 'diagnostico') {
      return responder(res, 200, {
        estado,
        numero: meuNumero,
        publica: urlPublica || null,
        registradaNoSite: registrada,
        versao: VERSAO,
        envios: resumoDosEnvios(),
        webhook,
        conversas: loja.conversas.size,
        mensagens: [...loja.mensagens.values()].reduce((n, l) => n + l.length, 0),
        idsTraduzidos: lidParaTelefone.size,
        estruturas,
        eventos: eventos.slice(-40),
      })
    }
    if (a === 'instance' && b === 'create' && req.method === 'POST') {
      const dados = await corpo(req)
      if (dados?.webhook?.url) webhook = String(dados.webhook.url)
      if (!sock) void ligar()
      return responder(res, 201, { instance: { instanceName: INSTANCIA, status: estado } })
    }
    if (a === 'webhook' && b === 'set' && req.method === 'POST') {
      const dados = await corpo(req)
      if (dados?.webhook?.url) webhook = String(dados.webhook.url)
      return responder(res, 200, { ok: true })
    }
    if (a === 'instance' && b === 'connect') {
      if (estado === 'conectado') return responder(res, 200, { instance: { state: 'open' } })
      if (!sock) void ligar()
      /* Espera o QR nascer (uns dois segundos depois de ligar), até oito:
         responder "conectando" sem QR fazia o painel voltar sem nada, e o
         clique em Conectar parecia não fazer nada. */
      for (let espera = 0; !qrAtual && estado !== 'conectado' && espera < 32; espera += 1) {
        await new Promise((r) => setTimeout(r, 250))
      }
      if (estado === 'conectado') return responder(res, 200, { instance: { state: 'open' } })
      if (qrAtual) return responder(res, 200, { base64: qrAtual, code: 'qr' })
      return responder(res, 200, { instance: { state: 'connecting' } })
    }
    if (a === 'instance' && b === 'connectionState') {
      const state = estado === 'conectado' ? 'open' : estado === 'desconectado' ? 'close' : 'connecting'
      return responder(res, 200, {
        instance: { instanceName: INSTANCIA, state, ownerJid: meuNumero ? `${meuNumero.slice(1)}@s.whatsapp.net` : undefined },
      })
    }
    if (a === 'instance' && b === 'fetchInstances') {
      return responder(res, 200, [{ instance: { instanceName: INSTANCIA, ownerJid: meuNumero ? `${meuNumero.slice(1)}@s.whatsapp.net` : undefined } }])
    }
    if (a === 'instance' && (b === 'logout' || b === 'delete')) {
      const velho = sock
      sock = null
      estado = 'desconectado'
      meuNumero = null
      qrAtual = null
      if (velho) {
        velho.ev.removeAllListeners('creds.update')
        await velho.logout().catch(() => undefined)
      }
      registrarEvento('número desconectado pelo painel; preparando um QR novo')
      /* Já liga de novo: o QR fica pronto para o próximo clique em Conectar.
         A pasta só é apagada depois de o soquete velho sair, pelo mesmo
         motivo do desligamento pelo celular. */
      setTimeout(() => {
        fs.rmSync(path.join(DADOS, 'auth'), { recursive: true, force: true })
        void ligar()
      }, 1500)
      return responder(res, 200, { ok: true })
    }
    if (a === 'message' && b === 'sendText' && req.method === 'POST') {
      if (estado !== 'conectado' || !sock) return responder(res, 409, { erro: 'número não conectado' })
      const dados = await corpo(req)
      const digitos = String(dados?.number || '').replace(/\D/g, '')
      const texto = String(dados?.text || '')
      if (!digitos || !texto) return responder(res, 400, { erro: 'number e text são obrigatórios' })
      const jid = `${digitos}@s.whatsapp.net`
      /* Linha em branco separa balões (no máximo três). A espera de gente
         acontece em segundo plano; o site não fica preso. */
      const partes = texto
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 3)
      void enviarComoGente(jid, partes)
      return responder(res, 202, { agendado: true, partes: partes.length })
    }
    /* Evolution-compatível: quais destes números têm WhatsApp. Mandar para
       número sem WhatsApp é sinal de spam; o site pergunta antes de abordar. */
    if (a === 'chat' && b === 'whatsappNumbers' && req.method === 'POST') {
      if (estado !== 'conectado' || !sock) return responder(res, 409, { erro: 'número não conectado' })
      const dados = await corpo(req)
      const numeros = (Array.isArray(dados?.numbers) ? dados.numbers : [])
        .map((n) => String(n).replace(/\D/g, ''))
        .filter(Boolean)
        .slice(0, 20)
      const achados = (await sock.onWhatsApp(...numeros.map((n) => `${n}@s.whatsapp.net`)).catch(() => [])) || []
      return responder(
        res,
        200,
        numeros.map((n) => ({ number: n, exists: achados.some((x) => x?.exists && String(x?.jid || '').replace(/\D/g, '').startsWith(n)) })),
      )
    }
    if (a === 'chat' && b === 'findChats' && req.method === 'POST') {
      return responder(res, 200, listaDeConversas())
    }
    if (a === 'chat' && b === 'findMessages' && req.method === 'POST') {
      const dados = await corpo(req)
      const jid = jidDePessoa({ remoteJid: String(dados?.where?.key?.remoteJid || '') })
      const limite = Math.min(Math.max(Number(dados?.limit) || 40, 1), POR_CONVERSA)
      const lista = jid ? loja.mensagens.get(jid) || [] : []
      return responder(res, 200, lista.slice(-limite))
    }
    return responder(res, 404, { erro: 'rota desconhecida' })
  } catch (erro) {
    return responder(res, 500, { erro: erro?.message || 'falhou' })
  }
}

/* ------------------------------------------------------------------------
   Sobe tudo: o servidor, o WhatsApp, o túnel e o registro. */
const servidor = http.createServer((req, res) => void tratar(req, res))
servidor.listen(PORTA, '0.0.0.0', async () => {
  console.log(`ponte na porta ${PORTA}; instância ${INSTANCIA}; site ${SITE}`)
  void ligar()
  if (SEM_TUNEL) return
  if (!urlPublica) {
    try {
      if (!fs.existsSync(bin)) {
        console.log('baixando o cloudflared (uma vez só)…')
        await install(bin)
      }
    } catch (erro) {
      registrarEvento(`não foi possível baixar o cloudflared: ${erro?.message} — defina URL_PUBLICA no .env se a ponte já tem endereço.`)
    }
    /* O túnel rápido cai de vez em quando (rede, PC dormindo). Reabre com
       espera crescente e registra o endereço novo; sem isto a ponte ficava
       viva mas inalcançável até alguém reiniciá-la. */
    let espera = 5000
    const abrirTunel = () => {
      try {
        const tunel = Tunnel.quick(`http://localhost:${PORTA}`)
        tunel.on('url', (url) => {
          urlPublica = String(url).replace(/\/+$/, '')
          registrada = false
          espera = 5000
          registrarEvento(`túnel aberto: ${urlPublica}`)
          void registrarNoSite()
        })
        tunel.on('error', (erro) => registrarEvento(`túnel: ${erro?.message}`))
        tunel.on('exit', () => {
          urlPublica = ''
          registrada = false
          registrarEvento(`o túnel fechou; reabrindo em ${espera / 1000}s`)
          setTimeout(abrirTunel, espera)
          espera = Math.min(espera * 2, 120000)
        })
      } catch (erro) {
        registrarEvento(`não foi possível abrir o túnel: ${erro?.message}; tentando em ${espera / 1000}s`)
        setTimeout(abrirTunel, espera)
        espera = Math.min(espera * 2, 120000)
      }
    }
    abrirTunel()
  } else {
    void registrarNoSite()
  }
  /* Insiste a cada 30s até o site aceitar (a variável na Vercel pode ter
     entrado depois de a ponte subir); aceito, confirma de dez em dez minutos. */
  setInterval(() => {
    if (!registrada) void registrarNoSite()
  }, 30 * 1000)
  setInterval(() => void registrarNoSite(), 10 * 60 * 1000)
  /* Quem parou de responder ganha um empurrão do site, uma vez só. A ponte
     pede a cada dez minutos porque está sempre ligada; a Vercel grátis só
     tem cron diário. */
  setInterval(() => {
    if (estado !== 'conectado') return
    fetch(`${SITE}/api/crm/ponte/retomar`, { method: 'POST', headers: { apikey: CHAVE }, signal: AbortSignal.timeout(60000) })
      .then((r) => r.json())
      .then((d) => {
        if (d?.retomadas) registrarEvento(`conversas retomadas pelo site: ${d.retomadas}`)
      })
      .catch(() => {})
  }, 10 * 60 * 1000)
})
