import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GATILHO_PADRAO, humanizar, aceitouHorario, bateGatilho, comandoDoDono, contarAutomaticasSeguidas, contarRecusas, deveEncerrar, dicaDaObjecao, ehDoRobo, ehHostil, ehSaudacao, falasDoHistorico, opcaoHumana, parecida, pareceAutomatica, precisaRetomar, resumoDoChat, telefoneDoJid, temMenu } from '../api/_lib/prospeccao.js'

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

test('aceite de horário exige hora explícita, um sim e nenhum não', () => {
  assert.equal(aceitouHorario('Pode ser às 14h. Obrigada!'), true)
  assert.equal(aceitouHorario('Amanhã às 10:30 fica bom'), true)
  assert.equal(aceitouHorario('Fechado, 10h'), true)
  assert.equal(aceitouHorario('Não posso às 14h'), false)
  assert.equal(aceitouHorario('Pode ser, me explica melhor'), false)
  assert.equal(aceitouHorario('Qual gargalo?'), false)
  assert.match(dicaDaObjecao([{ de: 'pessoa', texto: 'Pode ser às 14h. Obrigada!' }]), /ACEITOU/)
})

test('o gatilho padrão dispara com a saudação sozinha', () => {
  assert.equal(bateGatilho('Boa tarde', GATILHO_PADRAO), true)
  assert.equal(bateGatilho('boa tarde, tudo bem? Eduardo aqui', GATILHO_PADRAO), true)
  assert.equal(bateGatilho('Bom dia!', GATILHO_PADRAO), true)
  assert.equal(bateGatilho('Oi, tudo bem?', GATILHO_PADRAO), false)
})

test('reconhece resposta automática e conta as seguidas; o aceite ignora horário de atendimento', () => {
  const menu = 'Olá! Seja bem-vindo à Imobiliária Sol.\n1 - Vendas\n2 - Locação\n3 - Falar com atendente'
  assert.equal(pareceAutomatica(menu), true)
  assert.equal(pareceAutomatica('Nosso horário de atendimento é das 9h às 18h. Responderemos em breve.'), true)
  assert.equal(pareceAutomatica('Qual gargalo? Pode falar comigo.'), false)
  assert.equal(pareceAutomatica('Pode ser às 14h, obrigado'), false)
  assert.equal(aceitouHorario('Nosso horário de atendimento é das 9h às 18h.'), false)
  assert.equal(aceitouHorario('Atendemos das 9h às 18h'), false)
  const conversa = [
    { de: 'robo', texto: 'Boa tarde' },
    { de: 'pessoa', texto: menu },
    { de: 'robo', texto: '3' },
    { de: 'pessoa', texto: 'Responderemos em breve. Aguarde um momento.' },
    { de: 'robo', texto: 'Preciso falar com o responsável.' },
    { de: 'pessoa', texto: 'Responderemos em breve. Aguarde um momento.' },
  ]
  assert.equal(contarAutomaticasSeguidas(conversa), 3)
  assert.equal(contarAutomaticasSeguidas([...conversa, { de: 'pessoa', texto: 'Oi, aqui é o Carlos, dono. Qual gargalo?' }]), 0)
  assert.match(dicaDaObjecao([{ de: 'pessoa', texto: menu }]), /AUTOM/)
})

test('num menu automático, acha a opção que leva a uma pessoa', () => {
  const menu = 'Olá! Seja bem-vindo à Imobiliária Sol.\n1 - Vendas\n2 - Locação\n3 - Falar com atendente'
  assert.equal(temMenu(menu), true)
  assert.equal(opcaoHumana(menu), '1')
  assert.equal(opcaoHumana('Escolha uma opção:\n1) Locação\n2) Financiamento\n3) Outros assuntos'), '3')
  assert.equal(opcaoHumana('Escolha uma opção:\nA. Locação\nB. Falar com um corretor'), 'B')
  assert.equal(temMenu('Responderemos em breve. Aguarde um momento.'), false)
  assert.equal(opcaoHumana('Responderemos em breve. Aguarde um momento.'), '')
  assert.match(dicaDaObjecao([{ de: 'pessoa', texto: 'Qual gargalo? Pode falar comigo.' }]), /perguntou qual/)
})

