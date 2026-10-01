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
import { conversaParaMensagens, dentroDoTeto, limpar, modeloGroqEmUso, qualInteligencia, responderComIA, temInteligencia, transcreverAudio } from './inteligencia.js'
import { acharLeadPorContato, acrescentarFala, criarLead, paraArray, texto as limparTexto } from './leads.js'
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
    if (dados?.resetarGatilho) {
      await gravarConfig('prospeccao_gatilho', '')
      return res.status(200).json({ ok: true, gatilho: 'padrão de fábrica' })
    }
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
  'JEITO DE ESCREVER: português correto e simples, sem gíria e sem abreviação ("você", "para", "está"), caloroso e sem formalidade. Muita gente mais velha do outro lado: frases curtas, uma ideia por frase, palavras comuns. Sem dois-pontos, ponto e vírgula, travessão, negrito, lista ou emoji. Varie o começo (não comece tudo com "Entendo"). Quando a mensagem tiver duas partes (responder algo e depois perguntar outra coisa), separe em dois balões com uma linha em branco, no máximo dois balões, cada um com uma frase. Nunca empilhe assuntos numa mensagem.',
  'PERCEPÇÃO: leia o tom da pessoa e adapte. Pessoa mais velha ou confusa, mais paciência e explicação simples. Pergunta fora do roteiro, responda breve e natural e volte ao assunto. Você conduz a venda, mas conversa como gente, com jeito próprio, sem decorar frases.',
  'RITMO E ETIQUETA (anti-afobação): quem manda na velocidade da conversa é o cliente. Se a pessoa só cumprimentou ("Boa tarde", "Tudo bem?"), responda o cumprimento e PARE, sem pergunta comercial. Uma pergunta por vez; espere a resposta antes do próximo passo. Só fale de site, CRM ou automação quando houver abertura real. NUNCA repita uma pergunta ou uma mensagem já enviada: se a pessoa não respondeu, mude a abordagem ou espere.',
  '',
  'Regras que você NUNCA quebra:',
  '- Nunca jargão técnico (API, backend, frontend, SaaS, integração via API). Fale em atender rápido, não perder cliente, vender mais.',
  '- Nunca invente preço, prazo, cliente, link ou funcionalidade. Fatos da empresa que você não sabe (cidade, região atendida, quantos clientes, quem já usa): não invente. Diga em uma frase que o Eduardo confirma isso na conversa e siga.',
  '- Com o cliente, nunca diga "lead", "funil", "qualificar" ou "automação de processo". Diga "cliente", "pessoa que chama", "atender na hora", "sem perder cliente".',
  '- Nunca prometa nada em nome da empresa além do retorno do Eduardo.',
  '- Nunca peça senha, cartão ou dado bancário.',
  '- Nunca escreva marcador de modelo como [Nome]. Se não souber o nome da pessoa, não use nome nenhum (nem na despedida: "Obrigado pelo retorno." e ponto).',
  '- Eduardo é o diretor da Astro, do seu lado. NUNCA chame a pessoa com quem você fala de Eduardo nem de nenhum outro nome que ela não tenha dito.',
  '- Nunca mais de uma pergunta por mensagem; nunca mais de duas frases. Nunca seja desrespeitoso, mesmo se a pessoa for.',
  '- Se a mensagem recebida parecer automática (menu numerado, "digite 1", "seja bem-vindo", "responderemos em breve"), não converse com o robô: escolha a opção que leva a uma pessoa ou peça o responsável.',
  '- Nunca use emoji.',
].join('\n')

/**
 * A frase gatilho. O dono manda uma destas pelo celular, na conversa que
 * quiser, e o robô assume: guarda a mensagem como a primeira fala dele e
 * responde sozinho quando a pessoa replicar. Uma frase por linha; a
 * comparação ignora maiúsculas, acentos e pontuação, e vale se a mensagem
 * CONTIVER a frase. Editável no painel.
 */
export const GATILHO_PADRAO = ['Boa tarde', 'Bom dia', 'Boa noite', 'notei um gargalo'].join('\n')

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

/**
 * O modo do robô. 'responder' (padrão): só fala com quem escreveu primeiro
 * ou com quem o dono abriu à mão pelo celular; sem abordagem a frio e sem
 * empurrão automático. 'ativo': empurrão em conversa parada e abordagem a
 * frio pelo painel, dentro do limite diário. Foi o modo ativo, com dezenas
 * de números desconhecidos num minuto, que levou à restrição de 24 horas.
 */
