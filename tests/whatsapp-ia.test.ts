import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'

/* O webhook com a inteligência ligada: a mensagem do paciente vira uma
   chamada ao modelo, com a instrução mestre, e o que o modelo responde volta
   pelo WhatsApp. Sem banco — é o caminho que a empresa vai ter no primeiro
   dia, antes da POSTGRES_URL. */

process.env.WHATSAPP_APP_SECRET = 'segredo-de-teste'
process.env.WHATSAPP_TOKEN = 'token-de-teste'
/* O apelido do painel da Meta: quem copia "Phone number ID" acerta. */
process.env.PHONE_NUMBER_ID = '999888'
process.env.ANTHROPIC_API_KEY = 'chave-de-teste'
delete process.env.WHATSAPP_PHONE_ID
delete process.env.POSTGRES_URL
delete process.env.DATABASE_URL

const { default: handler } = await import('../api/whatsapp.js')

type Chamada = { url: string; corpo: Record<string, unknown> }

function comFetchFalso(resposta: string | null) {
  const chamadas: Chamada[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const endereco = String(url)
    chamadas.push({ url: endereco, corpo: JSON.parse(String(init?.body)) })
    if (endereco.includes('anthropic')) {
      if (resposta === null) return new Response('cota estourada', { status: 429 })
      return new Response(JSON.stringify({ content: [{ type: 'text', text: resposta }] }), { status: 200 })
    }
    return new Response('{}', { status: 200 })
  }) as typeof fetch
  return { chamadas, restaurar: () => { globalThis.fetch = original } }
}

function requisicao(texto: string) {
  const corpo = JSON.stringify({
    entry: [{ changes: [{ value: { contacts: [{ profile: { name: 'Pessoa' } }], messages: [{ from: '5511999990000', text: { body: texto } }] } }] }],
  })
  const req = Object.assign(new EventEmitter(), {
    method: 'POST',
    headers: { 'x-hub-signature-256': 'sha256=' + crypto.createHmac('sha256', 'segredo-de-teste').update(corpo).digest('hex') },
    query: {},
  })
  process.nextTick(() => {
    req.emit('data', Buffer.from(corpo))
    req.emit('end')
  })
  return req
}

const resposta = () => {
  const r = { codigo: 0, status(n: number) { r.codigo = n; return r }, send() { return r }, json() { return r }, setHeader() {} }
  return r
}

test('a pergunta do cliente vai ao modelo com a instrução mestre, e a resposta volta pelo WhatsApp', async () => {
  const { chamadas, restaurar } = comFetchFalso('Dá para automatizar sim. Me conta o que sua equipe faz à mão hoje?')
  try {
    await handler(requisicao('vocês conseguem automatizar meu estoque?'), resposta())
    const aoModelo = chamadas.find((c) => c.url.includes('anthropic'))
    const aoWhatsApp = chamadas.find((c) => c.url.includes('graph.facebook.com'))
    assert.ok(aoModelo, 'o modelo foi consultado')
    assert.match(String(aoModelo.corpo.system), /nunca invente preço, prazo/i)
    assert.match(String(aoModelo.corpo.system), /CANAL: WhatsApp/)
    assert.deepEqual(aoModelo.corpo.messages, [{ role: 'user', content: 'vocês conseguem automatizar meu estoque?' }])
    assert.ok(aoWhatsApp, 'a resposta foi enviada')
    /* O apelido PHONE_NUMBER_ID vale tanto quanto WHATSAPP_PHONE_ID. */
    assert.match(aoWhatsApp.url, /999888\/messages$/)
    assert.equal((aoWhatsApp.corpo.text as { body: string }).body, 'Dá para automatizar sim. Me conta o que sua equipe faz à mão hoje?')
  } finally {
    restaurar()
  }
})

test('modelo fora do ar cai no roteiro, e ninguém fica sem resposta', async () => {
  const { chamadas, restaurar } = comFetchFalso(null)
  try {
    await handler(requisicao('quanto custa um sistema?'), resposta())
    const aoWhatsApp = chamadas.find((c) => c.url.includes('graph.facebook.com'))
    assert.ok(aoWhatsApp, 'respondeu mesmo com o modelo fora do ar')
    /* "quanto custa" é a opção 3 do roteiro: prazo e investimento. */
    assert.match((aoWhatsApp.corpo.text as { body: string }).body, /orçamento sai depois do diagnóstico/i)
  } finally {
    restaurar()
  }
})

test('resposta vazia do modelo também cai no roteiro', async () => {
  const { chamadas, restaurar } = comFetchFalso('   ')
  try {
    await handler(requisicao('oi'), resposta())
    const aoWhatsApp = chamadas.find((c) => c.url.includes('graph.facebook.com'))
    assert.match((aoWhatsApp!.corpo.text as { body: string }).body, /Astro Soluções/)
  } finally {
    restaurar()
  }
})
