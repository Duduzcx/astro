import test from 'node:test'
import assert from 'node:assert/strict'
import { processar } from '../lib/bot/motor.ts'
import type { Agendamento, Clinica, Conversa, Deps, Paciente, Procedimento, Repo, Vaga } from '../lib/bot/tipos.ts'

/* O motor inteiro, sem rede: canal, repositório e agenda falsos. Cada teste
   conta uma conversa e confere o que saiu, o que foi gravado e a etapa em
   que a conversa ficou. */

const CLINICA: Clinica = {
  id: 'cli-1',
  nome: 'Clínica Sorriso',
  dentista_nome: 'Dra. Ana',
  endereco: 'Rua das Flores, 10',
  link_maps: 'https://maps.example/x',
  recomendacoes: 'Chegue 10 minutos antes.',
  telefone_recepcao: '(11) 4000-0000',
  timezone: 'America/Sao_Paulo',
  event_type_avaliacao: 111,
  event_type_limpeza: 222,
  horario_funcionamento: {},
  tom_voz: 'acolhedor',
  palavras_urgencia: ['dor', 'inchaço', 'trauma', 'quebrou', 'sangue', 'urgente', 'emergência'],
  valor_avaliacao: null,
  mensagens: {},
}

const PROCEDIMENTOS: Procedimento[] = [
  { id: 'p1', nome: 'Avaliação', duracao_min: 30, cal_event_type_id: 111, descricao: null },
  { id: 'p2', nome: 'Limpeza', duracao_min: 60, cal_event_type_id: 222, descricao: null },
]

const VAGAS: Vaga[] = [
  { inicio: '2026-10-01T13:00:00.000Z' },
  { inicio: '2026-10-01T14:00:00.000Z' },
  { inicio: '2026-10-02T13:00:00.000Z' },
  { inicio: '2026-10-03T13:00:00.000Z' },
]

type Saida = { telefone: string; texto: string; opcoes?: string[] }

function fabrica(opcoes: { vagas?: Vaga[]; criarFalha?: number; faq?: Deps['faq']; agora?: Date; procedimentos?: Procedimento[] } = {}) {
  const enviadas: Saida[] = []
  const estado = {
    pacientes: [] as (Paciente & { clinicaId: string; cpf: string })[],
    conversas: new Map<string, Conversa>(),
    agendamentos: [] as (Agendamento & { queixa: string; clinicaId: string })[],
    espera: [] as { pacienteId: string; tipo: string }[],
    semResposta: [] as string[],
    notificacoes: [] as string[],
    criadosNaAgenda: [] as { nome: string; inicio: string; eventTypeId: number }[],
    cancelados: [] as string[],
  }
  let falhasRestantes = opcoes.criarFalha ?? 0
  let ids = 0
  const repo: Repo = {
    async buscarPaciente(clinicaId, telefone) {
      return estado.pacientes.find((p) => p.clinicaId === clinicaId && p.telefone === telefone) ?? null
    },
    async criarPaciente(clinicaId, dados) {
      const p = { id: `pac-${++ids}`, clinicaId, ...dados }
      estado.pacientes.push(p)
      return p
    },
    async lerPaciente(id) {
      return estado.pacientes.find((p) => p.id === id) ?? null
    },
    async lerConversa(clinicaId, telefone) {
      const chave = `${clinicaId}:${telefone}`
      if (!estado.conversas.has(chave)) estado.conversas.set(chave, { etapa: 'inicio', contexto: {}, humano_ativo: false, tentativas_agenda: 0 })
      return { ...estado.conversas.get(chave)!, contexto: { ...estado.conversas.get(chave)!.contexto } }
    },
    async salvarConversa(clinicaId, telefone, mudancas) {
      const chave = `${clinicaId}:${telefone}`
      estado.conversas.set(chave, { ...(await this.lerConversa(clinicaId, telefone)), ...mudancas })
    },
    async listarProcedimentos() {
      return opcoes.procedimentos ?? PROCEDIMENTOS
    },
    async criarAgendamento(dados) {
      const a = { id: `ag-${++ids}`, paciente_id: dados.pacienteId, cal_booking_uid: dados.calBookingUid, event_type_id: dados.eventTypeId, tipo: dados.tipo, inicio: dados.inicio, fim: dados.fim, status: 'agendado' as const, queixa: dados.queixa, clinicaId: dados.clinicaId }
      estado.agendamentos.push(a)
      return { id: a.id }
    },
    async lerAgendamento(id) {
      return estado.agendamentos.find((a) => a.id === id) ?? null
    },
    async atualizarAgendamento(id, mudancas) {
      const a = estado.agendamentos.find((x) => x.id === id)
      if (a) Object.assign(a, mudancas)
    },
    async inserirListaEspera(_clinicaId, pacienteId, tipo) {
      estado.espera.push({ pacienteId, tipo })
    },
    async listarConhecimento() {
      return [{ pergunta: 'Aceitam convênio?', resposta: 'Aceitamos Odontoprev e Amil.' }]
    },
    async registrarSemResposta(_clinicaId, _telefone, pergunta) {
      estado.semResposta.push(pergunta)
    },
    async notificarRecepcao(_clinicaId, _telefone, motivo) {
      estado.notificacoes.push(motivo)
    },
  }
  const deps: Deps = {
    canal: {
      async enviarTexto(telefone, texto) {
        enviadas.push({ telefone, texto })
      },
      async enviarOpcoes(telefone, texto, opcoes) {
        enviadas.push({ telefone, texto, opcoes })
      },
    },
    repo,
    agenda: {
      async vagas() {
        return opcoes.vagas ?? VAGAS
      },
      async criar(dados) {
        if (falhasRestantes > 0) {
          falhasRestantes -= 1
          throw new Error('slot já reservado')
        }
        estado.criadosNaAgenda.push({ nome: dados.nome, inicio: dados.inicio, eventTypeId: dados.eventTypeId })
        return { uid: `uid-${estado.criadosNaAgenda.length}` }
      },
      async cancelar(uid) {
        estado.cancelados.push(uid)
      },
    },
    faq: opcoes.faq,
    agora: () => opcoes.agora ?? new Date('2026-09-28T12:00:00.000Z'),
  }
  const falar = (texto: string, teste = false) => processar(deps, CLINICA, { telefone: '+5511999990000', texto, teste })
  const etapa = () => estado.conversas.get('cli-1:+5511999990000')?.etapa
  const ultima = () => enviadas[enviadas.length - 1]
  return { deps, falar, etapa, ultima, enviadas, estado }
}

