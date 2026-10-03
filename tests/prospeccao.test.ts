import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GATILHO_PADRAO, PING_DE_RETORNO, SEGMENTOS, VOZES, numeroIndicado, dentroDoHorario, humanizar, pedeHumano, precisaSegundoPing, aceitouHorario, bateGatilho, comandoDoDono, contarAutomaticasSeguidas, contarRecusas, deveEncerrar, dicaDaObjecao, ehDoRobo, ehHostil, ehSaudacao, falasDoHistorico, opcaoHumana, parecida, pareceAutomatica, precisaRetomar, resumoDoChat, telefoneDoJid, temMenu } from '../api/_lib/prospeccao.js'

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
  assert.match(dicaDaObjecao(pessoa('Me manda por e-mail.')), /Peça só o necessário/)
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

test('o gatilho padrão só dispara com frase de prospecção, nunca com saudação', () => {
  assert.equal(bateGatilho('Boa tarde', GATILHO_PADRAO), false)
  assert.equal(bateGatilho('Bom dia!', GATILHO_PADRAO), false)
  assert.equal(bateGatilho('Estava no site de vocês e notei um gargalo na captação.', GATILHO_PADRAO), true)
  assert.equal(bateGatilho('Oi, vim falar da Astro Soluções', GATILHO_PADRAO), true)
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

test('humanizar deixa uma pergunta só e a dica barra fatos inventados sobre a empresa', () => {
  assert.equal(humanizar('Sim, somos de São Paulo. Como está a estrutura? O site funciona bem?'), 'Sim, somos de São Paulo. Como está a estrutura?')
  assert.equal(humanizar('Tudo certo por aqui!\n\nEstou falando com o responsável?'), 'Tudo certo por aqui!\n\nEstou falando com o responsável?')
  assert.match(dicaDaObjecao([{ de: 'pessoa', texto: 'Vocês são de São Paulo? Atendem Campinas também?' }]), /fato sobre a empresa/)
  assert.match(dicaDaObjecao([{ de: 'pessoa', texto: 'Quantos clientes vocês têm?' }]), /fato sobre a empresa/)
})

test('horário comercial em São Paulo: segunda a sábado, 8h às 20h', () => {
  assert.equal(dentroDoHorario(new Date('2026-09-30T17:00:00.000Z')), true) // quarta 14h
  assert.equal(dentroDoHorario(new Date('2026-10-01T01:00:00.000Z')), false) // quarta 22h
  assert.equal(dentroDoHorario(new Date('2026-10-04T15:00:00.000Z')), false) // domingo
  assert.equal(dentroDoHorario(new Date('2026-10-03T13:00:00.000Z')), true) // sábado 10h
})

test('pedido de humano e segundo ping', () => {
  assert.equal(pedeHumano('Me liga agora que é mais fácil'), true)
  assert.equal(pedeHumano('Quero falar com uma pessoa'), true)
  assert.equal(pedeHumano('Qual gargalo?'), false)
  const convite = { de: 'robo', texto: 'O Eduardo te mostra em 10 minutos. Amanhã às 10h ou às 14h?' }
  const empurrao = { de: 'robo', texto: 'Conseguiu ver? Amanhã às 10h ou às 14h?' }
  assert.equal(precisaSegundoPing([{ de: 'pessoa', texto: 'Interessante' }, convite, empurrao]), true)
  assert.equal(precisaSegundoPing([{ de: 'pessoa', texto: 'Interessante' }, convite]), false)
  assert.equal(precisaSegundoPing([{ de: 'pessoa', texto: 'Interessante' }, convite, { de: 'robo', texto: PING_DE_RETORNO }]), false)
  assert.equal(precisaSegundoPing([{ de: 'pessoa', texto: 'Não quero' }, convite, { de: 'robo', texto: 'Obrigado pelo retorno, fico à disposição.' }]), false)
})

test('segredoConfere compara em tempo constante e nunca aceita vazio', async () => {
  const { segredoConfere } = await import('../api/crm/_lib/http.js')
  assert.equal(segredoConfere('abc', 'abc'), true)
  assert.equal(segredoConfere('abd', 'abc'), false)
  assert.equal(segredoConfere('', ''), false)
  assert.equal(segredoConfere(undefined, 'abc'), false)
})

test('o robô da imobiliária que varia a frase e sempre oferece "comprar, alugar ou…" é pego em três batidas', () => {
  const r1 = 'Nosso atendimento é planejado para ser imediato e eficiente. Você deseja comprar, alugar ou tratar de algum assunto administrativo?'
  const r2 = 'Nosso atendimento é imediato para garantir a melhor experiência ao cliente. Você deseja comprar, alugar ou falar com o administrativo?'
  const r3 = 'Para assuntos administrativos ou parcerias, favor entrar em contato diretamente com o nosso Administrativo pelo número 5511911223145. Você deseja comprar ou alugar um imóvel?'
  assert.equal(pareceAutomatica(r1), true)
  assert.equal(pareceAutomatica(r2), true)
  assert.equal(pareceAutomatica(r3), true)
  assert.equal(pareceAutomatica('Qual gargalo? Pode falar comigo.'), false)
  assert.equal(pareceAutomatica('Pode ser às 14h, obrigado'), false)
  const conversa = [
    { de: 'robo', texto: 'Boa tarde' },
    { de: 'pessoa', texto: r1 },
    { de: 'robo', texto: 'Olá! Preciso falar com o responsável pela imobiliária. Consegue me passar para uma pessoa?' },
    { de: 'pessoa', texto: r2 },
    { de: 'robo', texto: 'Não é sobre imóvel. Pode me passar o contato de quem cuida do comercial ou do marketing?' },
    { de: 'pessoa', texto: r3 },
  ]
  assert.equal(contarAutomaticasSeguidas(conversa), 3)
  assert.equal(contarAutomaticasSeguidas([...conversa, { de: 'pessoa', texto: 'Oi, aqui é a Carla, do comercial. Pode falar.' }]), 0)
})

test('acha o número indicado no texto do robô alheio, ignorando o próprio', () => {
  assert.equal(numeroIndicado('Favor entrar em contato com o Administrativo pelo número 5511911223145. Você deseja comprar?', '+5511999990000'), '5511911223145')
  assert.equal(numeroIndicado('Fale com a Ana no (11) 98765-4321', '+5511999990000'), '5511987654321')
  assert.equal(numeroIndicado('Pode chamar no 11 98765-4321 que ela responde', '+5511987654321'), '')
  assert.equal(numeroIndicado('Amanhã às 10h ou às 14h?', '+5511999990000'), '')
})

test('os três segmentos têm voz completa e a dica do gargalo usa a voz', () => {
  assert.deepEqual(SEGMENTOS, ['imobiliaria', 'cursinho', 'odonto'])
  for (const s of SEGMENTOS) for (const campo of ['rotulo', 'quem', 'gargalo', 'contorno']) assert.ok((VOZES as Record<string, Record<string, string>>)[s][campo].length > 3, s + '.' + campo)
  assert.match(dicaDaObjecao([{ de: 'pessoa', texto: 'Qual gargalo?' }], VOZES.odonto), /Paciente que chama/)
  assert.match(dicaDaObjecao([{ de: 'pessoa', texto: 'A gente já tem sistema aqui.' }], VOZES.cursinho), /secretaria/)
})

test('pessoa satisfeita recebe a dica de mudar de ângulo, não de repetir o diagnóstico', () => {
  assert.match(dicaDaObjecao([{ de: 'pessoa', texto: 'na verdade esta bem tranquilo' }]), /mude de ângulo/)
  assert.match(dicaDaObjecao([{ de: 'pessoa', texto: 'esta funcionando muito bem' }]), /mude de ângulo/)
  assert.match(dicaDaObjecao([{ de: 'pessoa', texto: 'respondemos rapido e com certa prioridade' }]), /mude de ângulo/)
  assert.doesNotMatch(dicaDaObjecao([{ de: 'pessoa', texto: 'Tudo bem? Como funciona?' }]), /mude de ângulo/)
})

test('pedido de outro canal: reconhece o pedido e o contato', async () => {
  const { pedeOutroCanal, emailNoTexto } = await import('../api/_lib/prospeccao.js')
  assert.equal(pedeOutroCanal('Me manda a apresentação por e-mail'), true)
  assert.equal(pedeOutroCanal('Envia no meu email que eu vejo'), true)
  assert.equal(pedeOutroCanal('Fala com a Carla nesse número 11 98765-4321'), true)
  assert.equal(pedeOutroCanal('Qual gargalo?'), false)
  assert.equal(emailNoTexto('pode mandar pra Contato@ImobSol.com.br, obrigado'), 'contato@imobsol.com.br')
  assert.equal(emailNoTexto('sem email aqui'), '')
  assert.match(dicaDaObjecao([{ de: 'pessoa', texto: 'Manda a apresentação por e-mail' }]), /Peça só o necessário/)
})

test('encurtar mantém a primeira frase e a pergunta dentro do limite', async () => {
  const { encurtar } = await import('../api/_lib/prospeccao.js')
  const longo = 'Mesmo respondendo rápido, quando o corretor está em visita ele perde tempo para digitar. Se o cliente já escolher outro, a comissão sai. Podemos mostrar como automatizar em 10 minutos. Amanhã às 10h ou às 14h?'
  const curto = encurtar(longo, 22)
  assert.ok(curto.split(/\s+/).length <= 22, curto)
  assert.ok(curto.endsWith('Amanhã às 10h ou às 14h?'), curto)
  assert.equal(encurtar('Que bom. Quantas pessoas atendem?', 22), 'Que bom. Quantas pessoas atendem?')
})

test('número errado e pedido de objetividade são reconhecidos', async () => {
  const { foraDoAlvo, pedeObjetividade } = await import('../api/_lib/prospeccao.js')
  for (const t of ['Vc deve estar com o número incorreto.', 'Desculpa... Não trabalho com clientes... Este número é pessoal', 'Mocca acho que vc digitou errado', 'Não trabalho com nada disso', 'Não tenho imobiliária não']) assert.equal(foraDoAlvo(t), true, t)
  for (const t of ['Qual gargalo?', 'Não tenho interesse, obrigado.', 'Sim, sou eu']) assert.equal(foraDoAlvo(t), false, t)
  for (const t of ['Vamos lá. O que teria para me oferecer?', 'Desculpe. Mas quando trato de negócios gosto mais de ser direto aos assuntos', 'Se quiser oferecer algo me ofereça', 'O que vocês fazem exatamente?']) assert.equal(pedeObjetividade(t), true, t)
  assert.equal(pedeObjetividade('Como está o atendimento de vocês?'), false)
})

test('quem é você não é número errado; aceite de horário, preço, ocupado e site são reconhecidos', async () => {
  const m = await import('../api/_lib/prospeccao.js')
  for (const t of ['Quem é você? De onde pegou meu número?', 'Não conheço a Astro, mas me conta', 'Não tenho ideia de quanto isso custa', 'Não trabalho com Kenlo, uso Vista', 'Não é comigo, fala com a Ana', 'Não sou corretor, sou o dono da imobiliária']) assert.equal(m.foraDoAlvo(t), false, t)
  for (const t of ['Vc deve estar com o número incorreto.', 'Não trabalho com clientes... Este número é pessoal', 'Não é comigo.']) assert.equal(m.foraDoAlvo(t), true, t)
  for (const t of ['Quem é você?', 'De onde pegou meu número?', 'Não conheço a Astro']) assert.equal(m.pedeApresentacao(t), true, t)
  for (const t of ['Pode ser amanhã às 10h', 'Sim, 14h', '10h tá ótimo', 'Fechado, amanhã 14h']) assert.equal(m.aceitouHorario(t), true, t)
  assert.equal(m.aceitouHorario('Não, 10h não dá'), false)
  assert.equal(m.confirmarHorario('Pode ser amanhã às 10h'), 'Fechado, amanhã às 10h então! O Eduardo confirma com você um pouco antes. Obrigado!')
  assert.equal(m.confirmarHorario('Sexta 14h fica bom', 'Amanhã às 10h ou às 14h?'), 'Fechado, sexta às 14h então! O Eduardo confirma com você um pouco antes. Obrigado!')
  assert.equal(m.aceitouSemHora('Pode ser', 'Amanhã às 10h ou às 14h?'), true)
  assert.equal(m.aceitouSemHora('Pode ser', 'Como está o atendimento?'), false)
  assert.equal(m.aceitouSemHora('Pode ser, mas não amanhã', 'Amanhã às 10h ou às 14h?'), false)
  for (const t of ['Quanto custa isso?', 'Qual o valor por mês?', 'Antes de marcar, quanto fica por mês?']) assert.equal(m.pedePreco(t), true, t)
  assert.equal(m.pedeObjetividade('Quanto custa isso?'), false)
  for (const t of ['Estou ocupado agora, me chama depois', 'Agora não consigo', 'To em reunião']) assert.equal(m.estaOcupado(t), true, t)
  assert.equal(m.estaOcupado('Hoje a gente não perde cliente'), false)
  assert.equal(m.pedeSite('Me manda o site de vocês pra eu dar uma olhada'), true)
  const { variantesDoContato } = await import('../api/_lib/leads.js')
  assert.deepEqual(variantesDoContato('+5511987654321'), ['+5511987654321', '+551187654321'])
  assert.deepEqual(variantesDoContato('+551187654321'), ['+551187654321', '+5511987654321'])
  assert.deepEqual(variantesDoContato('+551133334444'), ['+551133334444'])
})

test('recusa exige objeto, hostilidade com interrogação é dúvida, pedido de gente tem exceções', async () => {
  const m = await import('../api/_lib/prospeccao.js')
  const pessoa = (texto: string) => ({ de: 'pessoa', texto })
  assert.equal(m.contarRecusas([pessoa('Não tenho tempo agora'), pessoa('Não temos site')]), 0)
  assert.equal(m.contarRecusas([pessoa('Não tenho interesse'), pessoa('Não quero, obrigado')]), 2)
  assert.equal(m.contarRecusas([pessoa('Não precisamos disso')]), 1)
  assert.equal(m.ehHostil('Isso é golpe?'), false)
  assert.equal(m.ehHostil('É spam?'), false)
  assert.equal(m.ehHostil('Isso é golpe, vou denunciar'), true)
  assert.equal(m.ehHostil('Para de me mandar mensagem'), true)
  assert.equal(m.pedeHumano('Não é urgente, pode ser por aqui'), false)
  assert.equal(m.pedeHumano('Não me liga, só por escrito'), false)
  assert.equal(m.pedeHumano('Me liga que é mais fácil'), true)
  assert.equal(m.aceitouHorario('Vamos ver, tenho reunião às 10h'), false)
  assert.equal(m.aceitouHorario('Pode ser o das 10'), true)
  assert.equal(m.aceitouHorario('Sim, 14hs'), true)
  assert.equal(m.confirmarHorario('Pode ser o das 10', 'Amanhã às 10h ou às 14h?'), 'Fechado, amanhã às 10h então! O Eduardo confirma com você um pouco antes. Obrigado!')
  assert.equal(m.encurtar('Mando para joao@imob.com.br ainda hoje. Depois a gente alinha os detalhes com calma e vê o que faz mais sentido para vocês. Combinado?', 10).includes('joao@imob.com.br'), true)
})

test('"desculpa, não faço a mínima ideia" depois de "quem cuida?" encerra como negativa curta', async () => {
  const m = await import('../api/_lib/prospeccao.js')
  assert.equal(m.foraDoAlvo('Desculpa... Não faço a mínima ideia'), false)
  assert.equal(m.negativaCurta('Desculpa... Não faço a mínima ideia'), true)
  assert.equal(m.negativaCurta('Não'), true)
  assert.equal(m.negativaCurta('Não, mas me explica melhor'), false)
})

test('hora seca depois dos dois horários é aceite; "vou verificar" recebe agradecimento', async () => {
  const m = await import('../api/_lib/prospeccao.js')
  assert.equal(m.aceitouHorario('14 hs', 'Amanhã às 10h ou às 14h para ver a solução?'), true)
  assert.equal(m.aceitouHorario('14 hs', 'Como vocês captam novos clientes hoje?'), false)
  assert.equal(m.aceitouHorario('Tenho reunião às 14h, depois eu vejo', 'Amanhã às 10h ou às 14h?'), false)
  assert.equal(m.confirmarHorario('14 hs', 'Amanhã às 10h ou às 14h para ver a solução?'), 'Fechado, amanhã às 14h então! O Eduardo confirma com você um pouco antes. Obrigado!')
  for (const t of ['Preciso verificar com os nossos responsáveis e já te dou o retorno', 'Vou falar com o dono e te dou retorno', 'Vou repassar para a diretoria']) assert.equal(m.vaiVerificar(t), true, t)
  assert.equal(m.vaiVerificar('Quero ver funcionando'), false)
})

test('sexta e sábado propõem segunda; desconfiança tem resposta própria', async () => {
  const m = await import('../api/_lib/prospeccao.js')
  assert.equal(m.quandoDemo(new Date('2026-10-02T15:00:00Z')), 'segunda')
  assert.equal(m.quandoDemo(new Date('2026-10-03T15:00:00Z')), 'segunda')
  assert.equal(m.quandoDemo(new Date('2026-10-04T15:00:00Z')), 'amanhã')
  assert.equal(m.quandoDemo(new Date('2026-09-30T15:00:00Z')), 'amanhã')
  assert.equal(m.perguntaDosHorarios(new Date('2026-10-02T15:00:00Z')), 'Segunda às 10h ou às 14h?')
  assert.equal(m.confirmarHorario('Pode ser às 10h', 'Segunda às 10h ou às 14h?'), 'Fechado, segunda às 10h então! O Eduardo confirma com você um pouco antes. Obrigado!')
  assert.equal(m.confirmarHorario('Pode ser amanhã às 10h', 'Segunda às 10h ou às 14h?'), 'Fechado, amanhã às 10h então! O Eduardo confirma com você um pouco antes. Obrigado!')
  for (const t of ['Isso é golpe?', 'É sério isso?', 'Parece golpe']) assert.equal(m.desconfia(t), true, t)
  assert.equal(m.desconfia('Quem cuida disso é a Ana'), false)
})

test('rampa de abordagens: 10, depois +5 a cada dois dias, teto 30', async () => {
  const { limitePorDias } = await import('../api/_lib/prospeccao.js')
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 30].map((d) => limitePorDias(d)), [10, 10, 15, 15, 20, 20, 25, 25, 30, 30, 30])
  assert.equal(limitePorDias(-3), 10)
  assert.equal(limitePorDias(Number.NaN), 10)
})