export const MODOS_DO_ROBO = ['responder', 'ativo']
export async function modoDeProspeccao() {
  const salvo = await lerConfig('prospeccao_modo', null)
  return MODOS_DO_ROBO.includes(salvo) ? salvo : 'responder'
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
    .some((fala) => limpar(fala.texto, 800) === alvo || String(fala.texto || '').split(/\n{2,}/).some((parte) => limpar(parte, 800) === alvo))
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
/* Resposta automática do outro lado: menu numerado, "digite 1", saudação
   padrão de robô, aviso de horário de atendimento, protocolo. Ou a MESMA
   mensagem repetida (o "responderemos em breve" que volta a cada envio). */
const AUTOMATICA =
  /mensagem autom[aá]tica|atendimento autom|resposta autom|assistente virtual|sou (o|a|um|uma) (assistente|bot|rob[oô])|digite (o n[uú]mero|uma op[cç][aã]o|a op[cç][aã]o|\d)|escolha (uma|a) op[cç][aã]o|op[cç][aã]o (desejada|inv[aá]lida)|seja bem[- ]vind|responderemos (em breve|assim que|o mais)|retornaremos (em breve|o mais)|em breve (um|uma|nossa|nosso) (atendente|equipe|consultor|corretor)|hor[aá]rio de (atendimento|funcionamento)|fora do (nosso )?hor[aá]rio|n[uú]mero de protocolo|seu protocolo|n[aã]o (é|e) monitorad|para (falar|continuar|prosseguir)[^.]{0,40}(digite|envie|responda)|aguarde (um momento|que um|enquanto)/i
const LINHA_DE_MENU = /^\s*(\d{1,2}|[a-z])\s*[-.):|]\s*\S/i

/* Num menu automático, a opção que leva a uma pessoa ("3 - Falar com
   atendente", "2) Comercial"). Devolve o que digitar ("3"), ou '' se o menu
   não tem uma opção assim. */
const OPCAO_HUMANA = /atendente|humano|pessoa|falar com|comercial|vendas|vender|corretor|dono|gerente|propriet|outros|outro assunto|demais/i
export function temMenu(texto) {
  return String(texto || '').split(/\r?\n/).filter((linha) => LINHA_DE_MENU.test(linha)).length >= 2
}
export function opcaoHumana(texto) {
  for (const linha of String(texto || '').split(/\r?\n/)) {
    const m = linha.match(/^\s*(\d{1,2}|[a-z])\s*[-.):|]\s*(.+)$/i)
    if (m && OPCAO_HUMANA.test(m[2])) return m[1]
  }
  return ''
}

export function pareceAutomatica(texto) {
  const t = String(texto || '')
  if (!t.trim()) return false
  if (AUTOMATICA.test(t)) return true
  return t.split(/\r?\n/).filter((linha) => LINHA_DE_MENU.test(linha)).length >= 2
}

/* Quantas mensagens automáticas a pessoa mandou em seguida, contando do fim
   (as do robô no meio não interrompem). Repetir uma mensagem anterior dela
   também conta. Três seguidas: não há pessoa do outro lado, e o robô para. */
export function contarAutomaticasSeguidas(conversa) {
  const daPessoa = (Array.isArray(conversa) ? conversa : []).filter((f) => f?.de === 'pessoa').map((f) => String(f.texto || ''))
  let n = 0
  for (let i = daPessoa.length - 1; i >= 0; i -= 1) {
    const atual = normalizarFrase(daPessoa[i])
    const repetida = atual.length > 8 && daPessoa.slice(0, i).some((x) => normalizarFrase(x) === atual)
    if (pareceAutomatica(daPessoa[i]) || repetida) n += 1
    else break
  }
  return n
}

/* A pessoa aceitou um horário? Precisa de uma hora explícita ("14h",
   "10:30") junto de um sim, e nenhum "não" na frase. É o fim do trabalho do
   robô: confirma, agradece e o Eduardo assume. */
