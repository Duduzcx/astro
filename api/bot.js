/**
 * A ponte do atendimento inteligente.
 *
 * Recebe uma mensagem do chat do site e devolve a resposta. Hoje ela sai de
 * um modelo de linguagem — Claude ou OpenAI, o que estiver configurado. Sem
 * chave nenhuma, responde `{ modo: 'roteiro' }` e o chat do site segue com as
 * seis perguntas de sempre, que funcionam e não custam nada.
 *
 * SOBRE O PEDIDO DE UMA NETLIFY FUNCTION: o site saiu do Netlify e está na
 * Vercel. Uma função em /netlify/functions não seria executada por ninguém —
 * seria um arquivo morto dando a impressão de que existe atendimento. Esta é
 * a mesma coisa, no lugar onde de fato roda: /api/bot. Se um dia o site
 * voltar para o Netlify, o corpo deste arquivo migra sem mudar uma linha de
 * lógica; muda o invólucro (handler(req, res) vira (event, context)).
 *
 * Variáveis (painel da Vercel, Settings > Environment Variables):
 *   ANTHROPIC_API_KEY   liga o Claude. Tem precedência.
 *   OPENAI_API_KEY      liga o GPT, se não houver chave da Anthropic.
 *   BOT_MODELO          opcional, para fixar o modelo.
 *   BOT_TETO_DIARIO     opcional, máximo de respostas por dia (padrão 300).
 *
 * O teto diário existe porque este endereço é público e cada chamada custa
 * dinheiro. Sem ele, um roteiro simples consome a conta da empresa numa
 * madrugada.
 */
import { botAtivo, lerConfig } from './_lib/config.js'
import { prepararBanco, sql, temBanco } from './_lib/db.js'
import { registrarLog } from './_lib/logs.js'

export const config = { api: { bodyParser: false } }

const LIMITE_CORPO = 32 * 1024
const MAX_HISTORICO = 16
const TETO_PADRAO = 300

const INSTRUCAO_PADRAO = [
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

function corpoCru(req) {
  return new Promise((resolve, reject) => {
    const partes = []
    let tamanho = 0
    req.on('data', (p) => {
      tamanho += p.length
      if (tamanho > LIMITE_CORPO) {
        reject(new Error('corpo grande demais'))
        req.destroy()
        return
      }
      partes.push(p)
    })
    req.on('end', () => resolve(Buffer.concat(partes)))
    req.on('error', reject)
  })
}

/** Só aceita chamada da própria página. Corta o roteiro que varre a internet. */
function mesmaOrigem(req) {
  const origem = req.headers.origin
  if (!origem) return true
  try {
    return new URL(origem).host === req.headers.host
  } catch {
    return false
  }
}

function limpar(texto, limite = 1200) {
  return String(texto ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limite)
}

/**
 * Teto diário de respostas. Usa a tabela de configuração como contador: sem
 * banco não há teto, e nesse caso o modelo só responde se alguém tiver
 * cadastrado uma chave de propósito — o que já é uma decisão consciente.
 */
async function dentroDoTeto() {
  if (!temBanco()) return true
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

async function responderComClaude(instrucao, mensagens) {
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

async function responderComOpenAI(instrucao, mensagens) {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ erro: 'método não permitido' })
  }
  if (!mesmaOrigem(req)) return res.status(403).json({ erro: 'origem não permitida' })

  const comClaude = Boolean(process.env.ANTHROPIC_API_KEY)
  const comOpenAI = Boolean(process.env.OPENAI_API_KEY)
  if (!comClaude && !comOpenAI) {
    /* Nenhuma inteligência ligada. O chat do site entende isto e segue com o
       roteiro, que responde bem e não custa nada. */
    return res.status(200).json({ modo: 'roteiro' })
  }

  let dados
  try {
    dados = JSON.parse((await corpoCru(req)).toString('utf8'))
  } catch {
    return res.status(400).json({ erro: 'corpo inválido' })
  }

  if (limpar(dados?.armadilha, 20)) return res.status(200).json({ modo: 'roteiro' })

  const mensagem = limpar(dados?.mensagem)
  if (!mensagem) return res.status(400).json({ erro: 'mensagem vazia' })

  /* A chave geral do painel: desligada, o chat volta ao roteiro de perguntas,
     que funciona sem inteligência nenhuma. */
  if (!(await botAtivo())) return res.status(200).json({ modo: 'roteiro', motivo: 'desligado no painel' })

  if (!(await dentroDoTeto())) {
    /* Teto do dia batido: não é erro, é o roteiro assumindo. Quem está do
       outro lado continua atendido. */
    return res.status(200).json({ modo: 'roteiro', motivo: 'teto diário' })
  }

  /* O histórico vem do navegador, então entra limitado e com papéis
     conhecidos. Um texto de sistema jamais vem daqui: instrução de fora é
     exatamente como se sequestra um atendimento. */
  const historico = Array.isArray(dados?.historico) ? dados.historico.slice(-MAX_HISTORICO) : []
  const mensagens = [
    ...historico
      .filter((passo) => passo && (passo.de === 'pessoa' || passo.de === 'robo'))
      .map((passo) => ({
        role: passo.de === 'pessoa' ? 'user' : 'assistant',
        content: limpar(passo.texto, 800),
      }))
      .filter((m) => m.content),
    { role: 'user', content: mensagem },
  ]

  const instrucaoSalva = await lerConfig('bot_instrucao', null)
  const instrucao = typeof instrucaoSalva === 'string' && instrucaoSalva.trim() ? instrucaoSalva : INSTRUCAO_PADRAO

  try {
    const texto = comClaude
      ? await responderComClaude(instrucao, mensagens)
      : await responderComOpenAI(instrucao, mensagens)
    const resposta = limpar(texto, 1500)
    if (!resposta) return res.status(200).json({ modo: 'roteiro', motivo: 'resposta vazia' })
    /* O diário do painel. Quem escreveu não é identificado: o chat não tem
       sessão, e endereço de rede é dado pessoal que não precisa ficar aqui. */
    void registrarLog({ canal: 'site', de: 'visitante', entrada: mensagem, saida: resposta, modo: 'ia' })
    return res.status(200).json({ modo: 'ia', resposta })
  } catch (erro) {
    /* Chave vencida, cota estourada, modelo fora do ar: nada disso pode
       deixar alguém sem atendimento. Cai para o roteiro. */
    console.error('bot falhou:', erro?.message)
    void registrarLog({ canal: 'site', de: 'visitante', entrada: mensagem, saida: '', modo: 'falha' })
    return res.status(200).json({ modo: 'roteiro', motivo: 'falha na inteligência' })
  }
}

export { INSTRUCAO_PADRAO }
