/**
 * Prospecção pelo número pessoal do WhatsApp.
 *
 * O número da agência na Cloud API atende quem chega (api/whatsapp.js). Este
 * módulo é o contrário: o número PESSOAL do fundador, conectado por QR code
 * pela Evolution API (a mesma do CRM das clínicas), com o painel listando
 * as conversas que já existem no aparelho. A equipe marca as conversas que
 * quer trabalhar e o robô assume só essas: retoma o assunto de onde parou,
 * com a instrução mestre de prospecção, e conduz até o diagnóstico
 * gratuito. Conversa que não foi marcada é ignorada por completo — família,
 * amigo e fornecedor nunca recebem resposta de robô.
 *
 * Cada conversa assumida vira um lead do funil (canal `prospeccao`), com o
 * histórico importado do aparelho, e é nele que o robô lembra do que foi
 * dito. Se o próprio dono escrever na conversa pelo celular, o robô para: a
 * mensagem `fromMe` que não saiu do robô denuncia a mão humana, e o lead
 * fica `pausado` até o painel devolver.
 */
import { tokenDoWebhook, urlPublica } from '../crm/_lib/ambiente.js'
import { criarEvolution, lerMensagemDoWebhook } from '../crm/_lib/evolution.js'
import { corpo } from '../crm/_lib/http.js'
import { gravarConfig, lerConfig } from './config.js'
import { prepararBanco, sql, temBanco } from './db.js'
import { conversaParaMensagens, dentroDoTeto, limpar, responderComIA, temInteligencia } from './inteligencia.js'
import { acharLeadPorContato, acrescentarFala, criarLead, texto as limparTexto } from './leads.js'
import { registrarLog } from './logs.js'

/** O nome da instância do número pessoal na Evolution. */
export const instanciaPessoal = () => process.env.EVOLUTION_INSTANCIA_PESSOAL || 'astro-pessoal'

/** Os três estados de um lead diante do robô de prospecção. */
export const MODOS = ['', 'bot', 'pausado']

/**
 * O cliente da ponte (ponte-whatsapp/, no PC ou num servidor) ou de uma
 * Evolution de verdade — a API é a mesma. O endereço vem de
 * EVOLUTION_API_URL quando existe; senão, do registro que a ponte faz ao
 * subir (`registrarPonte`), porque o túnel dela muda de endereço a cada
 * vez. A chave é sempre EVOLUTION_API_KEY.
 */
export async function evolucaoDaProspeccao() {
  const ponte = await ponteRegistrada()
  return criarEvolution({
    EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || ponte?.url || '',
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY || '',
  })
}

/** O que a ponte registrou: endereço, instância e quando. */
export async function ponteRegistrada() {
  const ponte = await lerConfig('ponte', null)
  return ponte && typeof ponte === 'object' && ponte.url ? ponte : null
}

/**
 * A ponte avisa onde está: POST /api/crm/ponte/registrar, cabeçalho
 * `apikey` igual a EVOLUTION_API_KEY, corpo { url, instancia }. Sem a chave
 * cadastrada não há como saber quem chama, e nada é gravado.
 */