const HORA = /\b(\d{1,2}\s?h(\s?\d{2})?|\d{1,2}\s\d{2}\b|\d{1,2}\s?horas?|as \d{1,2}\b|meio dia)\b/
const ACEITE = /\b(pode ser|fechado|combinado|ok|beleza|bora|vamos|perfeito|otimo|topo|confirmo|confirmado|pode marcar|pode agendar|marca|fica bom|ta bom|tudo bem|certo|melhor|prefiro)\b/
export function aceitouHorario(texto) {
  if (pareceAutomatica(texto)) return false
  const t = normalizarFrase(texto)
  return HORA.test(t) && ACEITE.test(t) && !/\b(nao|nunca|nem)\b/.test(t)
}

export function dicaDaObjecao(conversa) {
  const ultima = [...(Array.isArray(conversa) ? conversa : [])].reverse().find((f) => f?.de === 'pessoa')
  const bruto = String(ultima?.texto || '')
  const t = normalizarFrase(bruto)
  if (!t) return ''
  if (pareceAutomatica(bruto)) {
    return 'A última mensagem parece de um ATENDIMENTO AUTOMÁTICO (robô, menu, resposta padrão), não de uma pessoa. Não converse com ele e não se apresente. Se há menu com opções, responda SÓ com o número ou a palavra da opção que leva a uma pessoa (atendente, comercial, vendas, corretor, dono, outros). Se não há menu, peça em uma frase para falar com o responsável pela imobiliária. Sem pergunta de diagnóstico.'
  }
  if (/\b(qual|que|quais) (gargalo|problema|falha|erro)s?\b|\bque gargalo\b|\b(pode|podem) falar\b|\bme (conta|diz|fala)\b/.test(t) && !/\bnao\b/.test(t)) {
    return 'A pessoa perguntou qual é o gargalo. Diga em uma frase, sem inventar nada sobre o sistema dela: "Quem chama vocês no WhatsApp com o corretor em visita, à noite ou no fim de semana fica sem resposta, esfria e vai pro concorrente." Depois emende UMA pergunta curta, de ate dez palavras, sobre como eles atendem esses contatos hoje. Tudo em no maximo 30 palavras.'
  }
  if (aceitouHorario(bruto)) {
    return 'A pessoa ACEITOU um horário: confirme dia e hora em uma frase, agradeça no masculino e diga que o Eduardo confirma com ela antes. Nenhuma pergunta, nenhuma proposta nova, nenhum link.'
  }
  if (/\b(tempo|corrid\w*|ocupad\w*|agenda|depois|outra hora|semana que vem|mes que vem)\b/.test(t)) {
    return 'A pessoa diz que não tem tempo: REDUZA O ESFORÇO (10 minutos com o Eduardo, ou o link de teste de 5 minutos) e ofereça os dois horários. Não investigue.'
  }
  if (/\b(caro|preco|valor|custa|custo|dinheiro|orcamento|prioridade|investir|investimento|cortando|grana)\b/.test(t)) {
    return 'A pessoa fala de custo ou prioridade: use o CUSTO DE NÃO AGIR (a ferramenta só guarda o contato; corretor em visita demora 30 minutos e o cliente compra do concorrente) e ofereça a demonstração com os dois horários.'
  }
  if (/\b(ja (temos|tem|usamos|usa|uso|temos um|tem um)|kenlo|vista|imobzi|jetimob|superlogica|nosso sistema|nosso crm|nosso site)\b/.test(t) && !bruto.includes('?')) {
    return 'A pessoa diz que já tem sistema, CRM ou site: use o CONTORNO como PERGUNTA, nunca como afirmação sobre o sistema deles: "O sistema de vocês atende o lead no WhatsApp em 3 segundos de madrugada, qualifica e joga mastigado pro corretor sem ele mexer um dedo?" Não elogie, não descreva e não presuma o que o sistema deles faz.'
  }
  if (/\b(e ?mail|manda|envia|material|apresentacao|pdf)\b/.test(t)) {
    return 'A pessoa pede material: em 10 minutos o Eduardo mostra funcionando, o que vale mais que PDF; ofereça os dois horários.'
  }
  if (/\b(como (funciona|fariam|faria|seria|voces fazem)|faz sentido|interessante|me explica|quero entender)\b/.test(t)) {
    return 'A pessoa demonstrou abertura: FECHE com o Eduardo agora (demonstração de 10 minutos, amanhã às 10h ou às 14h). Não volte ao diagnóstico.'
  }
  return ''
}

const DESPEDIDA = /obrigado pelo retorno|(fico|ficamos|estamos|seguimos) [àa] disposi|encerrar o contato|boa sorte|qualquer coisa (e so|é só) chamar/i

