import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bateGatilho, comandoDoDono, contarRecusas, deveEncerrar, dicaDaObjecao, ehDoRobo, ehHostil, falasDoHistorico, resumoDoChat, telefoneDoJid } from '../api/_lib/prospeccao.js'

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

test('a frase gatilho ignora maiúsculas, acentos e pontuação, e vale se a mensagem a contiver', () => {
  const gatilho = 'Boa tarde, tudo bem?\nnotei um gargalo'
  assert.equal(bateGatilho('boa tarde tudo bem', gatilho), true)
  assert.equal(bateGatilho('BOA TARDE, TUDO BEM?? Eduardo aqui.', gatilho), true)
  assert.equal(bateGatilho('Estava no site de vocês e notei um GARGALO na captação.', gatilho), true)
  assert.equal(bateGatilho('Boa tarde! Tudo certo por aí?', gatilho), false)
  assert.equal(bateGatilho('', gatilho), false)
  assert.equal(bateGatilho('boa tarde tudo bem', ''), false)
})

test('os comandos do dono pelo celular: #pausa desliga, #robo religa, o resto é fala', () => {
  assert.equal(comandoDoDono('#pausa'), 'pausa')
  assert.equal(comandoDoDono('#Pausa por favor'), 'pausa')
  assert.equal(comandoDoDono('#robo'), 'robo')
  assert.equal(comandoDoDono('#ROBÔ'), 'robo')
  assert.equal(comandoDoDono('Vou passar o contrato amanhã, tudo bem?'), '')
  assert.equal(comandoDoDono('a pausa do almoço'), '')
})

test('conta as recusas da pessoa, e só as dela', () => {
  const conversa = [
    { de: 'robo', texto: 'Notei um gargalo. É com você que eu falo?' },
    { de: 'pessoa', texto: 'Qual gargalo?' },
    { de: 'robo', texto: 'Não tenho como explicar em uma frase, mas...' },
    { de: 'pessoa', texto: 'Não tenho interesse, obrigado.' },
    { de: 'robo', texto: 'Entendo. Dez minutos na terça?' },
    { de: 'pessoa', texto: 'Não, obrigado. Não quero mesmo.' },
  ]
  assert.equal(contarRecusas(conversa), 2)
  assert.equal(contarRecusas(conversa.slice(0, 4)), 1)
  assert.equal(contarRecusas([{ de: 'pessoa', texto: 'Pode ser quinta às 15h. Obrigada!' }]), 0)
  assert.equal(contarRecusas([{ de: 'pessoa', texto: 'Não sei se é com você, mas me interessa saber mais' }]), 0)
  assert.equal(contarRecusas([{ de: 'pessoa', texto: 'Para de me mandar mensagem' }]), 1)
})

test('encerra no segundo não ou na hostilidade, nunca na primeira recusa', () => {
  const abertura = { de: 'robo', texto: 'Notei um gargalo na captação. É com você que eu falo?' }
  assert.equal(deveEncerrar([abertura, { de: 'pessoa', texto: 'Não tenho interesse, obrigado.' }]), false)
  assert.equal(deveEncerrar([abertura, { de: 'pessoa', texto: 'Não tenho interesse.' }, { de: 'robo', texto: 'Compreendo. É porque já têm robô?' }, { de: 'pessoa', texto: 'Não quero, obrigado.' }]), true)
  assert.equal(deveEncerrar([abertura, { de: 'pessoa', texto: 'Me tira da lista, por favor.' }]), true)
  assert.equal(deveEncerrar([abertura, { de: 'pessoa', texto: 'Não me mande mais mensagem' }]), true)
  assert.equal(deveEncerrar([abertura, { de: 'pessoa', texto: 'Quanto custa isso?' }]), false)
  assert.equal(ehHostil('Pode ser amanhã às 10h'), false)
  assert.equal(ehHostil('Isso é golpe? Vou denunciar'), true)
})

test('recusa definitiva encerra na hora; "não tenho interesse" simples ainda ganha uma investigação', () => {
  const abertura = { de: 'robo', texto: 'Notei um gargalo na captação. É com você que eu falo?' }
  assert.equal(deveEncerrar([abertura, { de: 'pessoa', texto: 'Não venha me oferecer nada.' }]), true)
  assert.equal(deveEncerrar([abertura, { de: 'pessoa', texto: 'Não quero nada, obrigado' }]), true)
  assert.equal(deveEncerrar([abertura, { de: 'pessoa', texto: 'Não tenho interesse nenhum.' }]), true)
  assert.equal(deveEncerrar([abertura, { de: 'pessoa', texto: 'Não tenho interesse.' }]), false)
  assert.equal(deveEncerrar([abertura, { de: 'pessoa', texto: 'A gente já usa o Kenlo aqui.' }]), false)
})

test('a dica da objeção aponta a técnica do roteiro pela última fala da pessoa', () => {
  const pessoa = (texto: string) => [{ de: 'pessoa', texto }]
  assert.match(dicaDaObjecao(pessoa('Não tenho tempo pra isso agora.')), /REDUZA O ESFORÇO/)
  assert.match(dicaDaObjecao(pessoa('Não é prioridade investir nisso agora.')), /CUSTO DE NÃO AGIR/)
  assert.match(dicaDaObjecao(pessoa('A gente já tem site e usa o Kenlo.')), /CONTORNO/)
  assert.match(dicaDaObjecao(pessoa('Me manda por e-mail.')), /material/)
  assert.match(dicaDaObjecao(pessoa('Faz sentido. Como vocês fariam isso aqui?')), /FECHE/)
  assert.equal(dicaDaObjecao(pessoa('Não tenho interesse, obrigado.')), '')
  assert.equal(dicaDaObjecao([{ de: 'robo', texto: 'Já temos tudo pronto para você' }]), '')
})