export async function registrarPonte(req, res) {
  const chave = process.env.EVOLUTION_API_KEY || ''
  if (!chave) return res.status(503).json({ erro: 'cadastre EVOLUTION_API_KEY na Vercel, a mesma PONTE_CHAVE da ponte' })
  if (String(req.headers.apikey || '') !== chave) return res.status(401).json({ erro: 'chave inválida' })
  if (!temBanco()) return res.status(503).json({ erro: 'sem banco (POSTGRES_URL) não há onde guardar o endereço' })
  const dados = await corpo(req)

  /* Manutenção pela mesma chave, para quem administra a ponte.
     { olhar: true } mostra as sessões do banco e os bloqueios na tabela de
     leads; { destravar: true } derruba as conexões presas DO NOSSO usuário
     (transação aberta, esperando bloqueio, bloqueando alguém ou parada numa
     consulta em leads). Existe porque uma função congelada pela Vercel
     segurou a tabela de leads por horas, e o editor SQL do Supabase se
     recusa a derrubar sessões quando há sessões de superusuário na lista.
     Nunca toca em sessão de outro usuário. */
  if (dados?.olhar || dados?.destravar) {
    const s = sql()
    const sessoes = await s`
      SELECT a.pid, a.usename, a.state, a.wait_event_type, a.wait_event,
             (now() - a.xact_start)::text AS em_transacao_ha, left(a.query, 90) AS consulta
      FROM pg_stat_activity a
      WHERE a.pid <> pg_backend_pid() AND a.backend_type = 'client backend'
      ORDER BY a.xact_start NULLS LAST`
    const bloqueios = await s`
      SELECT l.pid, l.mode, l.granted, a.state, left(a.query, 60) AS consulta
      FROM pg_locks l JOIN pg_stat_activity a USING (pid)
      WHERE l.relation = 'public.leads'::regclass`
    let derrubadas = []
    if (dados?.destravar) {
      derrubadas = await s`
        SELECT a.pid, a.state, left(a.query, 60) AS consulta, pg_terminate_backend(a.pid) AS derrubada
        FROM pg_stat_activity a
        WHERE a.pid <> pg_backend_pid() AND a.backend_type = 'client backend'
          AND a.usename = current_user
          AND (a.state LIKE 'idle in transaction%' OR a.wait_event_type = 'Lock'
               OR cardinality(pg_blocking_pids(a.pid)) > 0 OR a.query ILIKE '%leads%')`
    }
    /* { testar: true } roda as mesmas consultas do painel com cronômetro e
       teto de vinte segundos cada, para achar qual delas pendura. */
    const testes = {}
    if (dados?.testar) {
      const { listarLeads, resumo } = await import('./leads.js')
      const medir = async (nome, fn) => {
        const inicio = Date.now()
        try {
          const valor = await Promise.race([fn(), new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('20s sem resposta')), 20000))])
          testes[nome] = `${Date.now() - inicio}ms${Array.isArray(valor) ? ` (${valor.length} linhas)` : ''}`
        } catch (erro) {
          testes[nome] = `ERRO após ${Date.now() - inicio}ms: ${erro?.message}`
        }
      }
      await medir('prepararBanco', () => prepararBanco())
      await medir('listarLeads', () => listarLeads({ situacao: '', busca: '' }))
      await medir('resumo', () => resumo())
      await medir('estadoDoNumero', () => estadoDoNumero())
      /* O que cada peça vê: sem isso não dá para saber por que o painel diz
         "a ponte ainda não avisou" com o registro aceito. */
      testes.ambiente = {
        temBanco: temBanco(),
        EVOLUTION_API_URL: process.env.EVOLUTION_API_URL ? 'definida' : 'ausente',
        EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY ? `${process.env.EVOLUTION_API_KEY.length} caracteres` : 'ausente',
        ponteRegistrada: await ponteRegistrada().catch((erro) => `erro: ${erro?.message}`),
        estado: await estadoDoNumero().catch((erro) => `erro: ${erro?.message}`),
      }
    }
    return res.status(200).json({ ok: true, sessoes, bloqueios, derrubadas, testes })
  }

  const url = String(dados?.url || '').replace(/\/+$/, '')
  if (!/^https?:\/\/[\w.-]+(:\d+)?$/.test(url)) return res.status(400).json({ erro: 'url inválida' })
  await gravarConfig('ponte', {
    url,
    instancia: String(dados?.instancia || instanciaPessoal()).slice(0, 60),
    quando: new Date().toISOString(),
  })
  return res.status(200).json({ ok: true })
}

export const INSTRUCAO_PROSPECCAO_PADRAO = [
  'Você escreve pelo WhatsApp pessoal do fundador da Astro Soluções, uma agência brasileira de tecnologia sob medida: sites, sistemas web, automações de processo e integrações.',
  'Está retomando uma conversa que já existe com alguém que demonstrou interesse, ou que a equipe decidiu prospectar.',
  'Objetivo: entender o que a pessoa precisa hoje e levar a um diagnóstico gratuito de 20 a 30 minutos, combinando dia e hora.',
  '',
  'Como você escreve:',
  '- Em português do Brasil, como uma pessoa escreve no WhatsApp: direto, cordial, no máximo três frases curtas, sem listas e sem formatação.',
  '- Continue de onde a conversa parou. Se fizer sentido, cite o que a pessoa disse antes.',
  '- Uma pergunta por vez.',
  '',
  'Regras que você NUNCA quebra:',
  '- Nunca invente preço, prazo ou funcionalidade. O orçamento sai fechado depois do diagnóstico.',
  '- Nunca prometa nada em nome da empresa além de retorno da equipe.',
  '- Nunca peça senha, cartão ou dado bancário.',
  '- Se a pessoa pedir para parar ou disser que não tem interesse, agradeça, encerre e não insista.',
].join('\n')

