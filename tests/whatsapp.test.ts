import test from 'node:test'
import assert from 'node:assert/strict'
import { entender } from '../api/whatsapp.js'

/* O roteamento do atendente automático é a única parte que dá para verificar
   sem falar com a Meta. Ele decide o que a pessoa recebe de volta, então um
   engano aqui responde preço para quem pediu horário. */

test('o número escolhido no menu manda', () => {
  assert.equal(entender('1'), 1)
  assert.equal(entender('2'), 2)
  assert.equal(entender('3'), 3)
  assert.equal(entender('4'), 4)
  assert.equal(entender('1 por favor'), 1)
})

test('entende o pedido escrito, com ou sem acento', () => {
  assert.equal(entender('quero agendar'), 1)
  assert.equal(entender('Diagnóstico'), 1)
  assert.equal(entender('diagnostico'), 1)
  assert.equal(entender('quanto custa?'), 3)
  assert.equal(entender('qual o prazo'), 3)
  assert.equal(entender('quero falar com uma pessoa'), 4)
  assert.equal(entender('vocês fazem sistema?'), 2)
})

test('cumprimento abre o menu', () => {
  for (const oi of ['oi', 'Olá', 'bom dia', 'BOA NOITE', 'menu']) {
    assert.equal(entender(oi), 'saudacao', `falhou em ${oi}`)
  }
})

test('o que não se encaixa vira null, para o humano assumir', () => {
  assert.equal(entender('preciso de um orçamento para 300 lojas até sexta'), 3)
  assert.equal(entender('kkkkk'), null)
  assert.equal(entender(''), null)
})

test('número fora do menu não é escolha de menu', () => {
  assert.equal(entender('5'), null)
  assert.equal(entender('11987654321'), null)
})