test('paciente novo: nome, CPF, motivo, tipo, vaga e confirmação', async () => {
  const f = fabrica()
  await f.falar('oi')
  assert.match(f.enviadas[0].texto, /assistente virtual da Clínica Sorriso/)
  assert.match(f.ultima().texto, /nome completo/)
  assert.equal(f.etapa(), 'coletando_nome')

  await f.falar('Ana')
  assert.match(f.ultima().texto, /nome completo/)
  assert.equal(f.etapa(), 'coletando_nome')

  await f.falar('Ana Souza')
  assert.match(f.ultima().texto, /Ana!.*CPF/s)
  assert.equal(f.etapa(), 'coletando_cpf')

  await f.falar('123')
  assert.match(f.ultima().texto, /11 números/)

  await f.falar('123.456.789-01')
  assert.equal(f.estado.pacientes.length, 1)
  assert.equal(f.estado.pacientes[0].cpf, '12345678901')
  assert.equal(f.estado.pacientes[0].email, '5511999990000@paciente.astro.bot')
  assert.match(f.ultima().texto, /motivo da consulta/)
  assert.equal(f.etapa(), 'triagem')

  await f.falar('quero fazer uma limpeza')
  assert.deepEqual(f.ultima().opcoes, ['Avaliação 30min', 'Limpeza 60min'])
  assert.equal(f.etapa(), 'escolhendo_tipo')

  await f.falar('2')
  assert.equal(f.ultima().opcoes?.length, 3)
  assert.match(f.ultima().opcoes![0], /01\/10 às 10:00/)
  assert.equal(f.etapa(), 'escolhendo_vaga')

  await f.falar('1')
  assert.equal(f.estado.criadosNaAgenda.length, 1)
  assert.equal(f.estado.criadosNaAgenda[0].nome, 'Ana Souza')
  assert.equal(f.estado.criadosNaAgenda[0].eventTypeId, 222)
  assert.equal(f.estado.agendamentos.length, 1)
  assert.equal(f.estado.agendamentos[0].tipo, 'limpeza')
  assert.equal(f.estado.agendamentos[0].fim, '2026-10-01T14:00:00.000Z')
  assert.equal(f.estado.agendamentos[0].queixa, 'quero fazer uma limpeza')
  assert.match(f.ultima().texto, /Agendado!/)
  assert.match(f.ultima().texto, /Limpeza/)
  assert.match(f.ultima().texto, /Dra\. Ana/)
  assert.match(f.ultima().texto, /Rua das Flores/)
  assert.match(f.ultima().texto, /Chegue 10 minutos antes/)
  assert.equal(f.etapa(), 'concluido')
})

