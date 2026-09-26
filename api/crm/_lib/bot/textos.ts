import type { Clinica, TomDeVoz } from './tipos.ts'
import { preencher } from './util.ts'

/**
 * Os textos do assistente. A clínica pode reescrever qualquer um pelo painel
 * (config_clinica.mensagens); o que ela não escrever vem daqui. As chaves
 * entre chaves são preenchidas na hora: {nome}, {clinica}, {dentista},
 * {endereco}, {maps}, {recomendacoes}, {tipo}, {data}, {valor}, {recepcao}.
 *
 * O tom de voz muda só o cumprimento e o fecho: o corpo de cada mensagem é o
 * mesmo, porque o que a mensagem PEDE não pode mudar com o tom.
 */
export const CHAVES_TEXTO = [
  'apresentacao',
  'pedirNome',
  'nomeInvalido',
  'pedirCpf',
  'cpfInvalido',
  'pedirMotivo',
  'boasVindasVolta',
  'urgencia',
  'escolherTipo',
  'vagas',
  'semVagas',
  'vagaOcupada',
  'confirmacao',
  'foraHorario',
  'limiteTentativas',
  'recepcao',
  'faqSemResposta',
  'lembrete',
  'confirmado',
  'cancelado',
  'naoEntendi',
] as const

export type ChaveTexto = (typeof CHAVES_TEXTO)[number]

export const ROTULOS_TEXTO: Record<ChaveTexto, string> = {
  apresentacao: 'Apresentação (paciente novo)',
  pedirNome: 'Pedir o nome',
  nomeInvalido: 'Nome incompleto',
  pedirCpf: 'Pedir o CPF',
  cpfInvalido: 'CPF inválido',
  pedirMotivo: 'Pedir o motivo da consulta',
  boasVindasVolta: 'Boas-vindas (paciente conhecido)',
  urgencia: 'Urgência (transfere para a recepção)',
  escolherTipo: 'Escolher o tipo de consulta',
  vagas: 'Oferecer horários',
  semVagas: 'Sem vagas (lista de espera)',
  vagaOcupada: 'Horário acabou de ser ocupado',
  confirmacao: 'Confirmação do agendamento',
  foraHorario: 'Aviso fora do horário de funcionamento',
  limiteTentativas: 'Limite de tentativas (transfere)',
  recepcao: 'Falar com a recepção',
  faqSemResposta: 'Pergunta que o bot não soube responder',
  lembrete: 'Lembrete no dia da consulta',
  confirmado: 'Presença confirmada',
  cancelado: 'Consulta cancelada (reagendar)',
  naoEntendi: 'Não entendeu a resposta',
}

export const TEXTOS_PADRAO: Record<ChaveTexto, string> = {
  apresentacao: '{saudacao} Aqui é o assistente virtual da {clinica}. Vou te ajudar a marcar sua consulta.',
  pedirNome: 'Para começar, me diga seu nome completo, por favor.',
  nomeInvalido: 'Preciso do nome completo (nome e sobrenome). Pode me dizer?',
  pedirCpf: 'Obrigado, {nome}! Agora, qual é o seu CPF? (só os números)',
  cpfInvalido: 'Não consegui reconhecer o CPF. São 11 números, pode conferir e mandar de novo?',
  pedirMotivo: 'Perfeito. Me conta em poucas palavras o motivo da consulta.',
  boasVindasVolta: '{saudacao} {nome}! Bem-vindo(a) de volta à {clinica}. Como posso ajudar?',
  urgencia:
    'Entendi, e sinto muito. Isso pede atenção agora: já passei sua conversa para a recepção, que vai responder por aqui o quanto antes. Se a dor for forte, ligue para {recepcao}.',
  escolherTipo: 'Qual tipo de atendimento você precisa?',
  vagas: 'Estes são os próximos horários disponíveis para {tipo}:',
  semVagas:
    'No momento não há horários livres nos próximos 14 dias. Coloquei você na nossa lista de espera: assim que abrir uma vaga, a recepção avisa por aqui.',
  vagaOcupada: 'Esse horário acabou de ser ocupado. Estes são os próximos disponíveis:',
  confirmacao:
    'Agendado! ✅\n\n*{tipo}*\n📅 {data}\n🦷 {dentista}\n📍 {endereco}\n{maps}\n\n{recomendacoes}\n\nSe precisar remarcar, é só me chamar por aqui.',
  foraHorario:
    'Estamos fora do horário de atendimento, mas eu continuo por aqui: você pode agendar normalmente, e a recepção responde no próximo horário útil.',
  limiteTentativas: 'Não consegui encontrar um horário que sirva. Vou passar para a recepção, que resolve isso com você por aqui.',
  recepcao: 'Claro. Já avisei a recepção, e alguém responde por aqui em instantes.',
  faqSemResposta: 'Boa pergunta. Vou confirmar essa informação com a equipe e te respondo por aqui.',
  lembrete:
    '{saudacao} {nome}! Sua {tipo} com {dentista} é hoje às {hora}. Confirma sua presença?\n\n1) Sim, confirmo\n2) Preciso reagendar',
  confirmado: 'Presença confirmada. Até logo, {nome}! {fecho}',
  cancelado: 'Sem problema, cancelei esse horário. Vamos escolher outro:',
  naoEntendi: 'Não entendi. Pode responder com o número da opção?',
}

const SAUDACAO: Record<TomDeVoz, string> = {
  formal: 'Olá.',
  acolhedor: 'Olá! 😊',
  descontraido: 'Oi! 👋',
}

const FECHO: Record<TomDeVoz, string> = {
  formal: 'Ficamos à disposição.',
  acolhedor: 'Estamos te esperando com carinho.',
  descontraido: 'Te vejo lá!',
}

export type Valores = Record<string, string | number | null | undefined>

/** O texto de uma chave, com o que a clínica escreveu por cima do padrão. */
export function texto(clinica: Pick<Clinica, 'mensagens' | 'tom_voz' | 'nome' | 'dentista_nome' | 'endereco' | 'link_maps' | 'recomendacoes' | 'telefone_recepcao' | 'valor_avaliacao'>, chave: ChaveTexto, valores: Valores = {}) {
  const modelo = (clinica.mensagens && clinica.mensagens[chave]) || TEXTOS_PADRAO[chave]
  const tom = clinica.tom_voz || 'acolhedor'
  return preencher(modelo, {
    saudacao: SAUDACAO[tom],
    fecho: FECHO[tom],
    clinica: clinica.nome,
    dentista: clinica.dentista_nome || 'a equipe',
    endereco: clinica.endereco || '',
    maps: clinica.link_maps || '',
    recomendacoes: clinica.recomendacoes || '',
    recepcao: clinica.telefone_recepcao || 'a recepção',
    valor: clinica.valor_avaliacao === null || clinica.valor_avaliacao === undefined ? '' : String(clinica.valor_avaliacao),
    ...valores,
  })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
