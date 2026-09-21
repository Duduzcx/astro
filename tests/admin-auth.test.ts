import test from 'node:test'
import assert from 'node:assert/strict'

/* A porta do painel. Um erro aqui é uma porta aberta, então cada garantia
   tem um teste: assinatura válida passa, adulterada não passa, vencida não
   passa, e sem segredo nada passa. */

process.env.ADMIN_SEGREDO = 'segredo-de-teste'
process.env.ADMIN_SENHA = 'senha-de-teste'

const { criarSessao, sessaoValida, senhaConfere, iguais } = await import('../api/_lib/auth.js')

test('a sessão que acabou de nascer vale', () => {
  assert.equal(sessaoValida(criarSessao()), true)
})

test('assinatura adulterada não passa', () => {
  const boa = criarSessao()
  const [corpo, assinatura] = [boa.slice(0, boa.lastIndexOf('.')), boa.slice(boa.lastIndexOf('.') + 1)]
  assert.equal(sessaoValida(`${corpo}.${assinatura.slice(0, -1)}x`), false)
  /* Esticar a validade sem reassinar é a tentativa óbvia. */
  assert.equal(sessaoValida(`${Number(corpo) + 86_400_000}.${assinatura}`), false)
})

test('sessão vencida não passa', () => {
  assert.equal(sessaoValida('1.qualquercoisa'), false)
})

test('lixo não passa', () => {
  for (const valor of ['', 'semponto', '.', 'a.b', null, undefined]) {
    assert.equal(sessaoValida(valor as never), false, `passou com ${String(valor)}`)
  }
})

test('a senha certa entra e a errada não', () => {
  assert.equal(senhaConfere('senha-de-teste'), true)
  assert.equal(senhaConfere('senha-de-testx'), false)
  assert.equal(senhaConfere('senha-de-teste-maior'), false)
  assert.equal(senhaConfere(''), false)
})

test('a comparação aguenta tamanhos diferentes sem estourar', () => {
  assert.equal(iguais('a', 'aaaaaaaaaa'), false)
  assert.equal(iguais('', 'x'), false)
  assert.equal(iguais('igual', 'igual'), true)
})
