/**
 * Os contratos do motor do assistente, em JSDoc.
 *
 * O motor não conhece Supabase, Evolution API, Cal.com nem Groq: recebe um
 * canal (por onde fala), um repositório (onde lê e grava), uma agenda (onde
 * marca) e, opcionalmente, uma FAQ. É o que permite o simulador do painel
 * rodar exatamente o mesmo código que o WhatsApp de verdade, só trocando o
 * canal — e é o que permite testar cada etapa sem rede nenhuma.
 *
 * Isto aqui é JavaScript, e não TypeScript, por um motivo medido: a Vercel
 * não carrega um import com extensão `.ts` dentro de uma função. Quatro
 * funções-sonda mostraram que TypeScript sozinho sobe, TypeScript importando
 * `.js` sobe, e TypeScript importando `.ts` — de dentro ou de fora da pasta
 * da função — quebra na invocação. O editor continua entendendo tudo pelos
 * blocos abaixo.
 *
 * @typedef {'formal' | 'acolhedor' | 'descontraido'} TomDeVoz
 *
 * @typedef {Partial<Record<'seg'|'ter'|'qua'|'qui'|'sex'|'sab'|'dom', [string, string][]>>} HorarioFuncionamento
 *   Um dia da semana para a lista de intervalos ["09:00","12:00"].
 *
 * @typedef {object} Clinica
 * @property {string} id
 * @property {string} nome
 * @property {string | null} dentista_nome
 * @property {string | null} endereco
 * @property {string | null} link_maps
 * @property {string | null} recomendacoes
 * @property {string | null} telefone_recepcao
 * @property {string} timezone
 * @property {number | null} event_type_avaliacao
 * @property {number | null} event_type_limpeza
 * @property {HorarioFuncionamento} horario_funcionamento
 * @property {TomDeVoz} tom_voz
 * @property {string[]} palavras_urgencia
 * @property {number | null} valor_avaliacao
 * @property {Record<string, string>} mensagens  Textos escritos pela clínica; o que faltar vem do padrão.
 *
 * @typedef {object} Procedimento
 * @property {string} id
 * @property {string} nome
 * @property {number} duracao_min
 * @property {number} cal_event_type_id
 * @property {string | null} descricao
 *
 * @typedef {object} Paciente
 * @property {string} id
 * @property {string} nome
 * @property {string} telefone
 * @property {string | null} email
 *
 * @typedef {'avaliacao' | 'limpeza' | 'retorno' | 'tratamento'} TipoAgendamento
 *
 * @typedef {object} Agendamento
 * @property {string} id
 * @property {string} paciente_id
 * @property {string | null} cal_booking_uid
 * @property {number | null} event_type_id
 * @property {TipoAgendamento} tipo
 * @property {string} inicio
 * @property {string} fim
 * @property {'agendado'|'confirmado'|'cancelado'|'reagendado'|'faltou'|'concluido'} status
 *
 * @typedef {object} Conversa  O estado da conversa de um telefone numa clínica.
 * @property {string} etapa
 * @property {Record<string, unknown>} contexto
 * @property {boolean} humano_ativo
 * @property {number} tentativas_agenda
 *
 * @typedef {{ inicio: string }} Vaga
 *
 * @typedef {object} Canal  Por onde o bot fala: Evolution API de um lado, simulador do outro.
 * @property {(telefone: string, texto: string) => Promise<void>} enviarTexto
 * @property {(telefone: string, texto: string, opcoes: string[]) => Promise<void>} enviarOpcoes
 *   Opções numeradas. Quem implementa pode mandar botões de verdade; o motor
 *   entende tanto o número quanto o texto da opção na volta.
 *
 * @typedef {object} Agenda
 * @property {(eventTypeId: number, inicio: Date, fim: Date, timezone: string) => Promise<Vaga[]>} vagas
 * @property {(dados: { eventTypeId: number, inicio: string, nome: string, email: string, timezone: string }) => Promise<{ uid: string }>} criar
 * @property {(uid: string, motivo: string) => Promise<void>} cancelar
 *
 * @typedef {object} Repo
 * @property {(clinicaId: string, telefone: string) => Promise<Paciente | null>} buscarPaciente
 * @property {(clinicaId: string, dados: { telefone: string, nome: string, cpf: string, email: string }) => Promise<Paciente>} criarPaciente
 * @property {(id: string) => Promise<Paciente | null>} lerPaciente
 * @property {(clinicaId: string, telefone: string) => Promise<Conversa>} lerConversa
 * @property {(clinicaId: string, telefone: string, mudancas: Partial<Conversa>) => Promise<void>} salvarConversa
 * @property {(clinicaId: string) => Promise<Procedimento[]>} listarProcedimentos
 * @property {(dados: object) => Promise<{ id: string }>} criarAgendamento
 * @property {(id: string) => Promise<Agendamento | null>} lerAgendamento
 * @property {(id: string, mudancas: object) => Promise<void>} atualizarAgendamento
 * @property {(clinicaId: string, pacienteId: string, tipo: string, observacao: string) => Promise<void>} inserirListaEspera
 * @property {(clinicaId: string) => Promise<{ pergunta: string, resposta: string }[]>} listarConhecimento
 * @property {(clinicaId: string, telefone: string, pergunta: string) => Promise<void>} registrarSemResposta
 * @property {((clinicaId: string, telefone: string, motivo: string) => Promise<void>) | undefined} [notificarRecepcao]
 *   Avisa a recepção (painel, Telegram…). Opcional; falhar não pode travar o bot.
 *
 * @typedef {(pergunta: string, contexto: { clinica: Clinica, conhecimento: { pergunta: string, resposta: string }[] }) => Promise<string | null>} Faq
 *   Responde uma pergunta livre com a base de conhecimento; `null` = não sabe.
 *
 * @typedef {object} Deps
 * @property {Canal} canal
 * @property {Repo} repo
 * @property {Agenda} agenda
 * @property {Faq} [faq]
 * @property {() => Date} [agora]  Relógio injetável, para os testes.
 *
 * @typedef {object} Entrada  O que o motor precisa saber além do texto.
 * @property {string} telefone
 * @property {string} texto
 * @property {string} [nomeExibido]  O nome que o WhatsApp entrega; só para o registro, nunca vale como cadastro.
 * @property {boolean} [teste]  Conversa do simulador: os agendamentos vão marcados no Cal.com.
 */

export {}