const PEDIDO_DE_PESSOA = 'Olá! Preciso falar com o responsável pela imobiliária. Consegue me passar para uma pessoa?'

/* Tira o que soa a máquina: dois-pontos fora de horário, ponto e vírgula,
   travessão, negrito. "Só para entender: é porque" vira "Só para entender,
   é porque"; "10:30" fica como está. */
export function humanizar(texto) {
  const limpo = String(texto || '')
    .replace(/\*\*/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]|\u{FE0F}|\u{200D}/gu, '')
    .replace(/(\D):[ \t]+/g, '$1, ')
    .replace(/[ \t]*[—–][ \t]*/g, ', ')
    .replace(/;[ \t]*/g, ', ')
    .replace(/,[ \t]*,/g, ',')
    .replace(/[ \t]+([.!?,])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
  /* Dois balões no máximo: o que passar disso junta no segundo. */
  const partes = limpo.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  if (partes.length <= 2) return partes.join('\n\n')
  return `${partes[0]}\n\n${partes.slice(1).join(' ')}`
}

/* O dono escreveu numa conversa do robô: por dez minutos é ele quem atende.
   A fala da pessoa fica guardada e o robô cala; passado o tempo, ele volta
   com tudo no contexto. */
const JANELA_MAO_HUMANA = 10 * 60 * 1000
async function maoHumanaAtiva(leadId) {
  const quando = await lerConfig(`mao_humana_${leadId}`, null)
  return typeof quando === 'string' && Date.now() - Date.parse(quando) < JANELA_MAO_HUMANA
}

/* Abordagens a frio (número digitado, sem conversa) por dia. É a regra do
   WhatsApp: mensagem não solicitada em volume bloqueia o número. Padrão 20;
   ABORDAGENS_POR_DIA muda. Conversas existentes não contam. */
const ABORDAGENS_PADRAO = 10
export async function dentroDoLimiteDeAbordagens() {
  if (!temBanco()) return true
  const limite = Number(process.env.ABORDAGENS_POR_DIA || ABORDAGENS_PADRAO)
  if (!Number.isFinite(limite) || limite <= 0) return false
  const hoje = new Date().toISOString().slice(0, 10)
  await prepararBanco()
  const s = sql()
  const [linha] = await s`
    INSERT INTO config ${s({ chave: 'abordagens_uso', valor: s.json({ dia: hoje, quantas: 1 }) })}
    ON CONFLICT (chave) DO UPDATE SET
      valor = CASE
        WHEN config.valor->>'dia' = ${hoje}
          THEN jsonb_build_object('dia', ${hoje}, 'quantas', (config.valor->>'quantas')::int + 1)
        ELSE jsonb_build_object('dia', ${hoje}, 'quantas', 1)
      END,
      atualizado_em = now()
    RETURNING (valor->>'quantas')::int AS quantas`
  return (linha?.quantas || 1) <= limite
}

/* Saudação pura ("Boa tarde", "Oi, tudo bem?", "Tudo ótimo, e com você?"):
   só palavras de cumprimento, até oito, com pelo menos uma saudação de
   verdade. A etiqueta manda responder o cumprimento e parar. */
const PALAVRAS_DE_SAUDACAO = new Set('oi oii ola olá opa eai e ai fala bom boa dia tarde noite tudo bem td tb como vai voce vc esta ta beleza blz tranquilo com otimo certo sim joia joinha ok mesmo aqui por tambem a o obrigado obrigada gente'.split(' '))
const CUMPRIMENTO = /\b(oi+|ola|opa|eai|e ai|bom dia|boa tarde|boa noite|tudo bem|tudo bom|td bem|td bom|como vai|como voce|como vc|beleza|e voce|e vc|e com voce|e com vc)\b/
export function ehSaudacao(texto) {
  const t = normalizarFrase(texto)
  if (!t) return false
  const palavras = t.split(' ')
  if (palavras.length > 8) return false
  return CUMPRIMENTO.test(t) && palavras.every((p) => PALAVRAS_DE_SAUDACAO.has(p))
}

/* A saudação da hora, em São Paulo, ou a que a pessoa usou. */
export function saudacaoDoDia(textoDaPessoa = '') {
  const t = normalizarFrase(textoDaPessoa)
  if (t.includes('bom dia')) return 'Bom dia'
  if (t.includes('boa tarde')) return 'Boa tarde'
  if (t.includes('boa noite')) return 'Boa noite'
  const hora = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }))
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
}

