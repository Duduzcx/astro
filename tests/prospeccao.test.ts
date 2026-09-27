import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ehDoRobo, falasDoHistorico, resumoDoChat, telefoneDoJid } from '../api/_lib/prospeccao.js'

const registro = (texto: string, fromMe: boolean, quando: number, extra: Record<string, unknown> = {}) => ({
  key: { remoteJid: '5511999990000@s.whatsapp.net', fromMe, id: `m${quando}` },
  pushName: fromMe ? 'Eu' : 'Marina',
  message: { conversation: texto },
  messageTimestamp: quando,
  ...extra,
})

test('o jid da Evolution vira o contato do lead, com o mais', () => {
  assert.equal(telefoneDoJid('5511999990000@s.whatsapp.net'), '+5511999990000')
  assert.equal(telefoneDoJid(''), '')
  assert.equal(telefoneDoJid('abc@g.us'), '')
})

test('o histórico do aparelho sai em ordem, com quem escreveu pelo aparelho como lado da empresa', () => {
  const falas = falasDoHistorico([
    registro('Oi, vi o site de vocês', false, 200),
    registro('Bom dia! Conta pra gente o que precisa', true, 300),
    registro('preciso de um sistema de agenda', false, 100),
  ])
  assert.deepEqual(falas, [
    { de: 'pessoa', texto: 'preciso de um sistema de agenda' },
    { de: 'pessoa', texto: 'Oi, vi o site de vocês' },
    { de: 'robo', texto: 'Bom dia! Conta pra gente o que precisa' },
  ])
})

test('grupo, status e mensagem sem texto ficam de fora do histórico', () => {
  const falas = falasDoHistorico([
    registro('no grupo', false, 1, { key: { remoteJid: '123@g.us', fromMe: false, id: 'g' } }),
    { key: { remoteJid: '5511999990000@s.whatsapp.net', fromMe: false, id: 'x' }, message: { imageMessage: {} }, messageTimestamp: 2 },
    registro('só esta', false, 3),
  ])
  assert.deepEqual(falas, [{ de: 'pessoa', texto: 'só esta' }])
})

test('uma mensagem fromMe igual à última fala do robô é eco da nossa; diferente é a mão do dono', () => {
  const conversa = [
    { de: 'pessoa', texto: 'oi' },
    { de: 'robo', texto: 'Oi, Marina! Podemos falar do sistema de agenda?' },
  ]
  assert.equal(ehDoRobo('Oi, Marina!  Podemos falar do sistema de agenda?', conversa), true)
  assert.equal(ehDoRobo('Deixa comigo, eu assumo daqui', conversa), false)
  assert.equal(ehDoRobo('qualquer coisa', []), false)
})

test('um chat da lista vira o resumo que o painel mostra', () => {
  const resumo = resumoDoChat({
    remoteJid: '5511999990000@s.whatsapp.net',
    pushName: 'Marina Duarte',
    lastMessage: registro('fechado então?', false, 1_700_000_000),
  })
  assert.equal(resumo.telefone, '+5511999990000')
  assert.equal(resumo.nome, 'Marina Duarte')
  assert.deepEqual(resumo.ultima, { de: 'pessoa', texto: 'fechado então?' })
  assert.equal(resumo.quando, new Date(1_700_000_000_000).toISOString())
})
