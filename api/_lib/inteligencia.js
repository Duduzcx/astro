/**
 * A inteligência que fala pela empresa — no chat do site e no WhatsApp.
 *
 * Mora aqui, e não dentro de uma rota, porque os dois canais usam a mesma
 * coisa: a mesma instrução mestre (editável no painel), o mesmo teto de
 * gasto por dia e o mesmo caminho de fuga. Sem chave configurada, nada
 * disto roda e cada canal segue com o seu roteiro, que responde bem e não
 * custa nada.
 *
 * Variáveis (painel da Vercel, Settings > Environment Variables):
 *   ANTHROPIC_API_KEY   liga o Claude. Tem precedência.
 *   OPENAI_API_KEY      liga o GPT, se não houver chave da Anthropic.
 *   BOT_MODELO          opcional, para fixar o modelo.
 *   BOT_TETO_DIARIO     opcional, máximo de respostas por dia (padrão 300).
 */
import { lerConfig } from './config.js'
import { prepararBanco, sql, temBanco } from './db.js'

const TETO_PADRAO = 300

/**
 * O prompt mestre. É o documento mais importante do sistema: é ele que
 * impede a inteligência de prometer o que a empresa não vai cumprir. O
 * painel o edita (aba Automação WhatsApp) e o que estiver salvo ganha
 * deste; isto é o padrão de fábrica.
 */
export const INSTRUCAO_PADRAO = [
  'Você é o atendimento da Astro Soluções, uma agência brasileira de tecnologia sob medida.',
  'A empresa constrói sites e portais, sistemas web, automações de processo e integrações entre ferramentas.',
  'O código entregue é 100% do cliente, com termo de cessão. O primeiro passo é sempre um diagnóstico gratuito de 20 a 30 minutos.',
  '',
  'Como você responde:',
  '- Em português do Brasil, no máximo três frases curtas por resposta.',
  '- Com o objetivo de entender o problema e levar a pessoa ao diagnóstico gratuito.',
  '- Peça o nome e um contato (WhatsApp ou e-mail) antes de encerrar.',
  '',
  'Regras que você NUNCA quebra:',
  '- Nunca invente preço, prazo ou funcionalidade. Se perguntarem, diga que o orçamento sai fechado depois do diagnóstico.',
  '- Nunca prometa nada em nome da empresa além de retorno da equipe.',
  '- Se não souber, diga que uma pessoa do time responde, e peça o contato.',
  '- Nunca peça senha, cartão ou dado bancário.',
].join('\n')

/** Qual inteligência está ligada: 'claude', 'openai' ou '' (nenhuma). */
export function qualInteligencia() {
  if (process.env.ANTHROPIC_API_KEY) return 'claude'
  /* Groq (Llama) vem antes da OpenAI: é grátis, e é o caminho para não gastar
     nada. console.groq.com dá a chave sem cartão. */
  if (process.env.GROQ_API_KEY) return 'groq'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return ''
}

export function temInteligencia() {
  return Boolean(qualInteligencia())
}

export function limpar(texto, limite = 1200) {
  return String(texto ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limite)
}

/** A instrução que está valendo: a do painel, ou o padrão de fábrica. */
export async function instrucaoAtual() {
  const salva = await lerConfig('bot_instrucao', null)
  return typeof salva === 'string' && salva.trim() ? salva : INSTRUCAO_PADRAO
}

/**
 * Teto diário de respostas. Usa a tabela de configuração como contador: sem
 * banco não há teto, e nesse caso o modelo só responde se alguém tiver
 * cadastrado uma chave de propósito — o que já é uma decisão consciente.
 */
