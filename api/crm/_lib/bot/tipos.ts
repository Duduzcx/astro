/**
 * Os contratos do motor do assistente.
 *
 * O motor não conhece Supabase, Evolution API, Cal.com nem Groq: recebe um
 * canal (por onde fala), um repositório (onde lê e grava), uma agenda (onde
 * marca) e, opcionalmente, uma FAQ. É o que permite o simulador do painel
 * rodar exatamente o mesmo código que o WhatsApp de verdade, só trocando o
 * canal — e é o que permite testar cada etapa sem rede nenhuma.
 */

export type TomDeVoz = 'formal' | 'acolhedor' | 'descontraido'

/** Um dia da semana → lista de intervalos ["09:00","12:00"]. */
export type HorarioFuncionamento = Partial<Record<'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom', [string, string][]>>

export type Clinica = {
  id: string
  nome: string
  dentista_nome: string | null
  endereco: string | null
  link_maps: string | null
  recomendacoes: string | null
  telefone_recepcao: string | null
  timezone: string
  event_type_avaliacao: number | null
  event_type_limpeza: number | null
  horario_funcionamento: HorarioFuncionamento
  tom_voz: TomDeVoz
  palavras_urgencia: string[]
  valor_avaliacao: number | null
  /** Textos do bot escritos pela clínica; o que faltar vem do padrão. */
  mensagens: Record<string, string>
}

export type Procedimento = {
  id: string
  nome: string
  duracao_min: number
  cal_event_type_id: number
  descricao: string | null
}

export type Paciente = {
  id: string
  nome: string
  telefone: string
  email: string | null
}

export type TipoAgendamento = 'avaliacao' | 'limpeza' | 'retorno' | 'tratamento'

export type Agendamento = {
  id: string
  paciente_id: string
  cal_booking_uid: string | null
  event_type_id: number | null
  tipo: TipoAgendamento
  inicio: string
  fim: string
  status: 'agendado' | 'confirmado' | 'cancelado' | 'reagendado' | 'faltou' | 'concluido'
}

/** O estado da conversa de um telefone numa clínica. */
export type Conversa = {
  etapa: string
  contexto: Record<string, unknown>
  humano_ativo: boolean
  tentativas_agenda: number
}

export type Vaga = { inicio: string }

/** Por onde o bot fala. Evolution API de um lado, simulador do outro. */
export type Canal = {
  enviarTexto(telefone: string, texto: string): Promise<void>
  /** Opções numeradas. Quem implementa pode mandar botões de verdade; o
      motor entende tanto o número quanto o texto da opção na volta. */
  enviarOpcoes(telefone: string, texto: string, opcoes: string[]): Promise<void>
}

export type Agenda = {
  vagas(eventTypeId: number, inicio: Date, fim: Date, timezone: string): Promise<Vaga[]>
  criar(dados: { eventTypeId: number; inicio: string; nome: string; email: string; timezone: string }): Promise<{ uid: string }>
  cancelar(uid: string, motivo: string): Promise<void>
}

export type Repo = {
  buscarPaciente(clinicaId: string, telefone: string): Promise<Paciente | null>
  criarPaciente(clinicaId: string, dados: { telefone: string; nome: string; cpf: string; email: string }): Promise<Paciente>
  lerPaciente(id: string): Promise<Paciente | null>
  /** Devolve a conversa, criando a linha inicial se não existir. */
  lerConversa(clinicaId: string, telefone: string): Promise<Conversa>
  salvarConversa(clinicaId: string, telefone: string, mudancas: Partial<Conversa>): Promise<void>
  listarProcedimentos(clinicaId: string): Promise<Procedimento[]>
  criarAgendamento(dados: {
    clinicaId: string
    pacienteId: string
    calBookingUid: string
    eventTypeId: number
    tipo: TipoAgendamento
    inicio: string
    fim: string
    queixa: string
  }): Promise<{ id: string }>
  lerAgendamento(id: string): Promise<Agendamento | null>
  atualizarAgendamento(id: string, mudancas: Partial<Agendamento> & { confirmado_em?: string }): Promise<void>
  inserirListaEspera(clinicaId: string, pacienteId: string, tipo: string, observacao: string): Promise<void>
  listarConhecimento(clinicaId: string): Promise<{ pergunta: string; resposta: string }[]>
  registrarSemResposta(clinicaId: string, telefone: string, pergunta: string): Promise<void>
  /** Avisa a recepção (painel, Telegram…). Opcional; falhar não pode travar o bot. */
  notificarRecepcao?(clinicaId: string, telefone: string, motivo: string): Promise<void>
}

/** Responde uma pergunta livre com a base de conhecimento; `null` = não sabe. */
export type Faq = (pergunta: string, contexto: { clinica: Clinica; conhecimento: { pergunta: string; resposta: string }[] }) => Promise<string | null>

export type Deps = {
  canal: Canal
  repo: Repo
  agenda: Agenda
  faq?: Faq
  /** Relógio injetável, para os testes. */
  agora?: () => Date
}

/** O que o motor precisa saber além do texto. */
export type Entrada = {
  telefone: string
  texto: string
  /** Nome que o WhatsApp entrega (pushName). Só para o registro; nunca vale como cadastro. */
  nomeExibido?: string
  /** Conversa do simulador: os agendamentos vão marcados no Cal.com. */
  teste?: boolean
}