/** A instrução que está valendo: a do painel, ou o padrão de fábrica. */
export async function instrucaoDeProspeccao() {
  const salva = await lerConfig('prospeccao_instrucao', null)
  return typeof salva === 'string' && salva.trim() ? salva : INSTRUCAO_PROSPECCAO_PADRAO
}

/** Um jid da Evolution (5511999999999@s.whatsapp.net) vira o contato do lead (+5511999999999). */
export function telefoneDoJid(jid) {
  const digitos = String(jid || '')
    .split('@')[0]
    .replace(/\D/g, '')
  return digitos ? `+${digitos}` : ''
}

/**
 * Um registro de mensagem da Evolution (do webhook ou do histórico) no
 * formato da conversa do lead. Quem escreveu pelo aparelho é o lado da
 * empresa, e entra como `robo` — é o papel que o modelo lê como "eu".
 */
export function falaDoRegistro(registro) {
  const lida = lerMensagemDoWebhook({ data: registro })
  if (!lida || !lida.texto) return null
  return {
    de: lida.deMim ? 'robo' : 'pessoa',
    texto: limparTexto(lida.texto, 800),
    quando: Number(registro?.messageTimestamp || 0),
  }
}

/** O histórico do aparelho, do mais antigo ao mais novo, já no formato do lead. */
export function falasDoHistorico(registros, maximo = 40) {
  return (Array.isArray(registros) ? registros : [])
    .map(falaDoRegistro)
    .filter(Boolean)
    .sort((a, b) => a.quando - b.quando)
    .slice(-maximo)
    .map(({ de, texto }) => ({ de, texto }))
}

/**
 * Uma mensagem `fromMe` é do robô (acabou de mandar) ou é a mão do dono no
 * celular? Compara com as últimas falas do robô guardadas no lead: igual a
 * uma delas, é eco da nossa; diferente, alguém escreveu pelo aparelho.
 */
export function ehDoRobo(texto, conversa) {
  const alvo = limpar(texto, 800)
  return (Array.isArray(conversa) ? conversa : [])
    .filter((fala) => fala && fala.de === 'robo')
    .slice(-3)
    .some((fala) => limpar(fala.texto, 800) === alvo)
}

/** Um chat da lista do aparelho, resumido para o painel. */
export function resumoDoChat(chat) {
  const jid = String(chat?.remoteJid || chat?.id || '')
  const ultima = chat?.lastMessage ? falaDoRegistro(chat.lastMessage) : null
  const segundos = Number(chat?.lastMessage?.messageTimestamp || 0)
  const quando = segundos ? segundos * 1000 : chat?.updatedAt ? Date.parse(chat.updatedAt) : 0
  return {
    jid,
    telefone: telefoneDoJid(jid),
    nome: limparTexto(chat?.pushName || chat?.name || '', 120),
    ultima: ultima ? { de: ultima.de, texto: limparTexto(ultima.texto, 160) } : null,
    quando: quando ? new Date(quando).toISOString() : null,
  }
}

export async function marcarProspeccao(id, modo) {
  if (!MODOS.includes(modo)) throw new Error('modo desconhecido')
  await prepararBanco()
  const s = sql()
  const [linha] = await s`
    UPDATE leads SET prospeccao = ${modo}, atualizado_em = now()
    WHERE id = ${Number(id)} RETURNING *`
  return linha || null
}

export async function estadoDoNumero() {
  const instancia = instanciaPessoal()
  const evo = await evolucaoDaProspeccao()
  if (!evo) return { configurado: false, estado: 'desconectado', numero: null, instancia }
  try {
    const estado = await evo.estado(instancia)
    return { configurado: true, ...estado, instancia }
  } catch {
    return { configurado: true, estado: 'desconectado', numero: null, instancia }
  }
}

