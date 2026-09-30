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
import { conversaParaMensagens, dentroDoTeto, limpar, qualInteligencia, responderComIA, temInteligencia } from './inteligencia.js'
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
        configPonteCru: typeof (await lerConfig('ponte', null)),
        conversas: await conversasDoAparelho().then((l) => `${l.length} conversas`).catch((erro) => `erro: ${erro?.message}`),
        conectar: await conectarNumero().then((r) => `${r.estado}${r.qr ? ` com QR de ${r.qr.length} caracteres` : ' sem QR'}`).catch((erro) => `erro: ${erro?.message}`),
        estado: await estadoDoNumero().catch((erro) => `erro: ${erro?.message}`),
        inteligencia: qualInteligencia() || 'nenhuma',
        modelo: process.env.BOT_MODELO || (qualInteligencia() === 'claude' ? 'claude-sonnet-5 (padrão)' : 'padrão'),
      }
      /* Testa a IA de verdade, com um pedido fixo: é o passo do "assumir" que
         pode estar falando vazio. */
      testes.ia = await responderComIA('Responda apenas: pronto.', [{ role: 'user', content: 'diga pronto' }])
        .then((t) => (t ? `respondeu (${t.length} caracteres): ${t.slice(0, 60)}` : 'voltou VAZIA'))
        .catch((erro) => `erro: ${erro?.message}`)
      /* Os modelos de chat que a chave da Groq realmente tem: o padrão pode
         ter saído de linha, e é isto que aponta o certo. */
      if (process.env.GROQ_API_KEY) {
        testes.groqModelos = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        })
          .then((r) => r.json())
          .then((d) => (Array.isArray(d?.data) ? d.data.map((m) => m.id).filter((id) => /llama|gemma|mixtral|qwen/i.test(id)).slice(0, 20) : d))
          .catch((erro) => `erro: ${erro?.message}`)
      }
      /* Envia um teste para o PRÓPRIO número conectado (mensagem para si
         mesmo, inofensiva): prova o caminho do envio pela ponte. */
      if (dados?.envio) {
        const meu = (await estadoDoNumero()).numero
        testes.envio = meu
          ? await (await evolucaoDaProspeccao())
              ?.enviarTexto(instanciaPessoal(), meu, 'Teste da ponte da Astro ✅ (mensagem automática de verificação)')
              .then(() => `enviado para ${meu}`)
              .catch((erro) => `erro: ${erro?.message}`)
          : 'sem número conectado'
      }
    }
    /* { logs:true } as últimas interações do robô; { leadDe:"55..." } todos os
       leads daquele contato (achar duplicado sem 'bot'). */
    let logs = null
    let leadsDoContato = null
    const s2 = sql()
    if (dados?.logs) {
      logs = await s2`SELECT quando, canal, de, left(entrada, 50) AS entrada, left(saida, 50) AS saida, modo FROM bot_logs ORDER BY quando DESC LIMIT 20`
    }
    /* Migra os leads gravados com a conversa em JSON duplo: desembrulha a
       string para array e tira as falas de texto vazio (lixo da versão que
       espalhava a string em caracteres). Roda uma vez. */
    if (dados?.migrarConversas) {
      const linhas = await s2`SELECT id, conversa FROM leads`
      let arrumados = 0
      for (const linha of linhas) {
        let arr = linha.conversa
        if (typeof arr === 'string') {
          try {
            arr = JSON.parse(arr)
          } catch {
            arr = []
          }
        }
        if (!Array.isArray(arr)) arr = []
        const limpa = arr
          .filter((f) => f && typeof f.texto === 'string' && f.texto.trim())
          .map((f) => ({ de: f.de === 'pessoa' ? 'pessoa' : 'robo', texto: String(f.texto).slice(0, 800) }))
        await s2`UPDATE leads SET conversa = ${s2.json(limpa)} WHERE id = ${linha.id}`
        arrumados += 1
      }
      return res.status(200).json({ ok: true, arrumados })
    }
    /* { apagarLeadDe:"55..." } apaga os leads de prospecção daquele contato
       (limpar um teste). Só canal 'prospeccao', nunca um lead do site. */
    if (dados?.apagarLeadDe) {
      const contato = `+${String(dados.apagarLeadDe).replace(/D/g, '')}`
      const apagados = await s2`DELETE FROM leads WHERE contato = ${contato} AND canal = 'prospeccao' RETURNING id`
      return res.status(200).json({ ok: true, apagados: apagados.length })
    }
    if (dados?.todosLeads) {
      leadsDoContato = await s2`SELECT id, contato, prospeccao, situacao, canal, pg_typeof(conversa)::text AS tipo_conversa, left(conversa::text, 40) AS conversa_amostra FROM leads ORDER BY criado_em DESC LIMIT 30`
    }
    if (dados?.leadDe) {
      const contato = `+${String(dados.leadDe).replace(/\D/g, '')}`
      leadsDoContato = await s2`SELECT id, contato, prospeccao, situacao, canal FROM leads WHERE contato = ${contato} ORDER BY criado_em DESC`
    }
    return res.status(200).json({ ok: true, sessoes, bloqueios, derrubadas, testes, logs, leadsDoContato })
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
  'Você escreve pelo WhatsApp pessoal de Eduardo, fundador da Astro Soluções, e assina como ele. A Astro Soluções é uma empresa brasileira de tecnologia que resolve gargalos de outros negócios com soluções sob medida: CRM, robô de atendimento no WhatsApp (chatbot), automações e sites profissionais.',
  'Quem você prospecta: donos e gerentes de imobiliárias.',
  'Objetivo único da conversa: marcar uma reunião rápida de 10 a 20 minutos (chamada de vídeo ou visita) para mostrar na prática o CRM com robô de atendimento e automação. Combine dia e hora.',
  '',
  'Como a conversa costuma começar: Eduardo manda a primeira mensagem pelo celular, algo como "Estava no site da imobiliária agora há pouco e notei um gargalo no processo de captação de vocês. É com você que eu falo sobre isso?". Quando a pessoa responder (em geral "qual gargalo?"), você continua a partir dali.',
  'O gargalo que você explica, com suas palavras e adaptando ao que a pessoa disser: quem entra no site e clica no WhatsApp depende de alguém estar com o celular na mão; se o corretor está em visita, o lead esfria. A Astro resolve isso com um robô ligado a um CRM que atende e qualifica o cliente na hora e entrega a ficha pronta para o corretor. Depois de explicar, peça 10 minutos na semana para mostrar na prática.',
  'Se você estiver abrindo a conversa e não souber o nome da pessoa nem da imobiliária, use uma abertura neutra e educada, sem inventar nomes.',
  '',
  'Como você escreve:',
  '- Em português do Brasil, como uma pessoa escreve no WhatsApp: direto, cordial, consultivo, no máximo três frases curtas, sem listas e sem formatação.',
  '- Tom de empreendedor que quer entender e ajudar, nunca de vendedor insistente.',
  '- Uma pergunta por mensagem. Se a pessoa contar uma dificuldade, mostre que entendeu e ligue a dificuldade à solução.',
  '- Emojis: no máximo um por mensagem e só quando for natural (👋 👍 🤝). Nunca emoji de marketing (🚀 🎯 🔥 💰 📢).',
  '',
  'Regras que você NUNCA quebra:',
  '- Nunca invente preço, prazo ou funcionalidade. Se perguntarem valores, diga que cada projeto é sob medida e que a reunião serve para levantar isso sem compromisso.',
  '- Nunca prometa nada em nome da empresa além de retorno da equipe.',
  '- Nunca peça senha, cartão ou dado bancário.',
  '- Se a pessoa pedir para parar ou disser que não tem interesse, agradeça, encerre e não insista.',
].join('\n')