/* Duas mensagens são "a mesma" se, tirados acentos e pontuação, forem
   iguais ou compartilharem 55% das palavras. É o que barra o robô de
   repetir a pergunta que acabou de fazer. */
export function parecida(a, b) {
  const na = normalizarFrase(a)
  const nb = normalizarFrase(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const pa = new Set(na.split(' ').filter((p) => p.length > 2))
  const pb = new Set(nb.split(' ').filter((p) => p.length > 2))
  if (pa.size === 0 || pb.size === 0) return false
  let comuns = 0
  for (const p of pa) if (pb.has(p)) comuns += 1
  return comuns / (pa.size + pb.size - comuns) >= 0.55
}

/* Quem parou de responder ganha um empurrão leve, UMA vez: a última fala é
   do robô e a anterior não é (ou não existe). Não empurra depois de uma
   despedida, de um pedido a um robô alheio, nem em cima de resposta
   automática. */
export function precisaRetomar(conversa) {
  const falas = paraArray(conversa)
  const ultima = falas[falas.length - 1]
  if (!ultima || ultima.de !== 'robo') return false
  const anterior = falas[falas.length - 2]
  if (anterior && anterior.de === 'robo') return false
  if (DESPEDIDA.test(String(ultima.texto || '')) || ultima.texto === PEDIDO_DE_PESSOA) return false
  if (anterior && pareceAutomatica(anterior.texto)) return false
  return true
}

/**
 * A ponte chama a cada dez minutos (ela está sempre ligada; a Vercel grátis
 * só tem cron diário). Três leads por vez, os parados há mais tempo, entre
 * 20 minutos e 2 dias sem resposta.
 */
export async function retomarConversas() {
  if (!temBanco() || !temInteligencia()) return { retomadas: 0 }
  if ((await modoDeProspeccao()) !== 'ativo') return { retomadas: 0, modo: 'responder' }
  await prepararBanco()
  const s = sql()
  const parados = await s`
    SELECT * FROM leads
    WHERE prospeccao = 'bot' AND canal = 'prospeccao'
      AND atualizado_em < now() - interval '20 minutes'
      AND atualizado_em > now() - interval '2 days'
    ORDER BY atualizado_em ASC LIMIT 3`
  const evo = await evolucaoDaProspeccao()
  if (!evo) return { retomadas: 0 }
  let retomadas = 0
  for (const linha of parados) {
    const conversa = paraArray(linha.conversa)
    if (!precisaRetomar(conversa)) continue
    if (await maoHumanaAtiva(linha.id)) continue
    const telefone = String(linha.contato || '')
    try {
      const resposta = await falarComIA({ ...linha, conversa }, conversa)
      if (!resposta) continue
      await evo.enviarTexto(instanciaPessoal(), telefone, resposta)
      await acrescentarFala(linha.id, { de: 'robo', texto: resposta })
      await registrarLog({ canal: 'prospeccao', de: telefone, entrada: '(retomada)', saida: resposta, modo: 'retomada' }).catch(() => {})
      retomadas += 1
    } catch (erro) {
      await registrarLog({ canal: 'prospeccao', de: telefone, entrada: '(retomada)', saida: String(erro?.message || '').slice(0, 90), modo: 'debug' }).catch(() => {})
    }
  }
  return { retomadas }
}

export async function retomarPonte(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ erro: 'método não permitido' })
  }
  const chave = String(req.headers.apikey || '')
  if (!chave || chave !== (process.env.EVOLUTION_API_KEY || '')) return res.status(401).json({ erro: 'não autorizado' })
  return res.status(200).json({ ok: true, ...(await retomarConversas()) })
}

async function falarComIA(lead, conversa) {
  return humanizar(await falarComIACru(lead, conversa))
}

