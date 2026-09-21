/**
 * Atendente automático do WhatsApp.
 *
 * É um webhook da WhatsApp Cloud API (Meta). A Vercel transforma qualquer
 * arquivo em /api numa função sem servidor, então este arquivo responde em
 * https://astrosolucoes.vercel.app/api/whatsapp — é este endereço que se
 * cadastra no painel da Meta.
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
 *                          que o endereço é seu.
 *   WHATSAPP_TOKEN         token permanente do usuário do sistema, com a
 *                          permissão whatsapp_business_messaging.
 *   WHATSAPP_PHONE_ID      id do número remetente (Phone number ID), não o
 *                          número em si.
 *   WHATSAPP_APP_SECRET    segredo do aplicativo da Meta. Sem ele, quem
 *                          descobrir o endereço fala em nome do robô: a
 *                          assinatura de cada requisição é conferida com ele.
 *
 * Sem estado, de propósito. Uma função sem servidor morre entre uma chamada e
 * outra, então não existe "em que passo a conversa está": cada mensagem é
 * lida por inteiro e respondida por si. É menos esperto e nunca prende
 * ninguém num menu.
 */
import crypto from 'node:crypto'
import { criarLead, temBanco } from './_lib/leads.js'
import { lerConfig } from './_lib/config.js'
import { TEXTOS_PADRAO } from './_lib/whatsapp-textos.js'

/* O corpo cru é necessário para conferir a assinatura: qualquer
   reserialização muda um byte e derruba o HMAC. */
export const config = { api: { bodyParser: false } }

const GRAPH = 'https://graph.facebook.com/v21.0'

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
 * Exportada para o teste: é o cérebro do robô e a única parte que se pode
 * verificar sem falar com a Meta.
 */
export function entender(texto) {
  const t = simplificar(texto)
  const numero = t.match(/^([1-4])\b/)
  if (numero) return Number(numero[1])
  if (/(agendar|diagnostico|reuniao|conversar|horario|marcar)/.test(t)) return 1
  if (/(servico|fazem|portfolio|projeto|site|sistema|automacao|integracao)/.test(t)) return 2
  if (/(preco|valor|quanto custa|orcamento|investimento|prazo|quanto tempo)/.test(t)) return 3
  if (/(humano|pessoa|atendente|falar com alguem|suporte)/.test(t)) return 4
  if (/^(oi|ola|bom dia|boa tarde|boa noite|menu|inicio|comecar)\b/.test(t)) return 'saudacao'
  return null
}

async function responder(para, texto) {
  const resposta = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
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

export default async function handler(req, res) {
  /* A Meta chama com GET uma vez, para provar que o endereço é seu. */
  if (req.method === 'GET') {
    const modo = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const desafio = req.query['hub.challenge']
    if (modo === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
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

  const mudancas = (evento?.entry || []).flatMap((e) => e.changes || [])
  for (const mudanca of mudancas) {
    /* Recibos de entrega e de leitura chegam por aqui também: ignorados,
       porque não têm `messages`. */
    const mensagens = mudanca?.value?.messages || []
    for (const mensagem of mensagens) {
      const de = mensagem.from
      if (!de) continue
      const texto =
        mensagem.text?.body ||
        mensagem.interactive?.button_reply?.title ||
        mensagem.interactive?.list_reply?.title ||
        ''
      const intencao = entender(texto)

      /* O que vale como lead: quem pediu para agendar e quem escreveu algo
         que o robô não entendeu (aí um humano vai atender de qualquer forma).
         Cumprimento e curiosidade sobre preço não viram lead — encheriam o
         painel de linha vazia e esconderiam quem interessa.
         Falhar aqui nunca pode calar o robô: a pessoa do outro lado está
         esperando resposta. */
      if (temBanco() && (intencao === 1 || intencao === null)) {
        criarLead({
          nome: mudanca?.value?.contacts?.[0]?.profile?.name || '',
          contato: de,
          canal: 'whatsapp',
          necessidade: intencao === 1 ? 'Agendar diagnóstico' : 'A definir',
          resumo: texto,
          conversa: [{ de: 'pessoa', texto }],
        }).catch((erro) => console.error('lead do WhatsApp não foi guardado:', erro?.message))
      }

      if (intencao === 'saudacao' || !texto) {
        await responder(de, `${BOAS_VINDAS}\n\n${MENU}`)
        continue
      }
      if (typeof intencao === 'number') {
        await responder(de, RESPOSTAS[intencao])
        continue
      }
      /* Não entendeu: nunca insistir. Avisa que um humano vai ler e mostra o
         menu uma vez, para quem preferir o atalho. */
      await responder(de, `${NAO_ENTENDI}\n\n${MENU}`)
    }
  }
}