/** Cria a instância se não existir, aponta o webhook para cá e devolve o QR (ou "conectado"). */
export async function conectarNumero() {
  const evo = await evolucaoDaProspeccao()
  if (!evo) throw new Error('faltam EVOLUTION_API_URL e EVOLUTION_API_KEY na Vercel')
  const nome = instanciaPessoal()
  const webhook = `${urlPublica()}/api/crm/whatsapp/webhook/${encodeURIComponent(nome)}?token=${encodeURIComponent(tokenDoWebhook())}`
  await evo.criarInstancia(nome, webhook)
  return evo.conectar(nome)
}

export async function desconectarNumero() {
  const evo = await evolucaoDaProspeccao()
  if (evo) await evo.desconectar(instanciaPessoal())
}

/** As conversas do aparelho, da mais recente para a mais antiga, com o lead de cada uma quando existe. */
export async function conversasDoAparelho(limite = 150) {
  const evo = await evolucaoDaProspeccao()
  if (!evo) return []
  const brutas = await evo.conversas(instanciaPessoal())
  const chats = brutas
    .map(resumoDoChat)
    .filter((chat) => chat.telefone && !/@g\.us$|broadcast/.test(chat.jid))
    .sort((a, b) => (b.quando || '').localeCompare(a.quando || ''))
    .slice(0, limite)
  if (!temBanco() || chats.length === 0) return chats.map((chat) => ({ ...chat, lead: null }))
  await prepararBanco()
  const s = sql()
  const contatos = chats.map((chat) => chat.telefone)
  const leads = await s`
    SELECT DISTINCT ON (contato) id, contato, prospeccao, situacao FROM leads
    WHERE contato IN ${s(contatos)}
    ORDER BY contato, criado_em DESC`
  const porContato = new Map(leads.map((lead) => [lead.contato, lead]))
  return chats.map((chat) => {
    const lead = porContato.get(chat.telefone)
    return { ...chat, lead: lead ? { id: lead.id, prospeccao: lead.prospeccao, situacao: lead.situacao } : null }
  })
}

/** O que o modelo precisa saber além da instrução mestre: os campos do próprio lead. */
function contextoDoLead(lead) {
  const sabido = [
    lead?.nome ? `Nome: ${lead.nome}` : '',
    lead?.empresa ? `Empresa: ${lead.empresa}` : '',
    lead?.necessidade && lead.necessidade !== 'A definir' ? `Precisa de: ${lead.necessidade}` : '',
    lead?.anotacoes ? `Anotações da equipe: ${limpar(lead.anotacoes, 600)}` : '',
  ].filter(Boolean)
  return [
    '',
    'CANAL: WhatsApp pessoal. As mensagens marcadas como suas foram escritas pelo fundador ou por você mesmo, nesta mesma conversa.',
    sabido.length ? 'O que a equipe já sabe deste contato:\n' + sabido.map((l) => `- ${l}`).join('\n') : 'A equipe ainda não anotou nada sobre este contato.',
  ].join('\n')
}

/**
 * A resposta do modelo para esta conversa. Sem mensagem nova da pessoa
 * (a abordagem, ou uma conversa que parou na nossa fala), ele recebe um
 * pedido explícito de retomada — texto nosso, nunca de fora.
 */
async function falarComIA(lead, conversa) {
  const instrucao = (await instrucaoDeProspeccao()) + contextoDoLead(lead)
  const mensagens = conversaParaMensagens(conversa, 20)
  if (mensagens.length === 0 || mensagens[mensagens.length - 1].role !== 'user') {
    mensagens.push({
      role: 'user',
      content:
        '(Sem mensagem nova da pessoa. Escreva agora a mensagem que retoma a conversa e propõe o diagnóstico gratuito, sem mencionar este pedido.)',
    })
  }
  return responderComIA(instrucao, mensagens)
}

/**
 * O robô assume as conversas escolhidas: importa o histórico do aparelho
 * para o lead (criado se for a primeira vez), marca o lead como `bot` e
 * manda a mensagem de abordagem. Devolve um resultado por conversa.
 */