test('urgência na triagem transfere para a recepção e o bot cala', async () => {
  const f = fabrica()
  await f.falar('oi')
  await f.falar('Bruno Lima')
  await f.falar('11111111111')
  await f.falar('estou com muita DOR e o dente quebrou')
  assert.match(f.ultima().texto, /recepção/)
  assert.ok(f.estado.notificacoes.some((n) => n.startsWith('urgência')))
  const antes = f.enviadas.length
  await f.falar('alguém aí?')
  assert.equal(f.enviadas.length, antes, 'com a recepção no comando o bot não responde')
})

test('paciente conhecido recebe o menu, e a opção 3 chama a recepção', async () => {
  const f = fabrica()
  f.estado.pacientes.push({ id: 'pac-x', clinicaId: 'cli-1', telefone: '+5511999990000', nome: 'Carla Dias', email: null, cpf: '22222222222' })
  await f.falar('boa tarde')
  assert.match(f.ultima().texto, /Carla!.*de volta/s)
  assert.deepEqual(f.ultima().opcoes, ['Agendar consulta', 'Retorno/Manutenção', 'Falar com recepção'])
  await f.falar('falar com recepção')
  assert.ok(f.estado.notificacoes.includes('pediu a recepção'))
  assert.equal(f.estado.conversas.get('cli-1:+5511999990000')?.humano_ativo, true)
})

test('retorno pelo menu pula a triagem e marca como retorno', async () => {
  const f = fabrica()
  f.estado.pacientes.push({ id: 'pac-x', clinicaId: 'cli-1', telefone: '+5511999990000', nome: 'Carla Dias', email: null, cpf: '22222222222' })
  await f.falar('oi')
  await f.falar('2')
  assert.equal(f.etapa(), 'escolhendo_tipo')
  await f.falar('avaliação')
  await f.falar('2')
  assert.equal(f.estado.agendamentos[0].tipo, 'retorno')
})

test('sem vagas: lista de espera; na segunda vez, recepção', async () => {
  const f = fabrica({ vagas: [] })
  f.estado.pacientes.push({ id: 'pac-x', clinicaId: 'cli-1', telefone: '+5511999990000', nome: 'Carla Dias', email: null, cpf: '22222222222' })
  await f.falar('oi')
  await f.falar('1')
  await f.falar('consulta de rotina')
  await f.falar('1')
  assert.match(f.ultima().texto, /lista de espera/)
  assert.deepEqual(f.estado.espera, [{ pacienteId: 'pac-x', tipo: 'avaliacao' }])
  assert.equal(f.etapa(), 'inicio')
  await f.falar('oi')
  await f.falar('1')
  await f.falar('consulta')
  await f.falar('1')
  assert.match(f.ultima().texto, /passar para a recepção/)
  assert.equal(f.estado.conversas.get('cli-1:+5511999990000')?.humano_ativo, true)
})

test('vaga ocupada na hora de marcar: refaz a busca uma vez', async () => {
  const f = fabrica({ criarFalha: 1 })
  f.estado.pacientes.push({ id: 'pac-x', clinicaId: 'cli-1', telefone: '+5511999990000', nome: 'Carla Dias', email: null, cpf: '22222222222' })
  await f.falar('oi')
  await f.falar('1')
  await f.falar('dente sensível')
  await f.falar('1')
  await f.falar('1')
  assert.match(f.ultima().texto, /acabou de ser ocupado/)
  assert.equal(f.etapa(), 'escolhendo_vaga')
  await f.falar('2')
  assert.equal(f.estado.agendamentos.length, 1)
  assert.equal(f.etapa(), 'concluido')
})

