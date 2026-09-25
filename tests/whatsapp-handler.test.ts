import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'

/* O webhook inteiro, do jeito que a Meta o chama: corpo assinado, resposta
   200 na hora e a mensagem de volta pela Graph API. É o teste que faltava —
   o roteador (`entender`) já era testado, mas a montagem da resposta usava
   três constantes que não existiam mais, e um simples "oi" derrubava a
   função. Nenhum teste de roteamento pegaria isso. */

process.env.WHATSAPP_APP_SECRET = 'segredo-de-teste'
process.env.WHATSAPP_TOKEN = 'token-de-teste'
process.env.WHATSAPP_PHONE_ID = '123456'
delete process.env.POSTGRES_URL
delete process.env.DATABASE_URL

const { default: handler } = await import('../api/whatsapp.js')

type Envio = { url: string; corpo: { to: string; text: { body: string } } }

function comFetchFalso() {
  const envios: Envio[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    envios.push({ url: String(url), corpo: JSON.parse(String(init?.body)) })
    return new Response('{}', { status: 200 })
  }) as typeof fetch
  return { envios, restaurar: () => { globalThis.fetch = original } }
}

function requisicao(texto: string, de = '5511999990000') {
  const corpo = JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ profile: { name: 'Pessoa' } }],
              messages: [{ from: de, text: { body: texto } }],
            },
          },
        ],
      },
    ],
  })
  const assinatura = 'sha256=' + crypto.createHmac('sha256', 'segredo-de-teste').update(corpo).digest('hex')
  const req = Object.assign(new EventEmitter(), {
    method: 'POST',
    headers: { 'x-hub-signature-256': assinatura },
    query: {},
  })
  process.nextTick(() => {
    req.emit('data', Buffer.from(corpo))
    req.emit('end')
  })
  return req
}

function resposta() {
  const res = {
    codigo: 0,
    corpo: '' as unknown,
    status(n: number) {
      res.codigo = n
      return res
    },
    send(x: unknown) {
      res.corpo = x
      return res
    },
    json(x: unknown) {
      res.corpo = x
      return res
    },
  }
  return res
}

test('um cumprimento recebe as boas-vindas e o menu', async () => {
  const { envios, restaurar } = comFetchFalso()
  try {
    const res = resposta()
    await handler(requisicao('oi'), res)
    assert.equal(res.codigo, 200)
    assert.equal(envios.length, 1)
    assert.match(envios[0].url, /123456\/messages$/)
    assert.equal(envios[0].corpo.to, '5511999990000')
    assert.match(envios[0].corpo.text.body, /Astro Soluções/)
    assert.match(envios[0].corpo.text.body, /\*1\*/)
  } finally {
    restaurar()
  }
})

test('o que o robô não entende recebe o aviso de que uma pessoa lê, e o menu', async () => {
  const { envios, restaurar } = comFetchFalso()
  try {
    await handler(requisicao('preciso de um orçamento para uma loja de sapatos com estoque'), resposta())
    assert.equal(envios.length, 1)
    /* "orçamento" cai na opção 3 pelo roteador; uma frase sem nenhuma pista
       vai para o humano. */
    await handler(requisicao('xyzzy plugh'), resposta())
    assert.equal(envios.length, 2)
    assert.match(envios[1].corpo.text.body, /pessoa do time/i)
    assert.match(envios[1].corpo.text.body, /\*4\*/)
  } finally {
    restaurar()
  }
})

test('assinatura errada é recusada antes de qualquer coisa', async () => {
  const { envios, restaurar } = comFetchFalso()
  try {
    const req = requisicao('oi')
    req.headers['x-hub-signature-256'] = 'sha256=' + '0'.repeat(64)
    const res = resposta()
    await handler(req, res)
    assert.equal(res.codigo, 401)
    assert.equal(envios.length, 0)
  } finally {
    restaurar()
  }
})