export async function assumirConversas(jids) {
  const evo = await evolucaoDaProspeccao()
  if (!evo) throw new Error('faltam EVOLUTION_API_URL e EVOLUTION_API_KEY na Vercel')
  if (!temBanco()) throw new Error('a prospecção precisa do banco (POSTGRES_URL)')
  if (!temInteligencia()) throw new Error('a prospecção precisa de uma inteligência (ANTHROPIC_API_KEY ou OPENAI_API_KEY)')
  const nome = instanciaPessoal()
  const resultados = []
  for (const jid of (Array.isArray(jids) ? jids : []).slice(0, 30)) {
    const telefone = telefoneDoJid(String(jid))
    if (!telefone) {
      resultados.push({ jid, erro: 'contato inválido' })
      continue
    }
    try {
      const registros = await evo.mensagens(nome, String(jid), 40).catch(() => [])
      let lead = await acharLeadPorContato(telefone)
      if (!lead) {
        const nomeExibido = registros.map((r) => (r?.key?.fromMe ? '' : r?.pushName)).find(Boolean) || ''
        lead = await criarLead({
          nome: nomeExibido,
          contato: telefone,
          canal: 'prospeccao',
          necessidade: 'A definir',
          resumo: 'Conversa assumida pelo robô a partir do WhatsApp pessoal.',
          conversa: falasDoHistorico(registros),
        })
      }
      lead = await marcarProspeccao(lead.id, 'bot')
      if (!(await dentroDoTeto())) {
        resultados.push({ jid, lead: lead.id, erro: 'teto diário da inteligência atingido' })
        continue
      }
      const resposta = await falarComIA(lead, Array.isArray(lead.conversa) ? lead.conversa : [])
      if (!resposta) {
        resultados.push({ jid, lead: lead.id, erro: 'a inteligência não respondeu' })
        continue
      }
      await evo.enviarTexto(nome, telefone, resposta)
      await acrescentarFala(lead.id, { de: 'robo', texto: resposta })
      void registrarLog({ canal: 'prospeccao', de: telefone, entrada: '(abordagem)', saida: resposta, modo: 'ia' })
      resultados.push({ jid, lead: lead.id, enviado: true })
    } catch (erro) {
      resultados.push({ jid, erro: erro?.message || 'falhou' })
    }
  }
  return resultados
}

/** A Evolution reentrega o que demora: cada mensagem responde uma vez só. */
async function inedita(id) {
  await prepararBanco()
  const s = sql()
  try {
    await s`INSERT INTO prospeccao_mensagens (wamid) VALUES (${id})`
    return true
  } catch {
    return false
  }
}

/**
 * O que a Evolution entrega para a instância pessoal. Só conversas de
 * leads marcados como `bot` recebem alguma coisa; o resto é silêncio.
 */
export async function webhookProspeccao(evento) {
  const tipo = String(evento?.event || '')
    .toLowerCase()
    .replace(/_/g, '.')
  if (tipo !== 'messages.upsert' || !temBanco()) return
  const mensagem = lerMensagemDoWebhook(evento)
  if (!mensagem || !mensagem.texto) return
  const lead = await acharLeadPorContato(mensagem.telefone)
  if (!lead || lead.prospeccao !== 'bot') return
  if (mensagem.id && !(await inedita(mensagem.id))) return

  const conversa = Array.isArray(lead.conversa) ? lead.conversa : []
  if (mensagem.deMim) {
    if (ehDoRobo(mensagem.texto, conversa)) return
    /* O dono escreveu pelo celular: a mão humana assume, o robô para. */
    await marcarProspeccao(lead.id, 'pausado')
    await acrescentarFala(lead.id, { de: 'robo', texto: mensagem.texto })
    void registrarLog({ canal: 'prospeccao', de: mensagem.telefone, entrada: '', saida: mensagem.texto, modo: 'humano' })
    return
  }

  const atual = await acrescentarFala(lead.id, { de: 'pessoa', texto: mensagem.texto })
  if (!temInteligencia() || !(await dentroDoTeto())) {
    void registrarLog({ canal: 'prospeccao', de: mensagem.telefone, entrada: mensagem.texto, saida: '', modo: 'silencio' })
    return
  }
  const resposta = await falarComIA(lead, atual)
  if (!resposta) return
  const evo = await evolucaoDaProspeccao()
  await evo?.enviarTexto(instanciaPessoal(), mensagem.telefone, resposta)
  await acrescentarFala(lead.id, { de: 'robo', texto: resposta })
  void registrarLog({ canal: 'prospeccao', de: mensagem.telefone, entrada: mensagem.texto, saida: resposta, modo: 'ia' })
}