test('"sobre?" e "em que posso ajudar?" pedem o assunto', async () => {
  const m = await import('../api/_lib/prospeccao.js')
  for (const t of ['Sobre?', 'Bom dia! Tudo bem Sobre?', 'Em que posso ajudar?', 'Por favor, me fala o que você busca', 'Qual o assunto?']) assert.equal(m.pedeObjetividade(t), true, t)
  assert.equal(m.pedeObjetividade('Falei sobre isso com o João'), false)
})

test('"odeio robô, já bloqueio na hora" é hostil e encerra; "pois não" e "?" pedem o assunto', async () => {
  const m = await import('../api/_lib/prospeccao.js')
  assert.equal(m.ehHostil('Amigo, odeio robô, meu atendimento é humanizado. Empresa que me responde através de IA eu não chamo nunca mais, eu já bloqueio na hora. Boa tarde.'), true)
  assert.equal(m.deveEncerrar([{ de: 'pessoa', texto: 'Empresa que me responde por IA eu bloqueio na hora.' }]), true)
  assert.equal(m.ehHostil('Não gosto muito de robô, mas me explica'), false)
  for (const t of ['Bom dia Pois não', '?', ' ?? ']) assert.equal(m.pedeObjetividade(t), true, t)
  assert.equal(m.pedeObjetividade('Pois é, perdemos cliente sim'), false)
})