test('lembrete: "sim" confirma, "reagendar" cancela no Cal.com e reabre a escolha', async () => {
  const f = fabrica()
  f.estado.pacientes.push({ id: 'pac-x', clinicaId: 'cli-1', telefone: '+5511999990000', nome: 'Carla Dias', email: null, cpf: '22222222222' })
  f.estado.agendamentos.push({ id: 'ag-9', paciente_id: 'pac-x', cal_booking_uid: 'uid-9', event_type_id: 111, tipo: 'avaliacao', inicio: '2026-09-28T16:00:00.000Z', fim: '2026-09-28T16:30:00.000Z', status: 'agendado', queixa: '', clinicaId: 'cli-1' })
  f.estado.conversas.set('cli-1:+5511999990000', { etapa: 'aguardando_confirmacao', contexto: { agendamento_id: 'ag-9', paciente_id: 'pac-x', nome: 'Carla Dias' }, humano_ativo: false, tentativas_agenda: 0 })
  await f.falar('Sim, confirmo')
  assert.equal(f.estado.agendamentos[0].status, 'confirmado')
  assert.match(f.ultima().texto, /confirmada/)

  f.estado.agendamentos[0].status = 'agendado'
  f.estado.conversas.set('cli-1:+5511999990000', { etapa: 'aguardando_confirmacao', contexto: { agendamento_id: 'ag-9', paciente_id: 'pac-x' }, humano_ativo: false, tentativas_agenda: 0 })
  await f.falar('2')
  assert.deepEqual(f.estado.cancelados, ['uid-9'])
  assert.equal(f.estado.agendamentos[0].status, 'cancelado')
  assert.equal(f.etapa(), 'escolhendo_tipo')
  await f.falar('1')
  await f.falar('1')
  assert.equal(f.estado.agendamentos[1].tipo, 'retorno')
})

test('pergunta livre no meio da etapa: responde pela base e retoma a etapa', async () => {
  const f = fabrica({ faq: async (pergunta) => (/conv[eê]nio/i.test(pergunta) ? 'Aceitamos Odontoprev e Amil.' : null) })
  await f.falar('oi')
  await f.falar('vocês aceitam convênio?')
  const respostas = f.enviadas.slice(-2).map((s) => s.texto)
  assert.equal(respostas[0], 'Aceitamos Odontoprev e Amil.')
  assert.match(respostas[1], /nome completo/)
  assert.equal(f.etapa(), 'coletando_nome')

  await f.falar('qual o estacionamento mais perto?')
  assert.deepEqual(f.estado.semResposta, ['qual o estacionamento mais perto?'])
  assert.match(f.enviadas[f.enviadas.length - 2].texto, /confirmar essa informação com a equipe/)
  assert.ok(f.estado.notificacoes.includes('pergunta sem resposta'))
  assert.equal(f.etapa(), 'coletando_nome')
})

test('fora do horário de funcionamento o bot avisa uma vez e agenda mesmo assim', async () => {
  const f = fabrica({ agora: new Date('2026-09-27T15:00:00.000Z') })
  const clinica = { ...CLINICA, horario_funcionamento: { seg: [['09:00', '18:00']] as [string, string][] } }
  const falar = (t: string) => processar(f.deps, clinica, { telefone: '+5511999990000', texto: t })
  f.estado.pacientes.push({ id: 'pac-x', clinicaId: 'cli-1', telefone: '+5511999990000', nome: 'Carla Dias', email: null, cpf: '22222222222' })
  await falar('oi')
  await falar('1')
  await falar('consulta')
  assert.ok(f.enviadas.some((s) => /fora do horário/.test(s.texto)))
  assert.equal(f.enviadas.filter((s) => /fora do horário/.test(s.texto)).length, 1)
  await falar('1')
  await falar('1')
  assert.equal(f.estado.agendamentos.length, 1)
})

test('no simulador o agendamento vai marcado como teste no Cal.com', async () => {
  const f = fabrica()
  f.estado.pacientes.push({ id: 'pac-x', clinicaId: 'cli-1', telefone: '+5511999990000', nome: 'Carla Dias', email: null, cpf: '22222222222' })
  await f.falar('oi', true)
  await f.falar('1', true)
  await f.falar('consulta', true)
  await f.falar('1', true)
  await f.falar('1', true)
  assert.equal(f.estado.criadosNaAgenda[0].nome, '[TESTE] Carla Dias')
})

test('sem procedimentos cadastrados, os dois tipos de evento da clínica servem', async () => {
  const f = fabrica({ procedimentos: [] })
  f.estado.pacientes.push({ id: 'pac-x', clinicaId: 'cli-1', telefone: '+5511999990000', nome: 'Carla Dias', email: null, cpf: '22222222222' })
  await f.falar('oi')
  await f.falar('1')
  await f.falar('consulta')
  assert.deepEqual(f.ultima().opcoes, ['Avaliação 30min', 'Limpeza 60min'])
})