export async function dentroDoTeto() {
  if (!temBanco()) return true
  /* O teto existe para proteger gasto de API paga. A Groq é grátis: sem
     gasto, sem teto (a não ser que alguém fixe BOT_TETO_DIARIO de propósito). */
  if (qualInteligencia() === 'groq' && !process.env.BOT_TETO_DIARIO) return true
  const teto = Number(process.env.BOT_TETO_DIARIO || TETO_PADRAO)
  if (!Number.isFinite(teto) || teto <= 0) return false
  const hoje = new Date().toISOString().slice(0, 10)
  try {
    await prepararBanco()
    const s = sql()
    const [linha] = await s`
      INSERT INTO config ${s({ chave: 'bot_uso', valor: JSON.stringify({ dia: hoje, quantas: 1 }) })}
      ON CONFLICT (chave) DO UPDATE SET
        valor = CASE
          WHEN config.valor->>'dia' = ${hoje}
            THEN jsonb_build_object('dia', ${hoje}, 'quantas', (config.valor->>'quantas')::int + 1)
          ELSE jsonb_build_object('dia', ${hoje}, 'quantas', 1)
        END,
        atualizado_em = now()
      RETURNING (valor->>'quantas')::int AS quantas`
    return (linha?.quantas || 1) <= teto
  } catch (erro) {
    /* Contador quebrado não pode derrubar o atendimento, mas também não pode
       liberar gasto sem limite: na dúvida, fecha. */
    console.error('contador do bot falhou:', erro?.message)
    return false
  }
}

async function comClaude(instrucao, mensagens) {
  const resposta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.BOT_MODELO || 'claude-sonnet-5',
      max_tokens: 400,
      system: instrucao,
      messages: mensagens,
    }),
  })
  if (!resposta.ok) throw new Error(`anthropic ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`)
  const dados = await resposta.json()
  return dados?.content?.find((parte) => parte.type === 'text')?.text || ''
}

async function comOpenAI(instrucao, mensagens) {
  const resposta = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.BOT_MODELO || 'gpt-4o-mini',
      max_tokens: 400,
      messages: [{ role: 'system', content: instrucao }, ...mensagens],
    }),
  })
  if (!resposta.ok) throw new Error(`openai ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`)
  const dados = await resposta.json()
  return dados?.choices?.[0]?.message?.content || ''
}

/**
 * A resposta do modelo, ou '' quando não há chave. `mensagens` são pares
 * { role: 'user' | 'assistant', content } já limpos por quem chama: texto
 * de fora nunca entra como instrução de sistema, que é exatamente como se
 * sequestra um atendimento.
 */
export async function responderComIA(instrucao, mensagens) {
  const qual = qualInteligencia()
  if (!qual) return ''
  const texto =
    qual === 'claude'
      ? await comClaude(instrucao, mensagens)
      : qual === 'groq'
        ? await comGroq(instrucao, mensagens)
        : await comOpenAI(instrucao, mensagens)
  return limpar(texto, 1500)
}

/**
 * Groq: a API grátis (Llama). É compatível com o formato da OpenAI, só muda o
 * endereço, a chave e o modelo. console.groq.com dá a chave sem cartão.
 */
/* Não fixa um nome de modelo: o catálogo da Groq muda e um nome fixo quebra
   (foi o 404 de `llama-3.3-70b-versatile`). Pergunta quais modelos a chave
   tem, descarta os que não conversam (classificadores, transcrição, voz,
   embeddings) e escolhe o melhor de chat, com preferência por família.
   Guardado em memória entre chamadas quentes. */
let modelosGroq = []
const NAO_CONVERSA = /guard|whisper|tts|orpheus|canopylabs|allam|embed|prompt-guard|moderation|vision-preview$/i
const PREFERENCIA = [/llama-4.*maverick/i, /llama-4/i, /gpt-oss-120b/i, /kimi-k2/i, /llama-3\.[0-9]+-70b/i, /gpt-oss/i, /deepseek/i, /llama-3/i, /qwen/i, /gemma/i, /mixtral/i]

/* Modelos que "pensam" antes de responder (Qwen3, gpt-oss, DeepSeek): o
   pensamento gasta o max_tokens e a resposta sai cortada no meio de uma
   palavra ("praticamente nenhum dos autom"). Para estes, pede sem raciocínio
   e esconde o que sobrar. */