async function falarComIACru(lead, conversa) {
  /* Resposta automática do outro lado: nada de modelo. Com menu, digita a
     opção que leva a uma pessoa; sem menu (ou sem essa opção), pede o
     responsável em uma frase. O modelo, quando chamado aqui, respondia "1"
     a um aviso sem menu. */
  const falas = Array.isArray(conversa) ? conversa : []
  const ultimaFala = falas[falas.length - 1]
  const ultimaDaPessoa = [...falas].reverse().find((f) => f?.de === 'pessoa')?.texto || ''
  if (ultimaFala?.de === 'pessoa' && pareceAutomatica(ultimaDaPessoa)) {
    const opcao = temMenu(ultimaDaPessoa) ? opcaoHumana(ultimaDaPessoa) : ''
    return opcao || PEDIDO_DE_PESSOA
  }

  /* Etiqueta: cumprimento puro nas duas primeiras falas da pessoa recebe só
     o cumprimento de volta, e para. "Tudo bem?" de volta vira a pergunta
     leve de quem fala com o responsável. Sem modelo: o modelo emendava a
     pergunta comercial. */
  const falasDaPessoa = falas.filter((f) => f?.de === 'pessoa')
  if (ultimaFala?.de === 'pessoa' && falasDaPessoa.length <= 2 && ehSaudacao(ultimaDaPessoa)) {
    const t = normalizarFrase(ultimaDaPessoa)
    if (/\b(tudo bem|tudo bom|td bem|td bom|como vai|como voce|como vc|e voce|e vc|e com voce|e com vc|beleza)\b/.test(t)) {
      return 'Tudo certo por aqui também!\n\nEstou falando com o responsável pela imobiliária?'
    }
    const jaSeApresentou = falas.some((f) => f?.de === 'robo' && /assistente da astro/i.test(String(f.texto || '')))
    return `${saudacaoDoDia(ultimaDaPessoa)}, tudo bem?${jaSeApresentou ? '' : ' Aqui é o assistente da Astro Soluções.'}`
  }

  const situacao = situacaoDaConversa(conversa)
  const dica = dicaDaObjecao(conversa)
  /* A situação vai no TOPO e no fim: o modelo pesa mais o começo, e foi por
     ler só o roteiro (que cita "não tenho interesse" como definitivo) que
     ele encerrou na primeira recusa simples. */
  const cabecalho = `SITUAÇÃO AGORA (manda mais que qualquer exemplo abaixo):${situacao}${dica ? `\n${dica}` : ''}\n\n`
  const instrucao = cabecalho + (await instrucaoDeProspeccao()) + contextoDoLead(lead) + situacao
  const mensagens = conversaParaMensagens(conversa, 20)
  /* Abertura a frio (número digitado, sem histórico): só o cumprimento e a
     apresentação. O assunto vem quando a pessoa responder, ou na retomada. */
  if (mensagens.length === 0) return `${saudacaoDoDia()}, tudo bem? Aqui é o assistente da Astro Soluções.`
  if (mensagens[mensagens.length - 1].role !== 'user') {
    mensagens.push({
      role: 'user',
      content:
        '(A pessoa não respondeu à sua última mensagem. Puxe o assunto de leve, em UMA frase curta com UMA pergunta, diferente da anterior: se ainda não perguntou se fala com o responsável, pergunte isso; senão, a pergunta de diagnóstico digital; se o diagnóstico já foi feito, proponha a demonstração com o Eduardo. Não mencione este pedido.)',
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
  /* Insistiu em se despedir? Entra o roteiro, sem o modelo: a investigação
     do primeiro não, ou a pergunta de diagnóstico. Medido: o gpt-oss trata
     "não tenho interesse, obrigado" como definitivo mesmo com a ordem. */
  if (resposta && !deveEncerrar(conversa) && DESPEDIDA.test(resposta) && !resposta.includes('?')) {
    resposta =
      contarRecusas(conversa) >= 1
        ? 'Compreendo. Só para entender o cenário de vocês: é porque já têm um robô que atende em segundos, ou automação não é prioridade agora?'
        : 'Entendi. Hoje o site e o atendimento no WhatsApp de vocês estão rodando redondo, ou sentem que perdem clientes por lentidão?'
  }
  /* Anti-repetição: igual (ou 70% igual) a uma das três últimas do robô?
     Uma segunda chance pedindo algo diferente; depois, uma frase neutra que
     devolve a vez à pessoa. */
  const ultimasDoRobo = falas.filter((f) => f?.de === 'robo').slice(-3).map((f) => String(f.texto || ''))
  if (resposta && ultimasDoRobo.some((x) => parecida(x, resposta))) {
    resposta = await responderComIA(
      instrucao + '\n\nATENÇÃO: você ia repetir uma mensagem que já mandou nesta conversa. Escreva algo DIFERENTE, avançando um passo, sem refazer a pergunta anterior.',
      mensagens,
    )
    if (ultimasDoRobo.some((x) => parecida(x, resposta))) {
      resposta = 'Sem problema. Quando puder, me diz qual horário fica melhor para você e eu deixo tudo certo com o Eduardo.'
    }
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
  if (!mensagem) return await rastro('debug', 'sem mensagem', evento?.data?.key?.remoteJid || '')
  if (!mensagem.texto && !mensagem.temAudio) return await rastro('debug', 'sem texto', evento?.data?.key?.remoteJid || '')
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
    await gravarConfig(`mao_humana_${lead.id}`, new Date().toISOString())
    return await rastro('humano', '', mensagem.texto)
  }

  /* Áudio: a ponte mandou o arquivo; o Whisper da Groq transcreve e a
     conversa segue como texto. Sem transcrição, pede por escrito. */
  let textoDaPessoa = mensagem.texto
  if (!textoDaPessoa && mensagem.temAudio) {
    const transcrito = mensagem.audio ? await transcreverAudio(mensagem.audio.base64, mensagem.audio.mime).catch(() => '') : ''
    if (transcrito) {
      textoDaPessoa = `(áudio) ${transcrito}`
    } else {
      const pedido = 'Aqui o áudio não abriu. Consegue me mandar por texto?'
      await acrescentarFala(lead.id, { de: 'pessoa', texto: '(áudio que não deu para ouvir)' })
      try {
        const evo = await evolucaoDaProspeccao()
        await evo?.enviarTexto(instanciaPessoal(), mensagem.telefone, pedido)
      } catch (erro) {
        return await rastro('debug', 'envio falhou', erro?.message || '')
      }
      await acrescentarFala(lead.id, { de: 'robo', texto: pedido })
      return await rastro('audio', 'sem transcrição', mensagem.telefone)
    }
  }
  const atual = await acrescentarFala(lead.id, { de: 'pessoa', texto: textoDaPessoa })
  if (await maoHumanaAtiva(lead.id)) return await rastro('humano-ativo', textoDaPessoa, mensagem.telefone)

  /* Robô do outro lado: três mensagens automáticas seguidas sem uma pessoa
     aparecer, e o robô deixa um recado e para. Senão vira conversa sem fim.
     Nas duas primeiras, a IA tenta chegar a uma pessoa (dica da objeção). */
  if (contarAutomaticasSeguidas(atual) >= 3) {
    const recado = 'Quando o responsável pela imobiliária puder, é só me chamar por aqui.'
    try {
      const evo = await evolucaoDaProspeccao()
      await evo?.enviarTexto(instanciaPessoal(), mensagem.telefone, recado)
      await acrescentarFala(lead.id, { de: 'robo', texto: recado })
    } catch (erro) {
      await rastro('debug', 'envio falhou', erro?.message || '')
    }
    await marcarProspeccao(lead.id, 'pausado')
    return await rastro('robo-alheio', textoDaPessoa, mensagem.telefone)
  }

  if (!temInteligencia() || !(await dentroDoTeto())) return await rastro('silencio', textoDaPessoa, 'sem IA/teto')
  let resposta = ''
  try {
    resposta = await falarComIA(lead, atual)
  } catch (erro) {
    return await rastro('debug', 'IA falhou', erro?.message || '')
  }
  if (!resposta) return await rastro('debug', 'IA vazia', textoDaPessoa)
  try {
    const evo = await evolucaoDaProspeccao()
    await evo?.enviarTexto(instanciaPessoal(), mensagem.telefone, resposta)
  } catch (erro) {
    return await rastro('debug', 'envio falhou', erro?.message || '')
  }
  await acrescentarFala(lead.id, { de: 'robo', texto: resposta })
  await rastro('ia', textoDaPessoa, resposta)
  if (deveEncerrar(atual)) {
    await marcarProspeccao(lead.id, 'pausado')
    await rastro('encerrado', textoDaPessoa, mensagem.telefone)
  } else if (aceitouHorario(textoDaPessoa)) {
    /* Reunião aceita: o robô confirmou e sai; daqui em diante é o Eduardo,
       pelo celular. "#robo" devolve ao robô se precisar. */
    await marcarProspeccao(lead.id, 'pausado')
    await rastro('agendou', textoDaPessoa, mensagem.telefone)
  }
}