test('saudação pura é reconhecida; frase com assunto não', () => {
  assert.equal(ehSaudacao('Boa tarde'), true)
  assert.equal(ehSaudacao('Oi, tudo bem?'), true)
  assert.equal(ehSaudacao('Tudo ótimo, e com você?'), true)
  assert.equal(ehSaudacao('Boa tarde, quem fala?'), false)
  assert.equal(ehSaudacao('Sim'), false)
  assert.equal(ehSaudacao('Oi, tudo bem? Vi o site de vocês'), false)
})

test('mensagens parecidas são pegas; diferentes não', () => {
  assert.equal(parecida('Amanhã às 10h ou às 14h?', 'Amanhã às 10h ou às 14h'), true)
  assert.equal(parecida('Estou falando com o responsável pela imobiliária?', 'Falo com o responsável pela imobiliária?'), true)
  assert.equal(parecida('Como está a estrutura digital de vocês hoje?', 'Amanhã às 10h ou às 14h?'), false)
})

test('a retomada só empurra uma vez, e nunca depois de despedida ou robô alheio', () => {
  assert.equal(precisaRetomar([{ de: 'robo', texto: 'Boa tarde, tudo bem? Aqui é o assistente da Astro Soluções.' }]), true)
  assert.equal(precisaRetomar([{ de: 'pessoa', texto: 'Oi' }, { de: 'robo', texto: 'Estou falando com o responsável?' }]), true)
  assert.equal(precisaRetomar([{ de: 'robo', texto: 'Boa tarde' }, { de: 'robo', texto: 'Falo com o responsável?' }]), false)
  assert.equal(precisaRetomar([{ de: 'pessoa', texto: 'Não quero nada' }, { de: 'robo', texto: 'Obrigado pelo retorno, fico à disposição.' }]), false)
  assert.equal(precisaRetomar([{ de: 'pessoa', texto: 'Responderemos em breve. Aguarde.' }, { de: 'robo', texto: 'Olá! Preciso falar com o responsável pela imobiliária. Consegue me passar para uma pessoa?' }]), false)
  assert.equal(precisaRetomar([{ de: 'robo', texto: 'Oi' }, { de: 'pessoa', texto: 'Oi' }]), false)
})

test('humanizar tira dois-pontos, ponto e vírgula, travessão e negrito, e preserva horários', () => {
  assert.equal(humanizar('Só para entender: é porque já têm um robô?'), 'Só para entender, é porque já têm um robô?')
  assert.equal(humanizar('Confirmado: amanhã às 10:30 — te espero; obrigado.'), 'Confirmado, amanhã às 10:30, te espero, obrigado.')
  assert.equal(humanizar('**Amanhã** às 14h?'), 'Amanhã às 14h?')
  assert.equal(humanizar('Pode ser às 14h.'), 'Pode ser às 14h.')
})

test('humanizar tira emoji e limita a dois balões, preservando a linha em branco', () => {
  assert.equal(humanizar('Tudo certo por aqui! 👍\n\nEstou falando com o responsável?'), 'Tudo certo por aqui!\n\nEstou falando com o responsável?')
  assert.equal(humanizar('Um.\n\nDois.\n\nTrês?'), 'Um.\n\nDois. Três?')
  assert.equal(humanizar('Obrigado 🤝'), 'Obrigado')
})

test('o eco de um balão é reconhecido como fala do robô', () => {
  const conversa = [{ de: 'robo', texto: 'Tudo certo por aqui também!\n\nEstou falando com o responsável pela imobiliária?' }]
  assert.equal(ehDoRobo('Tudo certo por aqui também!', conversa), true)
  assert.equal(ehDoRobo('Estou falando com o responsável pela imobiliária?', conversa), true)
  assert.equal(ehDoRobo('Vou passar o contrato amanhã', conversa), false)
})
