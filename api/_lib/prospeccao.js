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
import { conversaParaMensagens, dentroDoTeto, limpar, modeloGroqEmUso, qualInteligencia, responderComIA, temInteligencia } from './inteligencia.js'
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
      /* { ensaio:"qual gargalo?" } roda a instrução de prospecção de verdade,
         numa conversa de mentira aberta pela frase gatilho, e devolve o que o
         robô responderia. Não manda nada a ninguém. */
      const abertura = { de: 'robo', texto: 'Olá, tudo bem? Eduardo aqui. Estava navegando no site da imobiliária agora há pouco e notei um gargalo no processo de captação de vocês. É com você que eu falo sobre isso?' }
      const ensaio = Array.isArray(dados?.ensaioConversa)
        ? dados.ensaioConversa.slice(0, 12).map((f) => ({ de: f?.de === 'robo' ? 'robo' : 'pessoa', texto: String(f?.texto || '').slice(0, 400) }))
        : typeof dados?.ensaio === 'string' && dados.ensaio.trim()
          ? [{ de: 'pessoa', texto: dados.ensaio.slice(0, 400) }]
          : null
      if (ensaio) {
        testes.ensaio = await falarComIA({ nome: '', contato: '+5500000000000' }, [abertura, ...ensaio]).catch((erro) => `erro: ${erro?.message}`)
      }
      testes.ia = await responderComIA('Responda apenas: pronto.', [{ role: 'user', content: 'diga pronto' }])
        .then((t) => (t ? `respondeu (${t.length} caracteres): ${t.slice(0, 60)}` : 'voltou VAZIA'))
        .catch((erro) => `erro: ${erro?.message}`)
      testes.modeloGroq = modeloGroqEmUso()
      const valendo = await instrucaoDeProspeccao()
      testes.instrucao = (valendo === INSTRUCAO_PROSPECCAO_PADRAO ? 'padrão de fábrica' : 'salva no painel') + ': ' + valendo.slice(0, 90)
      /* Os modelos de chat que a chave da Groq realmente tem: o padrão pode
         ter saído de linha, e é isto que aponta o certo. */
      if (process.env.GROQ_API_KEY) {
        testes.groqModelos = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        })
          .then((r) => r.json())
          .then((d) => (Array.isArray(d?.data) ? d.data.map((m) => m.id).slice(0, 40) : d))
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
    /* { resetarInstrucao:true } volta a instrução mestre ao padrão de fábrica. */
    if (dados?.resetarInstrucao) {
      await gravarConfig('prospeccao_instrucao', '')
      return res.status(200).json({ ok: true, instrucao: 'padrão de fábrica' })
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
  /* Uma ponte só por número. Se já há outra registrada, viva e conectada,
     num endereço diferente, recusa: duas pontes na mesma sessão fazem o
     WhatsApp derrubar as duas (440), as mensagens viram "Aguardando
     mensagem" e o site fica apontando para a que morrer por último. Foi o
     que aconteceu quando a ponte local do PC subiu com a do Fly no ar. A
     recusa aparece no terminal da ponte recusada. */
  const instancia = String(dados?.instancia || instanciaPessoal()).slice(0, 60)
  const antiga = await lerConfig('ponte', null)
  if (antiga?.url && antiga.url !== url) {
    const viva = await fetch(`${antiga.url}/instance/connectionState/${encodeURIComponent(instancia)}`, {
      headers: { apikey: process.env.EVOLUTION_API_KEY || '' },
      signal: AbortSignal.timeout(6000),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => String(d?.instance?.state || '') === 'open')
      .catch(() => false)
    if (viva) {
      return res.status(409).json({
        erro: `já existe uma ponte conectada em ${antiga.url}; desligue-a antes de ligar outra (só uma ponte por número)`,
      })
    }
  }
  await gravarConfig('ponte', { url, instancia, quando: new Date().toISOString() })
  return res.status(200).json({ ok: true })
}

export const INSTRUCAO_PROSPECCAO_PADRAO = [
  'Você é um consultor de tecnologia imobiliária sênior, representante oficial da Astro Soluções, empresa dirigida pelo fundador e diretor Eduardo. Você escreve pelo WhatsApp dele, como "a gente" ou "a equipe do Eduardo". Nunca diga que é um robô e nunca finja ser o Eduardo. Concordância sempre no masculino ("obrigado", nunca "obrigada").',
  'Se a conversa já tiver mensagens enviadas deste número antes de você (o próprio Eduardo abrindo o contato, por exemplo "notei um gargalo na captação de vocês"), continue dali como a equipe dele, sem se reapresentar. Se a pessoa perguntar "qual gargalo?", diga em uma frase o do WhatsApp sem resposta (cliente esfria e vai para o concorrente) e emende a pergunta de diagnóstico.',
  'Tom: seguro, consultivo, objetivo e inteligente. Como um humano no WhatsApp: uma ou duas frases, até 25 palavras no total, uma pergunta por mensagem, sem listas, sem formatação, sem blocos de texto. Os exemplos abaixo são o espírito, não o tamanho: encurte-os para caber no limite. A pergunta dos horários é sempre curta: "Amanhã às 10h ou às 14h?"',
  '',
  'PRIMEIRA MISSÃO, antes de vender qualquer coisa: diagnóstico digital. A imobiliária pode precisar de um site moderno que converta, de um CRM que funcione de verdade, ou de um robô de atendimento no WhatsApp. Pergunte de forma leve como está a estrutura digital hoje. Espírito: "Hoje o site de vocês e o atendimento no WhatsApp estão rodando redondo, ou vocês sentem que perdem clientes por lentidão ou falhas?"',
  '',
  'POSICIONAMENTO da Astro Soluções: um ecossistema completo e integrado. Site rápido e otimizado, ligado a um robô de WhatsApp que atende em segundos, 24 horas, e joga o lead qualificado direto num CRM simples e automatizado, onde o corretor não digita nada à mão. O problema dos sistemas tradicionais do mercado (Kenlo, Vista e parecidos): pesados, cheios de telas que o corretor odeia preencher, e passivos: não respondem o cliente sozinhos.',
  '',
  'OBJEÇÃO "já temos sistema / CRM / site": nunca aceite como fim da linha. Espírito do contorno: "Ótimo que a casa já está organizada. Mas o sistema de vocês atende o lead no WhatsApp em 3 segundos de madrugada, qualifica e joga mastigado no funil do corretor sem ele mexer um dedo?"',
  'CUSTO DE NÃO AGIR, quando falarem de preço ou de "não é prioridade": "A maioria das ferramentas só guarda o contato. Se o corretor está em visita e demora 30 minutos, o cliente já comprou com o concorrente. A automação fecha esse buraco de faturamento."',
  '"Não tenho tempo": reduza o esforço. O Eduardo mostra o sistema rodando em 10 minutos, ou manda um link de teste de 5 minutos. Quem envia o link é o Eduardo; nunca invente um link.',
  '"Manda por e-mail": em 10 minutos o Eduardo mostra funcionando, o que vale mais que PDF; ofereça os dois horários.',
  '',
  'PERSISTÊNCIA com classe, nunca repetição. Desculpa ou objeção: investigue com elegância; o foco não é fazer a pessoa gastar, é parar de perder comissão. Ao primeiro "não tenho interesse" simples: uma investigação só. Espírito: "Compreendo. Só para entender o cenário: é porque já têm um robô que atende em segundos, ou automação não é prioridade agora?"',
  'Recusa definitiva ("não venha me oferecer nada", "não quero nada", "não tenho interesse nenhum"), segundo não, ou hostilidade: agradeça em uma frase ("Obrigado pelo retorno..."), encerre e não escreva mais. Spam queima a marca. A linha "Recusas até agora" no fim desta instrução diz em qual caso você está: obedeça a ela.',
  '',
  'FECHAMENTO: assim que houver abertura (a pessoa pergunta como funciona, como vocês fariam, quanto custa, ou diz que faz sentido), NÃO volte ao diagnóstico: encaminhe imediatamente ao diretor. Espírito: "Para você não mudar tudo no escuro, o Eduardo preparou uma demonstração de 10 minutos com o sistema rodando. Amanhã às 10h ou às 14h?"',
  '',
  'Regras que você NUNCA quebra:',
  '- Nunca jargão técnico (API, backend, frontend, SaaS, integração via API). Fale em atender rápido, não perder cliente, vender mais.',
  '- Nunca invente preço, prazo, cliente, link ou funcionalidade.',
  '- Nunca prometa nada em nome da empresa além do retorno do Eduardo.',
  '- Nunca peça senha, cartão ou dado bancário.',
  '- Nunca escreva marcador de modelo como [Nome]. Se não souber o nome da pessoa, não use nome nenhum (nem na despedida: "Obrigado pelo retorno." e ponto).',
  '- Eduardo é o diretor da Astro, do seu lado. NUNCA chame a pessoa com quem você fala de Eduardo nem de nenhum outro nome que ela não tenha dito.',
  '- Nunca mais de uma pergunta por mensagem; nunca mais de duas frases. Nunca seja desrespeitoso, mesmo se a pessoa for.',
  '- Emojis: no máximo um por mensagem, só quando natural (👋 👍 🤝). Nunca emoji de marketing (🚀 🎯 🔥 💰 📢).',
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

/**
 * Comandos que o dono manda pelo celular numa conversa do robô:
 * "#pausa" desliga o robô nela; "#robo" religa. Qualquer outra mensagem
 * sua entra na conversa como fala do robô e ele continua na próxima réplica.
 */
export function comandoDoDono(texto) {
  const t = normalizarFrase(texto)
  if (t === 'pausa' || t.startsWith('pausa ')) return 'pausa'
  if (t === 'robo' || t.startsWith('robo ')) return 'robo'
  return ''
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
  const nomeReal = lead?.nome && !/^\+?[\d\s()-]{8,}$/.test(String(lead.nome).trim()) ? String(lead.nome) : ''
  const sabido = [
    nomeReal ? `Nome: ${nomeReal}` : '',
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
/* Quantas vezes a pessoa já recusou nesta conversa. É o que decide, sem
   depender da interpretação do modelo, se ele insiste (primeira) ou encerra
   (segunda). Conta só falas da pessoa; a negação tem de estar colada ao
   verbo ("não tenho", "não quero"), para "não sei se é com você, mas me
   interessa" não contar. */
const RECUSA =
  /\b(n[aã]o|nunca)\s+(tenho|temos|quero|queremos|precis\w*|vou querer|vamos querer|me interessa|nos interessa|estou interessad\w*|estamos interessad\w*)\b|\bn[aã]o,?\s+obrigad|sem interesse|pode parar|para de (me )?(mandar|escrever)|n[aã]o (me )?(mande|manda|chame|liga)|desist|tira (o )?meu (n[uú]mero|contato)/i
export function contarRecusas(conversa) {
  return (Array.isArray(conversa) ? conversa : []).filter((f) => f?.de === 'pessoa' && RECUSA.test(String(f.texto || ''))).length
}

/* Um "não" definitivo ou hostil encerra na hora, sem segunda tentativa.
   "Não tenho interesse" simples NÃO está aqui de propósito: ganha uma
   investigação elegante antes (é a primeira recusa, contada em RECUSA). */
const HOSTIL =
  /n[aã]o (venha|vem|venham) (me )?oferecer|n[aã]o (me )?ofere[çc]a|n[aã]o quero (nada|saber|conversar|nenhum|mais nada)|n[aã]o (tenho|temos) (nenhum |o menor )?interesse (nenhum|algum|mesmo)|n[aã]o insist|me tira (da lista|do grupo|daqui)|tira (o )?meu (n[uú]mero|contato)|n[aã]o (me )?(mande|manda|envie|envia|escreva|escreve) mais|para de (me )?(mandar|escrever|encher|incomodar)|n[aã]o (quero|me) (mais )?(contato|mensagem)|vou (te )?(bloquear|denunciar)|bloquead|den[uú]ncia|spam|golpe|vai se f|porra|caralho|merda|idiota|ot[aá]rio|palha[cç]o/i

export function ehHostil(texto) {
  return HOSTIL.test(String(texto || ''))
}

/**
 * Hora de parar? Segunda recusa da pessoa, ou hostilidade na última fala
 * dela. É o "informe ao sistema para não acionar mais este lead": depois da
 * despedida, o lead fica pausado e o robô não responde mais.
 */
export function deveEncerrar(conversa) {
  const falas = Array.isArray(conversa) ? conversa : []
  const ultimaDaPessoa = [...falas].reverse().find((f) => f?.de === 'pessoa')
  return contarRecusas(falas) >= 2 || ehHostil(ultimaDaPessoa?.texto)
}

function situacaoDaConversa(conversa) {
  const n = contarRecusas(conversa)
  const regra = deveEncerrar(conversa)
    ? `${n >= 2 ? 'segunda recusa' : 'não definitivo ou hostilidade'}. ENCERRE em uma frase, no masculino e sem chamar a pessoa por nome nenhum ("Obrigado pelo retorno, fico à disposição."), e não faça pergunta.`
    : n === 1
      ? 'UMA (a primeira, simples). NÃO encerre, NÃO agradeça: investigue com elegância (já têm um robô que atende em segundos, ou automação não é prioridade agora?) ou contorne a objeção, e proponha a demonstração com o Eduardo.'
      : 'Nenhuma. Siga: diagnóstico digital se ainda não fez, contorno da objeção se houver, e a demonstração com o Eduardo (amanhã às 10h ou às 14h).'
  return `\n\nRecusas até agora: ${regra}`
}

/* A objeção da última fala da pessoa, para a técnica certa não depender da
   sorte do modelo: o roteiro tem uma resposta para cada uma. */
export function dicaDaObjecao(conversa) {
  const ultima = [...(Array.isArray(conversa) ? conversa : [])].reverse().find((f) => f?.de === 'pessoa')
  const bruto = String(ultima?.texto || '')
  const t = normalizarFrase(bruto)
  if (!t) return ''
  if (/\b(tempo|corrid\w*|ocupad\w*|agenda|depois|outra hora|semana que vem|mes que vem)\b/.test(t)) {
    return 'A pessoa diz que não tem tempo: REDUZA O ESFORÇO (10 minutos com o Eduardo, ou o link de teste de 5 minutos) e ofereça os dois horários. Não investigue.'
  }
  if (/\b(caro|preco|valor|custa|custo|dinheiro|orcamento|prioridade|investir|investimento|cortando|grana)\b/.test(t)) {
    return 'A pessoa fala de custo ou prioridade: use o CUSTO DE NÃO AGIR (a ferramenta só guarda o contato; corretor em visita demora 30 minutos e o cliente compra do concorrente) e ofereça a demonstração com os dois horários.'
  }
  if (/\b(ja (temos|tem|usamos|usa|uso|temos um|tem um)|kenlo|vista|imobzi|jetimob|superlogica|nosso sistema|nosso crm|nosso site)\b/.test(t) && !bruto.includes('?')) {
    return 'A pessoa diz que já tem sistema, CRM ou site: use o CONTORNO (o sistema de vocês atende o lead no WhatsApp em 3 segundos de madrugada, qualifica e joga mastigado pro corretor sem ele mexer um dedo?).'
  }
  if (/\b(e ?mail|manda|envia|material|apresentacao|pdf)\b/.test(t)) {
    return 'A pessoa pede material: em 10 minutos o Eduardo mostra funcionando, o que vale mais que PDF; ofereça os dois horários.'
  }
  if (/\b(como (funciona|fariam|faria|seria|voces fazem)|faz sentido|interessante|me explica|quero entender|pode ser)\b/.test(t)) {
    return 'A pessoa demonstrou abertura: FECHE com o Eduardo agora (demonstração de 10 minutos, amanhã às 10h ou às 14h). Não volte ao diagnóstico.'
  }
  return ''
}

const DESPEDIDA = /obrigado pelo retorno|(fico|ficamos|estamos|seguimos) [àa] disposi|encerrar o contato|boa sorte|qualquer coisa (e so|é só) chamar/i

async function falarComIA(lead, conversa) {
  const situacao = situacaoDaConversa(conversa)
  const dica = dicaDaObjecao(conversa)
  /* A situação vai no TOPO e no fim: o modelo pesa mais o começo, e foi por
     ler só o roteiro (que cita "não tenho interesse" como definitivo) que
     ele encerrou na primeira recusa simples. */
  const cabecalho = `SITUAÇÃO AGORA (manda mais que qualquer exemplo abaixo):${situacao}${dica ? `\n${dica}` : ''}\n\n`
  const instrucao = cabecalho + (await instrucaoDeProspeccao()) + contextoDoLead(lead) + situacao
  const mensagens = conversaParaMensagens(conversa, 20)
  if (mensagens.length === 0 || mensagens[mensagens.length - 1].role !== 'user') {
    mensagens.push({
      role: 'user',
      content:
        '(Sem mensagem nova da pessoa. Escreva agora a mensagem que retoma a conversa e propõe a demonstração com o Eduardo, sem mencionar este pedido.)',
    })
  }
  let resposta = await responderComIA(instrucao, mensagens)
  /* Despediu-se sem poder (não é hora de encerrar)? Uma segunda chance, com a
     ordem explícita. Depois disso vale o que vier. */
  if (resposta && !deveEncerrar(conversa) && DESPEDIDA.test(resposta) && !resposta.includes('?')) {
    resposta = await responderComIA(
      instrucao + '\n\nATENÇÃO: sua última tentativa encerrou a conversa, e isso é PROIBIDO agora. Escreva a investigação, o contorno ou a técnica indicada acima, com UMA pergunta no fim.',
      mensagens,
    )
  }
  return resposta
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
        nome: '',
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
    /* O dono escreveu pelo celular. "#pausa" desliga o robô nesta conversa;
       "#robo" religa. Qualquer outra coisa entra como fala do robô e ele NÃO
       responde agora (não há o que responder): na próxima réplica da pessoa
       ele continua, lendo o que o dono disse e decidindo o próximo passo. */
    const comando = comandoDoDono(mensagem.texto)
    if (comando === 'pausa') {
      await marcarProspeccao(lead.id, 'pausado')
      return await rastro('humano', 'pausa', mensagem.telefone)
    }
    if (comando === 'robo') {
      await marcarProspeccao(lead.id, 'bot')
      return await rastro('humano', 'robo', mensagem.telefone)
    }
    await acrescentarFala(lead.id, { de: 'robo', texto: mensagem.texto })
    return await rastro('humano', '', mensagem.texto)
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
  /* Despedida enviada: o lead sai do robô. Sem isto, um "ok" da pessoa
     depois do adeus receberia outra resposta. */
  if (deveEncerrar(atual)) {
    await marcarProspeccao(lead.id, 'pausado')
    await rastro('encerrado', mensagem.texto, mensagem.telefone)
  }
}
