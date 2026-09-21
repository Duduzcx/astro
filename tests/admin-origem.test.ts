import test from 'node:test'
import assert from 'node:assert/strict'

process.env.ADMIN_SEGREDO = 'segredo-de-teste'
process.env.ADMIN_SENHA = 'senha-de-teste-longa'

const { origem, senhaForte, senhaConfere } = await import('../api/_lib/auth.js')

const req = (headers: Record<string, string>) => ({ headers }) as never

/* De onde a tentativa veio decide se a trava fecha. Se este valor for
   escolhido por quem tenta, a trava não existe. */

test('o cabeçalho que a Vercel escreve tem prioridade sobre o do cliente', () => {
  assert.equal(
    origem(req({ 'x-vercel-forwarded-for': '203.0.113.9', 'x-forwarded-for': 'inventado, 10.0.0.1' })),
    '203.0.113.9',
  )
})

test('sem o da Vercel, usa o do proxy', () => {
  assert.equal(origem(req({ 'x-real-ip': '198.51.100.7', 'x-forwarded-for': 'mentira' })), '198.51.100.7')
})

test('no último caso pega o FIM da cadeia, nunca o começo', () => {
  /* O começo é o que o cliente mandou; o fim é o que o proxy acrescentou. */
  assert.equal(origem(req({ 'x-forwarded-for': 'forjado-1, forjado-2, 192.0.2.44' })), '192.0.2.44')
})

test('sem cabeçalho nenhum devolve vazio, e vazio não casa com origem alguma', () => {
  assert.equal(origem(req({})), '')
})

test('valor gigante é cortado, para não inchar a tabela', () => {
  assert.equal(origem(req({ 'x-real-ip': 'a'.repeat(500) })).length, 60)
})

test('senha curta não abre a porta, por mais certa que esteja', () => {
  process.env.ADMIN_SENHA = 'curta'
  assert.equal(senhaForte(), false)
  assert.equal(senhaConfere('curta'), false)
  process.env.ADMIN_SENHA = 'senha-de-teste-longa'
  assert.equal(senhaForte(), true)
  assert.equal(senhaConfere('senha-de-teste-longa'), true)
})
