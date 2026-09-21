/**
 * Os textos que o robô do WhatsApp responde.
 *
 * Moram aqui, e não dentro da rota, porque o painel também precisa deles:
 * ele mostra o que está valendo e deixa a equipe editar. O que está no banco
 * ganha do que está aqui; isto é o padrão de fábrica, e o que responde
 * quando o banco não está ligado.
 */
const MENU = [
  'Posso ajudar por aqui mesmo. Escolha um número:',
  '',
  '*1* — Agendar o diagnóstico gratuito',
  '*2* — O que a Astro faz',
  '*3* — Prazo e investimento',
  '*4* — Falar com uma pessoa do time',
].join('\n')

const RESPOSTAS = {
  1: [
    'Combinado! O diagnóstico é uma conversa de 20 a 30 minutos, sem custo e sem compromisso.',
    '',
    'Me conta, por favor:',
    '• o que mais toma tempo da sua equipe hoje;',
    '• dois horários que funcionam para você nesta semana.',
    '',
    'Eu deixo anotado e alguém do time confirma por aqui.',
  ].join('\n'),
  2: [
    'A Astro Soluções constrói o que a sua operação hoje faz na mão: sites e portais, sistemas web, automações e integrações entre as ferramentas que você já usa.',
    '',
    'O código é 100% seu, com termo de cessão — você não fica preso a ninguém, nem à gente.',
    '',
    'Exemplos: https://astrosolucoes.vercel.app/#projetos',
  ].join('\n'),
  3: [
    'Depende do tamanho, e a gente não chuta: o orçamento sai depois do diagnóstico, fechado, com escopo e cronograma no papel.',
    '',
    'Como referência, um site institucional costuma levar de 3 a 5 semanas e um sistema sob medida de 6 a 12. O pagamento acompanha as etapas entregues.',
    '',
    'Digite *1* para agendar o diagnóstico e ter um número de verdade.',
  ].join('\n'),
  4: [
    'Claro. Já avisei o time — alguém responde por aqui em instantes.',
    '',
    'O atendimento humano é das 8h às 21h, e fora desse horário há plantão para urgência.',
    '',
    'Se quiser adiantar, me conte em uma frase o que você precisa.',
  ].join('\n'),
}

const BOAS_VINDAS = ['Olá! Aqui é o atendimento da *Astro Soluções* 👋', '', 'Que bom ter você por aqui.'].join('\n')

const NAO_ENTENDI = [
  'Anotado! Uma pessoa do time lê e responde por aqui — das 8h às 21h costuma ser em minutos.',
  '',
  'Se preferir adiantar, escolha um número:',
].join('\n')

export const TEXTOS_PADRAO = {
  menu: MENU,
  boasVindas: BOAS_VINDAS,
  naoEntendi: NAO_ENTENDI,
  opcao1: RESPOSTAS[1],
  opcao2: RESPOSTAS[2],
  opcao3: RESPOSTAS[3],
  opcao4: RESPOSTAS[4],
}
