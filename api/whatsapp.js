/**
 * Atendente do WhatsApp — Cloud API oficial da Meta.
 *
 * É um webhook: a Vercel transforma qualquer arquivo em /api numa função sem
 * servidor, então este arquivo responde em
 * https://astrosolucoes.vercel.app/api/whatsapp — é este endereço que se
 * cadastra no painel da Meta.
 *
 *   GET   a Meta chama uma vez para provar que o endereço é seu
 *   POST   cada mensagem que chega ao número da empresa
 *
 * O QUE ACONTECE QUANDO CHEGA UMA MENSAGEM
 *
 *   1. A assinatura da Meta é conferida (HMAC com o segredo do aplicativo).
 *      Sem isso, quem descobrir o endereço fala em nome da empresa.
 *   2. A mensagem é guardada na conversa do lead daquele número — criando o
 *      lead, se for a primeira vez. É esse histórico que o painel mostra.
 *   3. Com inteligência configurada e o bot ligado no painel, o histórico
 *      inteiro vai para o modelo junto com a instrução mestre (a mesma do
 *      chat do site, editável no painel, que proíbe inventar preço e prazo)
 *      e a resposta volta pelo mesmo número.
 *   4. Sem chave, sem banco ou com o teto do dia batido, responde o roteiro
 *      de menu — que atende bem e não custa nada. Nunca deixa ninguém sem
 *      resposta.
 *
 * ANTES DE LIGAR, LEIA. O número usado na Cloud API SAI do aplicativo comum
 * do WhatsApp e passa a ser atendido só por API. Se o (11) 92157-2675 é o
 * número que a equipe usa no celular, não migre esse: pegue um segundo
 * número para o robô, ou use as mensagens automáticas nativas do aplicativo
 * WhatsApp Business, que não exigem nada disto e funcionam hoje.
 *
 * Variáveis de ambiente (painel da Vercel, Settings > Environment Variables):
 *   WHATSAPP_VERIFY_TOKEN  senha inventada por você; a Meta a devolve na
 *                          verificação do webhook e ela só serve para provar
 *                          que o endereço é seu. Alias: WEBHOOK_VERIFY_TOKEN.
 *   WHATSAPP_TOKEN         token permanente do usuário do sistema, com a
 *                          permissão whatsapp_business_messaging.
 *   WHATSAPP_PHONE_ID      id do número remetente (Phone number ID), não o
 *                          número em si. Alias: PHONE_NUMBER_ID.
 *   WHATSAPP_APP_SECRET    segredo do aplicativo da Meta. Sem ele, nenhuma
 *                          mensagem é aceita: a assinatura é conferida com
 *                          ele.
 *   ANTHROPIC_API_KEY ou OPENAI_API_KEY   ligam a inteligência (opcional).
 *
 * Os apelidos existem porque o painel da Meta chama esses campos de "Phone
 * number ID" e "Verify token": quem copia de lá acerta de qualquer jeito.
 */
import crypto from 'node:crypto'
import { acharLeadPorContato, acrescentarFala, criarLead, temBanco, texto as limparTexto } from './_lib/leads.js'
import { botAtivo, lerConfig } from './_lib/config.js'
import {
  conversaParaMensagens,
  dentroDoTeto,
  instrucaoAtual,
  limpar,
  responderComIA,
  temInteligencia,
} from './_lib/inteligencia.js'
import { registrarLog } from './_lib/logs.js'
import { TEXTOS_PADRAO } from './_lib/whatsapp-textos.js'

/* O corpo cru é necessário para conferir a assinatura: qualquer
   reserialização muda um byte e derruba o HMAC. */
export const config = { api: { bodyParser: false } }

const GRAPH = 'https://graph.facebook.com/v21.0'

export const tokenDaMeta = () => process.env.WHATSAPP_TOKEN || ''
export const idDoNumero = () => process.env.WHATSAPP_PHONE_ID || process.env.PHONE_NUMBER_ID || ''
export const tokenDeVerificacao = () => process.env.WHATSAPP_VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN || ''

/** Tira acento e caixa, para "diagnostico" e "Diagnóstico" caírem no mesmo lugar. */
function simplificar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Descobre a intenção da mensagem. Devolve 1..4, 'saudacao' ou null.
 * Exportada para o teste: é o cérebro do ROTEIRO, o caminho que atende
 * quando não há inteligência configurada, e a única parte que se pode
 * verificar sem falar com a Meta.
 */