const PENSA = /qwen|gpt-oss|deepseek|qwq|r1/i
const SEM_PENSAMENTO = /<think>[\s\S]*?<\/think>/gi

/** O modelo da Groq que está valendo (vazio antes da primeira chamada). */
export function modeloGroqEmUso() {
  return process.env.BOT_MODELO || process.env.GROQ_MODELO || modelosGroq[0] || ''
}

/* A fila de modelos de conversa da conta, do melhor para o pior. Não é um
   nome fixo (o catálogo muda) e não é um só: o plano grátis tem limite de
   tokens por minuto por modelo (429), e quando o primeiro estoura o próximo
   da fila responde, em vez de o robô ficar mudo. */
async function escolherModelosGroq() {
  const fixo = process.env.BOT_MODELO || process.env.GROQ_MODELO
  if (fixo) return [fixo]
  if (modelosGroq.length) return modelosGroq
  const r = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
  })
  if (!r.ok) throw new Error(`groq modelos ${r.status}: ${(await r.text()).slice(0, 160)}`)
  const dados = await r.json()
  const chat = (Array.isArray(dados?.data) ? dados.data : [])
    .map((m) => String(m.id))
    .filter((id) => !NAO_CONVERSA.test(id))
  if (chat.length === 0) throw new Error('a chave da Groq não tem nenhum modelo de conversa')
  const fila = []
  for (const regra of PREFERENCIA) for (const id of chat) if (regra.test(id) && !fila.includes(id)) fila.push(id)
  for (const id of chat) if (!fila.includes(id)) fila.push(id)
  return (modelosGroq = fila)
}

async function pedirGroq(corpo) {
  return fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(corpo),
  })
}

async function comGroq(instrucao, mensagens) {
  const fila = await escolherModelosGroq()
  let ultimo = null
  for (const model of fila.slice(0, 3)) {
    const base = {
      model,
      max_tokens: 900,
      temperature: 0.4,
      messages: [{ role: 'system', content: instrucao }, ...mensagens],
    }
    const pensa = PENSA.test(model)
    let resposta = await pedirGroq(pensa ? { ...base, reasoning_effort: /qwen|qwq/i.test(model) ? 'none' : 'low', reasoning_format: 'hidden' } : base)
    /* O modelo não aceitou os parâmetros de raciocínio: manda sem eles. */
    if (resposta.status === 400 && pensa) resposta = await pedirGroq(base)
    if (resposta.status === 429 || resposta.status >= 500) {
      /* Limite por minuto do plano grátis, ou o modelo caiu: o próximo da fila. */
      ultimo = new Error(`groq ${resposta.status} (modelo ${model}): ${(await resposta.text()).slice(0, 120)}`)
      continue
    }
    if (!resposta.ok) {
      /* Modelo saiu de linha entre a listagem e agora: a próxima chamada relista. */
      modelosGroq = []
      throw new Error(`groq ${resposta.status} (modelo ${model}): ${(await resposta.text()).slice(0, 160)}`)
    }
    const dados = await resposta.json()
    const escolha = dados?.choices?.[0]
    const texto = String(escolha?.message?.content || '').replace(SEM_PENSAMENTO, '').trim()
    if (!texto) throw new Error(`groq devolveu vazio (modelo ${model}, parou por ${escolha?.finish_reason || '?'})`)
    return texto
  }
  throw ultimo || new Error('groq: nenhum modelo respondeu')
}

/** Uma conversa guardada ({ de, texto }) vira o formato que o modelo lê. */
export function conversaParaMensagens(conversa, maximo = 16) {
  return (Array.isArray(conversa) ? conversa : [])
    .slice(-maximo)
    .filter((passo) => passo && (passo.de === 'pessoa' || passo.de === 'robo'))
    .map((passo) => ({
      role: passo.de === 'pessoa' ? 'user' : 'assistant',
      content: limpar(passo.texto, 800),
    }))
    .filter((m) => m.content)
}
