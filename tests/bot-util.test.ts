import test from 'node:test'
import assert from 'node:assert/strict'
import { cpfValido, dentroDoHorario, escolher, ehUrgente, formatarDataHora, mascararCpf, nomeValido, pareceUmaPergunta } from '../lib/bot/util.ts'
import { achatarVagas } from '../lib/calcom.ts'
import { texto } from '../lib/bot/textos.ts'
import { lerMensagemDoWebhook } from '../lib/evolution.ts'

test('escolher entende número, texto inteiro, começo e palavra distintiva', () => {
  const opcoes = ['Avaliação 30min', 'Limpeza 60min', 'Falar com recepção']
  assert.equal(escolher('2', opcoes), 1)
  assert.equal(escolher('opção 3', opcoes), 2)
  assert.equal(escolher('Limpeza 60min', opcoes), 1)
  assert.equal(escolher('avaliacao', opcoes), 0)
  assert.equal(escolher('quero a limpeza', opcoes), 1)
  assert.equal(escolher('recepcao por favor', opcoes), 2)
  assert.equal(escolher('9', opcoes), -1)
  assert.equal(escolher('não sei', opcoes), -1)
})

test('validações de nome e CPF', () => {
  assert.equal(nomeValido('Ana'), false)
  assert.equal(nomeValido('Ana Souza'), true)
  assert.equal(nomeValido('José da Silva'), true)
  assert.equal(cpfValido('123.456.789-01'), true)
  assert.equal(cpfValido('12345'), false)
  assert.equal(mascararCpf('12345678901'), '***.***.***-01')
  assert.equal(mascararCpf(''), '')
})

test('urgência e perguntas', () => {
  const palavras = ['dor', 'inchaço', 'urgente']
  assert.equal(ehUrgente('estou com DOR de dente', palavras), true)
  assert.equal(ehUrgente('inchaco no rosto', palavras), true)
  assert.equal(ehUrgente('quero uma limpeza', palavras), false)
  assert.equal(pareceUmaPergunta('vocês aceitam convênio?'), true)
  assert.equal(pareceUmaPergunta('Quanto custa a avaliação'), true)
  assert.equal(pareceUmaPergunta('Ana Souza'), false)
})

test('horário de funcionamento no fuso da clínica', () => {
  const horario = { seg: [['09:00', '12:00'], ['13:30', '18:00']] as [string, string][] }
  /* segunda 28/09/2026, 10:00 em São Paulo = 13:00Z */
  assert.equal(dentroDoHorario(horario, new Date('2026-09-28T13:00:00.000Z'), 'America/Sao_Paulo'), true)
  /* 12:30 local, no intervalo do almoço */
  assert.equal(dentroDoHorario(horario, new Date('2026-09-28T15:30:00.000Z'), 'America/Sao_Paulo'), false)
  /* terça: sem horário cadastrado para o dia */
  assert.equal(dentroDoHorario(horario, new Date('2026-09-29T13:00:00.000Z'), 'America/Sao_Paulo'), false)
  assert.equal(dentroDoHorario({}, new Date(), 'America/Sao_Paulo'), true)
  assert.equal(formatarDataHora('2026-10-01T13:05:00.000Z', 'America/Sao_Paulo'), '01/10/2026 - 10:05')
})

test('vagas do Cal.com achatadas e em ordem', () => {
  const dados = {
    '2026-10-02': [{ start: '2026-10-02T13:00:00.000Z' }],
    '2026-10-01': [{ start: '2026-10-01T14:00:00.000Z' }, { start: '2026-10-01T13:00:00.000Z' }],
  }
  assert.deepEqual(
    achatarVagas(dados).map((v) => v.inicio),
    ['2026-10-01T13:00:00.000Z', '2026-10-01T14:00:00.000Z', '2026-10-02T13:00:00.000Z'],
  )
  assert.deepEqual(achatarVagas(null), [])
})

test('textos: a clínica sobrescreve o padrão e as chaves são preenchidas', () => {
  const clinica = { nome: 'Clínica X', dentista_nome: null, endereco: null, link_maps: null, recomendacoes: null, telefone_recepcao: null, valor_avaliacao: null, tom_voz: 'formal' as const, mensagens: { pedirNome: 'Nome, por gentileza, {clinica}.' } }
  assert.equal(texto(clinica, 'pedirNome'), 'Nome, por gentileza, Clínica X.')
  assert.match(texto(clinica, 'apresentacao'), /^Olá\. Aqui é o assistente virtual da Clínica X/)
  assert.match(texto({ ...clinica, tom_voz: 'descontraido' }, 'apresentacao'), /^Oi! 👋/)
})

test('o webhook da Evolution é lido em qualquer formato de mensagem', () => {
  const base = { key: { remoteJid: '5511999990000@s.whatsapp.net', fromMe: false, id: 'ABC' }, pushName: 'Ana' }
  assert.deepEqual(lerMensagemDoWebhook({ data: { ...base, message: { conversation: 'oi' } } }), { telefone: '+5511999990000', texto: 'oi', id: 'ABC', nomeExibido: 'Ana', deMim: false })
  assert.equal(lerMensagemDoWebhook({ data: { ...base, message: { extendedTextMessage: { text: '2' } } } })?.texto, '2')
  assert.equal(lerMensagemDoWebhook({ data: { ...base, message: { buttonsResponseMessage: { selectedDisplayText: 'Limpeza' } } } })?.texto, 'Limpeza')
  assert.equal(lerMensagemDoWebhook({ data: { key: { remoteJid: '123@g.us' }, message: { conversation: 'grupo' } } }), null)
  assert.equal(lerMensagemDoWebhook({ data: { ...base, key: { ...base.key, fromMe: true }, message: { conversation: 'eu' } } })?.deMim, true)
})