export function entender(texto) {
  const t = simplificar(texto)
  const numero = t.match(/^([1-4])\b/)
  if (numero) return Number(numero[1])
  if (/(agendar|diagnostico|reuniao|conversar|horario|marcar)/.test(t)) return 1
  /* Preço antes de serviço, e a ordem importa: "quanto custa um sistema?"
     casa com as duas listas, e quem pergunta isso quer o preço, não o
     catálogo. O contrário não acontece — "vocês fazem sistema?" não tem
     nenhuma palavra de preço. */
  if (/(preco|valor|quanto custa|orcamento|investimento|prazo|quanto tempo)/.test(t)) return 3
  if (/(servico|fazem|portfolio|projeto|site|sistema|automacao|integracao)/.test(t)) return 2
  if (/(humano|pessoa|atendente|falar com alguem|suporte)/.test(t)) return 4
  if (/^(oi|ola|bom dia|boa tarde|boa noite|menu|inicio|comecar)\b/.test(t)) return 'saudacao'
  return null
}

async function responder(para, texto) {
  const resposta = await fetch(`${GRAPH}/${idDoNumero()}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenDaMeta()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'text',
      text: { preview_url: true, body: texto },
    }),
  })
  if (!resposta.ok) {
    /* O log da Vercel é o único lugar onde isto aparece. Sem o corpo do erro
       não dá para saber se foi token vencido, janela de 24 horas fechada ou
       número inválido. */
    console.error('WhatsApp recusou o envio:', resposta.status, await resposta.text())
  }
  return resposta.ok
}

function corpoCru(req) {
  return new Promise((resolve, reject) => {
    const partes = []
    req.on('data', (p) => partes.push(p))
    req.on('end', () => resolve(Buffer.concat(partes)))
    req.on('error', reject)
  })
}

/** A Meta assina cada requisição. Sem conferir, qualquer um fala pelo robô. */
function assinaturaConfere(req, cru) {
  const segredo = process.env.WHATSAPP_APP_SECRET
  if (!segredo) return false
  const recebida = req.headers['x-hub-signature-256']
  if (typeof recebida !== 'string') return false
  const esperada = 'sha256=' + crypto.createHmac('sha256', segredo).update(cru).digest('hex')
  const a = Buffer.from(recebida)
  const b = Buffer.from(esperada)
  /* Tempo constante: comparar com === vaza, pelo tempo de resposta, quantos
     bytes iniciais o atacante acertou. */
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/**
 * O lead daquele número, criado se for a primeira mensagem. É a linha que o
 * painel mostra no funil, e é nela que a conversa inteira fica guardada.
 */
async function leadDoNumero(telefone, nomeExibido, primeiraMensagem) {
  const existente = await acharLeadPorContato(telefone)
  if (existente) return existente
  return criarLead({
    nome: nomeExibido || '',
    contato: telefone,
    canal: 'whatsapp',
    necessidade: 'A definir',
    resumo: primeiraMensagem,
    conversa: [],
  })
}

/**
 * O que o modelo precisa saber além da instrução mestre: que está no
 * WhatsApp, e o que a empresa já sabe deste contato. Nada aqui é inventado —
 * são os campos do próprio lead.
 */
function contextoDoCanal(lead) {
  const sabido = [
    lead?.nome ? `Nome informado: ${lead.nome}` : '',
    lead?.empresa ? `Empresa: ${lead.empresa}` : '',
    lead?.necessidade && lead.necessidade !== 'A definir' ? `Precisa de: ${lead.necessidade}` : '',
    lead?.urgencia ? `Prazo: ${lead.urgencia}` : '',
    lead?.orcamento ? `Investimento previsto: ${lead.orcamento}` : '',
  ].filter(Boolean)
  return [
    '',
    'CANAL: WhatsApp. Escreva como se escreve no WhatsApp — frases curtas, sem formatação pesada, sem listas longas.',
    'A pessoa já está falando com a empresa: não se apresente de novo a cada mensagem.',
    sabido.length ? 'O que a equipe já sabe deste contato:\n' + sabido.map((l) => `- ${l}`).join('\n') : 'Ainda não sabemos nada sobre este contato.',
  ].join('\n')
}

export default async function handler(req, res) {
  /* A Meta chama com GET uma vez, para provar que o endereço é seu. */
  if (req.method === 'GET') {
    const modo = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const desafio = req.query['hub.challenge']
    const esperado = tokenDeVerificacao()
    if (modo === 'subscribe' && esperado && token === esperado) {
      return res.status(200).send(desafio)
    }
    return res.status(403).send('verificacao recusada')
  }

  if (req.method !== 'POST') return res.status(405).send('metodo nao permitido')

  const cru = await corpoCru(req)
  if (!assinaturaConfere(req, cru)) return res.status(401).send('assinatura invalida')

  /* Responder 200 rápido é obrigação: a Meta reenvia o que demora, e reenvio
     vira mensagem repetida para quem está do outro lado. O trabalho segue
     depois da resposta, dentro desta mesma invocação. */
  res.status(200).send('ok')

  let evento
  try {
    evento = JSON.parse(cru.toString('utf8'))
  } catch {
    return
  }

  /* Os textos que a equipe editou no painel. Uma leitura por invocação, com
     o padrão do código como rede: configuração ausente nunca pode deixar
     alguém sem resposta do outro lado. */
  const textos = { ...TEXTOS_PADRAO, ...(await lerConfig('whatsapp_textos', TEXTOS_PADRAO)) }
  const RESPOSTAS = { 1: textos.opcao1, 2: textos.opcao2, 3: textos.opcao3, 4: textos.opcao4 }
  /* A chave geral do painel. Desligado, o robô lê e registra tudo, guarda o
     lead, e não responde: quem responde é uma pessoa, pelo aplicativo. */
  const ativo = await botAtivo()

  const mudancas = (evento?.entry || []).flatMap((e) => e.changes || [])
  for (const mudanca of mudancas) {
    /* Recibos de entrega e de leitura chegam por aqui também: ignorados,
       porque não têm `messages`. */
    const mensagens = mudanca?.value?.messages || []
    for (const mensagem of mensagens) {
      const de = mensagem.from
      if (!de) continue
      const texto = limpar(
        mensagem.text?.body ||
          mensagem.interactive?.button_reply?.title ||
          mensagem.interactive?.list_reply?.title ||
          '',
        1500,
      )
      const nomeExibido = limparTexto(mudanca?.value?.contacts?.[0]?.profile?.name, 120)

      /* O histórico vive no lead. Sem banco não há histórico: a conversa
         segue pelo roteiro, que não depende de memória nenhuma. */
      let lead = null
      let conversa = []
      if (temBanco()) {
        try {
          lead = await leadDoNumero(de, nomeExibido, texto)
          conversa = await acrescentarFala(lead.id, { de: 'pessoa', texto })
        } catch (erro) {
          console.error('não foi possível guardar a mensagem recebida:', erro?.message)
        }
      }

      let modo = ''
      let resposta = ''

      if (ativo && texto && temInteligencia() && (await dentroDoTeto())) {
        try {
          const instrucao = (await instrucaoAtual()) + contextoDoCanal(lead)
          /* A última fala já está na conversa; o histórico inteiro vai, e é
             isso que faz o robô lembrar do que foi dito antes. */
          const mensagensParaIA = conversa.length
            ? conversaParaMensagens(conversa)
            : [{ role: 'user', content: texto }]
          resposta = await responderComIA(instrucao, mensagensParaIA)
          if (resposta) modo = 'ia'
        } catch (erro) {
          /* Chave vencida, cota estourada, modelo fora do ar: cai para o
             roteiro, que é o que sempre funcionou. */
          console.error('inteligência falhou no WhatsApp:', erro?.message)
        }
      }

      if (!resposta) {
        const intencao = entender(texto)
        if (intencao === 'saudacao' || !texto) {
          modo = 'menu'
          resposta = `${textos.boasVindas}\n\n${textos.menu}`
        } else if (typeof intencao === 'number') {
          modo = `opcao${intencao}`
          resposta = RESPOSTAS[intencao]
        } else {
          /* Não entendeu: nunca insistir. Avisa que um humano vai ler e mostra
             o menu uma vez, para quem preferir o atalho. */
          modo = 'humano'
          resposta = `${textos.naoEntendi}\n\n${textos.menu}`
        }
      }

      /* O diário do painel. Registrar nunca segura a resposta. */
      void registrarLog({
        canal: 'whatsapp',
        de,
        entrada: texto,
        saida: ativo ? resposta : '',
        modo: ativo ? modo : 'silencio',
      })

      if (!ativo) continue
      const foi = await responder(de, resposta)
      if (foi && lead) {
        await acrescentarFala(lead.id, { de: 'robo', texto: resposta }).catch(() => undefined)
      }
    }
  }
}
