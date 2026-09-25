import type { Faq } from './tipos.ts'

/**
 * Perguntas livres respondidas com a base de conhecimento da clínica, por um
 * modelo de linguagem na Groq (plano gratuito, Llama).
 *
 * O modelo só vê a pergunta, os dados públicos da clínica e as entradas da
 * base: nunca nome, CPF ou telefone do paciente. E só pode responder com o
 * que está no contexto — sem diagnóstico, sem preço de tratamento (apenas o
 * valor da avaliação, se a clínica cadastrou). Quando não sabe, responde
 * exatamente SEM_RESPOSTA, que o motor transforma em "vou confirmar com a
 * equipe" e numa linha para a recepção resolver.
 */
const MODELO_PADRAO = 'llama-3.3-70b-versatile'

const TONS = {
  formal: 'Trate a pessoa por "senhor(a)", sem gírias e sem emojis.',
  acolhedor: 'Seja gentil e próximo, com no máximo um emoji por resposta.',
  descontraido: 'Seja leve e informal, como um recepcionista simpático; emojis são bem-vindos com moderação.',
}

export function criarFaq(env: { GROQ_API_KEY?: string; GROQ_MODELO?: string }): Faq | undefined {
  const chave = env.GROQ_API_KEY
  if (!chave) return undefined
  const modelo = env.GROQ_MODELO || MODELO_PADRAO

  return async (pergunta, { clinica, conhecimento }) => {
    const sistema = [
      `Você é o assistente virtual da clínica odontológica "${clinica.nome}". Responda em português do Brasil, em no máximo três frases.`,
      'REGRAS ABSOLUTAS:',
      '- Responda SOMENTE com base no contexto fornecido abaixo. Não invente informação nenhuma.',
      '- Nunca dê diagnóstico, nunca opine sobre sintomas nem indique tratamento: diga que isso é avaliado na consulta.',
      clinica.valor_avaliacao
        ? `- O único valor que você pode informar é o da avaliação: R$ ${clinica.valor_avaliacao}. Preço de qualquer tratamento é definido na avaliação.`
        : '- Nunca informe preço de nada: valores são definidos na avaliação.',
      '- Se a resposta não estiver no contexto, responda exatamente: SEM_RESPOSTA',
      `- Tom de voz: ${TONS[clinica.tom_voz] || TONS.acolhedor}`,
      '',
      'CONTEXTO DA CLÍNICA:',
      `Nome: ${clinica.nome}`,
      clinica.dentista_nome ? `Dentista: ${clinica.dentista_nome}` : '',
      clinica.endereco ? `Endereço: ${clinica.endereco}` : '',
      clinica.telefone_recepcao ? `Telefone da recepção: ${clinica.telefone_recepcao}` : '',
      clinica.horario_funcionamento && Object.keys(clinica.horario_funcionamento).length
        ? `Horário de funcionamento: ${JSON.stringify(clinica.horario_funcionamento)}`
        : '',
      clinica.recomendacoes ? `Recomendações antes da consulta: ${clinica.recomendacoes}` : '',
      '',
      'BASE DE CONHECIMENTO (perguntas e respostas aprovadas pela clínica):',
      ...conhecimento.map((c, i) => `${i + 1}. P: ${c.pergunta}\n   R: ${c.resposta}`),
    ]
      .filter((linha) => linha !== '')
      .join('\n')

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          { role: 'system', content: sistema },
          { role: 'user', content: pergunta.slice(0, 800) },
        ],
      }),
      signal: AbortSignal.timeout(9000),
    })
    if (!r.ok) throw new Error(`groq ${r.status}`)
    const dados = (await r.json()) as { choices?: { message?: { content?: string } }[] }
    const resposta = (dados.choices?.[0]?.message?.content || '').trim()
    if (!resposta || /SEM_RESPOSTA/i.test(resposta)) return null
    return resposta
  }
}