test('"não preciso de volume, preciso de gente com dinheiro" pede triagem, não volume', async () => {
  const m = await import('../api/_lib/prospeccao.js')
  const dica = m.dicaDaObjecao([{ de: 'pessoa', texto: 'Não preciso de volume. Preciso de gente com o nome limpo e dinheiro para pagar o produto. Quem tem dinheiro não perde tempo em WhatsApp, liga direto' }])
  assert.match(dica, /triagem/)
  assert.doesNotMatch(dica, /REDUZA O ESFORÇO/)
})

test('"quem tem dinheiro não perde tempo, liga direto" não é recusa', async () => {
  const m = await import('../api/_lib/prospeccao.js')
  assert.equal(m.contarRecusas([{ de: 'pessoa', texto: 'Quem tem dinheiro..não perde tempo em WhatsApp nao Liga direto' }]), 0)
  assert.equal(m.contarRecusas([{ de: 'pessoa', texto: 'Não me liga, por favor' }]), 1)
  assert.equal(m.contarRecusas([{ de: 'pessoa', texto: 'Não manda mais mensagem' }]), 1)
})

test('abertura a frio é humana, com o nome da empresa, e ninguém lê "robô"', async () => {
  const m = await import('../api/_lib/prospeccao.js')
  const comNome = m.aberturaAFrio({ nome: 'Ribeiro Imóveis' })
  assert.match(comNome, /Aqui é a equipe do Eduardo, da Astro Soluções\. Vi a Ribeiro Imóveis aqui na região/)
  assert.match(comNome, /É com você que eu falo\?$/)
  assert.doesNotMatch(m.aberturaAFrio({ nome: '+5511999990000' }), /Vi a/)
  assert.doesNotMatch(m.aberturaAFrio({}), /assistente/i)
  for (const seg of ['imobiliaria', 'cursinho', 'odonto']) assert.doesNotMatch(m.apresentacaoDe(seg), /rob[oô]|\bbot\b|chatbot|\bIA\b/i, seg)
})

test('"com posso ajudar?" (erro de digitação) pede o assunto', async () => {
  const m = await import('../api/_lib/prospeccao.js')
  for (const t of ['Sim Com posso ajudar?', 'Posso ajudar?', 'No que posso ser útil']) assert.equal(m.pedeObjetividade(t), true, t)
})
