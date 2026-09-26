/**
 * A ponte do atendimento inteligente do CHAT DO SITE.
 *
 * Recebe uma mensagem do chat e devolve a resposta do modelo. O cérebro —
 * instrução mestre, escolha do modelo, teto de gasto por dia — mora em
 * `_lib/inteligencia.js`, porque o robô do WhatsApp usa exatamente o mesmo.
 * Sem chave nenhuma, responde `{ modo: 'roteiro' }` e o chat do site segue
 * com as seis perguntas de sempre, que funcionam e não custam nada.
 *
 * SOBRE O PEDIDO DE UMA NETLIFY FUNCTION: o site saiu do Netlify e está na
 * Vercel. Uma função em /netlify/functions não seria executada por ninguém —
 * seria um arquivo morto dando a impressão de que existe atendimento. Esta é
 * a mesma coisa, no lugar onde de fato roda: /api/bot. Se um dia o site
 * voltar para o Netlify, o corpo deste arquivo migra sem mudar uma linha de
 * lógica; muda o invólucro (handler(req, res) vira (event, context)).
 *
 * As variáveis estão documentadas em `_lib/inteligencia.js`.
 */
import { botAtivo } from './_lib/config.js'
import {
  conversaParaMensagens,
  dentroDoTeto,
  instrucaoAtual,
  INSTRUCAO_PADRAO,
  limpar,
  responderComIA,
  temInteligencia,
} from './_lib/inteligencia.js'
import { registrarLog } from './_lib/logs.js'

export const config = { api: { bodyParser: false } }

const LIMITE_CORPO = 32 * 1024

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ erro: 'método não permitido' })
  }
  if (!mesmaOrigem(req)) return res.status(403).json({ erro: 'origem não permitida' })

  if (!temInteligencia()) {
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
  const mensagens = [...conversaParaMensagens(dados?.historico), { role: 'user', content: mensagem }]
  const instrucao = await instrucaoAtual()

  try {
    const resposta = await responderComIA(instrucao, mensagens)
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