/**
 * A frase gatilho. O dono manda uma destas pelo celular, na conversa que
 * quiser, e o robô assume: guarda a mensagem como a primeira fala dele e
 * responde sozinho quando a pessoa replicar. Uma frase por linha; a
 * comparação ignora maiúsculas, acentos e pontuação, e vale se a mensagem
 * CONTIVER a frase. Editável no painel.
 */
export const GATILHO_PADRAO = ['Boa tarde, tudo bem?', 'Bom dia, tudo bem?', 'Boa noite, tudo bem?', 'notei um gargalo'].join('\n')

export function normalizarFrase(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function bateGatilho(texto, gatilho) {
  const alvo = normalizarFrase(texto)
  if (!alvo) return false
  return String(gatilho ?? '')
    .split(/\r?\n/)
    .map(normalizarFrase)
    .filter(Boolean)
    .some((frase) => alvo.includes(frase))
}

export async function gatilhoDeProspeccao() {
  const salvo = await lerConfig('prospeccao_gatilho', null)
  return typeof salvo === 'string' && salvo.trim() ? salvo : GATILHO_PADRAO
}

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

/** As mensagens de uma conversa do aparelho, já no formato { de, texto }, para o painel ler. */
export async function mensagensDaConversa(jid) {
  const evo = await evolucaoDaProspeccao()
  if (!evo) return []
  const registros = await evo.mensagens(instanciaPessoal(), String(jid), 60).catch(() => [])
  return falasDoHistorico(registros, 60)
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
      /* Só marca 'bot' DEPOIS que a abordagem foi enviada. Antes o lead ficava
         "prospectando" mesmo quando a IA falhava (chave sem crédito) ou o
         envio caía, e nada saía — sem mensagem e sem explicação. */
      if (!(await dentroDoTeto())) {
        resultados.push({ jid, lead: lead.id, erro: 'teto diário da inteligência atingido' })
        continue
      }
      let resposta = ''
      try {
        resposta = await falarComIA(lead, Array.isArray(lead.conversa) ? lead.conversa : [])
      } catch (erro) {
        resultados.push({ jid, lead: lead.id, erro: `a inteligência falhou: ${(erro?.message || '').slice(0, 160)}` })
        continue
      }
      if (!resposta) {
        resultados.push({ jid, lead: lead.id, erro: 'a inteligência voltou vazia' })
        continue
      }
      await evo.enviarTexto(nome, telefone, resposta)
      lead = await marcarProspeccao(lead.id, 'bot')
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
  /* AWAIT no registro (não `void`): na Vercel a função congela ao responder,
     e um log disparado sem espera se perdia. Cada passo deixa rastro, para
     achar por que a réplica não continua. */
  const rastro = (modo, entrada, saida) =>
    registrarLog({ canal: 'prospeccao', de: 'webhook', entrada: String(entrada).slice(0, 90), saida: String(saida).slice(0, 90), modo }).catch(() => {})

  const tipo = String(evento?.event || '')
    .toLowerCase()
    .replace(/_/g, '.')
  if (tipo !== 'messages.upsert' || !temBanco()) return await rastro('debug', `tipo=${tipo}`, `banco=${temBanco()}`)
  const mensagem = lerMensagemDoWebhook(evento)
  if (!mensagem || !mensagem.texto) return await rastro('debug', 'sem mensagem/texto', evento?.data?.key?.remoteJid || '')
  let lead = await acharLeadPorContato(mensagem.telefone)

  /* O gatilho: o dono escreveu pelo celular uma das frases combinadas. O
     robô assume esta conversa (cria o lead se for a primeira vez), guarda a
     mensagem como a primeira fala dele e NÃO manda nada agora: responde
     quando a pessoa replicar. O eco de uma mensagem do próprio robô que por
     acaso contenha a frase não conta. */
  if (mensagem.deMim && !ehDoRobo(mensagem.texto, lead?.conversa) && bateGatilho(mensagem.texto, await gatilhoDeProspeccao())) {
    if (mensagem.id && !(await inedita(mensagem.id))) return await rastro('debug', `duplicada ${mensagem.id}`, mensagem.telefone)
    if (!lead) {
      lead = await criarLead({
        nome: mensagem.telefone,
        contato: mensagem.telefone,
        canal: 'prospeccao',
        necessidade: 'A definir',
        resumo: 'Conversa aberta pelo celular com a frase gatilho; o robô assumiu.',
        conversa: [],
      })
    }
    await marcarProspeccao(lead.id, 'bot')
    await acrescentarFala(lead.id, { de: 'robo', texto: mensagem.texto })
    return await rastro('gatilho', mensagem.texto, mensagem.telefone)
  }

  if (!lead) return await rastro('debug', `lead nao achado: ${mensagem.telefone}`, mensagem.texto)
  if (lead.prospeccao !== 'bot') return await rastro('debug', `lead ${lead.id} prospeccao=${lead.prospeccao}`, mensagem.telefone)
  if (mensagem.id && !(await inedita(mensagem.id))) return await rastro('debug', `duplicada ${mensagem.id}`, mensagem.telefone)

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
  if (!temInteligencia() || !(await dentroDoTeto())) return await rastro('silencio', mensagem.texto, 'sem IA/teto')
  let resposta = ''
  try {
    resposta = await falarComIA(lead, atual)
  } catch (erro) {
    return await rastro('debug', 'IA falhou', erro?.message || '')
  }
  if (!resposta) return await rastro('debug', 'IA vazia', mensagem.texto)
  try {
    const evo = await evolucaoDaProspeccao()
    await evo?.enviarTexto(instanciaPessoal(), mensagem.telefone, resposta)
  } catch (erro) {
    return await rastro('debug', 'envio falhou', erro?.message || '')
  }
  await acrescentarFala(lead.id, { de: 'robo', texto: resposta })
  await rastro('ia', mensagem.texto, resposta)
}
