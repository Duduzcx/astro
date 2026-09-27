/**
 * Acesso ao banco.
 *
 * Um Postgres qualquer serve: Vercel Postgres, Neon, Supabase ou um servidor
 * próprio. O que o código pede é uma variável só, `POSTGRES_URL` (aceita
 * também `DATABASE_URL`, que é como a Supabase e outros chamam).
 *
 * SEM BANCO CONFIGURADO O SISTEMA NÃO FINGE QUE FUNCIONA. `temBanco()`
 * devolve falso, a rota de lead entrega o contato pelos outros caminhos e o
 * painel diz que o banco não está ligado. Guardar lead na memória de uma
 * função sem servidor seria perder lead em silêncio, que é o pior resultado
 * possível para uma agência.
 *
 * Uma conexão por invocação (`max: 1`): função sem servidor não tem onde
 * manter um pool, e um pool por invocação esgota o limite de conexões do
 * banco em qualquer pico.
 */
import postgres from 'postgres'

/**
 * A cadeia de conexão, procurada em todos os nomes que os provedores usam.
 * Cada um batiza a sua: a Vercel escreve POSTGRES_URL, a Supabase mostra
 * como "Connection string" e sugere DATABASE_URL, a Neon dá DATABASE_URL, e
 * quem copia do painel às vezes traz aspas ou `psql ` na frente. Aceitar
 * tudo isso é a diferença entre "cadastrei e não funcionou" e funcionar.
 */
const NOMES = [
  'POSTGRES_URL',
  'DATABASE_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_PRISMA_URL',
  'SUPABASE_DB_URL',
  'NEON_DATABASE_URL',
]

function acharUrl() {
  for (const nome of NOMES) {
    const bruto = String(process.env[nome] || '').trim()
    if (!bruto) continue
    /* Tira aspas de quem colou com elas e o `psql ` que a Supabase põe na
       frente do comando de exemplo. */
    const limpo = bruto
      .replace(/^psql\s+/i, '')
      .replace(/^["']|["']$/g, '')
      .trim()
    if (/^postgres(ql)?:\/\//i.test(limpo)) return { url: limpo, nome }
  }
  return { url: '', nome: '' }
}

const { url, nome: nomeDaVariavel } = acharUrl()

export function temBanco() {
  return Boolean(url)
}

/** De onde veio a cadeia de conexão, para o painel dizer o que leu. */
export function fonteDoBanco() {
  return nomeDaVariavel
}

let sqlCache = null

/** A conexão. Lança se não houver banco: quem chama deve checar antes. */
export function sql() {
  if (!url) throw new Error('POSTGRES_URL não configurada')
  if (!sqlCache) {
    /* Pelo pooler em modo transação (a porta 6543 da Supabase, o pgbouncer
       de qualquer provedor) uma instrução preparada some entre uma chamada
       e outra: o driver a registra numa conexão e a executa em outra, e
       vem "prepared statement does not exist" na segunda consulta. Fora do
       pooler as preparadas valem a pena e ficam ligadas. */
    const pelaPonte = /pooler\.|pgbouncer|:6543/i.test(url)
    sqlCache = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: !pelaPonte,
      /* A maioria dos Postgres gerenciados exige TLS e usa certificado que o
         Node não conhece de fábrica. `require` cifra a conexão sem exigir a
         cadeia — é o que os provedores documentam para serverless. */
      ssl: url.includes('sslmode=disable') ? false : 'require',
      /* O driver por padrão transforma o nome das colunas; aqui os nomes já
         vêm como queremos, e transformar esconderia erros de digitação. */
      transform: { undefined: null },
    })
  }
  return sqlCache
}

/**
 * O banco responde? Devolve o que o painel precisa mostrar quando alguém
 * cadastra a variável e nada aparece: "cadastrada" não é "conectada", e o
 * motivo de não conectar é quase sempre um destes quatro.
 */
export async function diagnosticoBanco() {
  if (!url) return { ok: false, variavel: '', motivo: 'nenhuma cadeia de conexão cadastrada' }
  let anfitriao = ''
  try {
    anfitriao = new URL(url).host
  } catch {
    return { ok: false, variavel: nomeDaVariavel, motivo: 'a cadeia de conexão não é uma URL válida' }
  }
  try {
    await prepararBanco()
    const [linha] = await sql()`SELECT count(*)::int AS leads FROM leads`
    return { ok: true, variavel: nomeDaVariavel, anfitriao, leads: linha?.leads ?? 0 }
  } catch (erro) {
    const m = String(erro?.message || '')
    const motivo = /password|SASL|autenti/i.test(m)
      ? 'senha recusada — confira a senha dentro da cadeia de conexão'
      : /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(m)
        ? 'endereço do banco não encontrado — confira o host'
        : /ETIMEDOUT|timeout|ECONNREFUSED/i.test(m)
          ? 'o banco não respondeu — confira a porta e se o projeto está ativo'
          : /self.signed|certificate/i.test(m)
            ? 'certificado recusado — acrescente ?sslmode=require ao fim da cadeia'
            : m.slice(0, 160) || 'falha desconhecida'
    return { ok: false, variavel: nomeDaVariavel, anfitriao, motivo }
  }
}

/**
 * Cria as tabelas se não existirem.
 *
 * Roda na primeira chamada de cada invocação fria. É barato (o Postgres
 * responde na hora quando já existe) e evita um passo manual de migração que
 * alguém esqueceria de rodar. Toda alteração futura de esquema entra aqui,
 * sempre com IF NOT EXISTS: a função pode rodar em paralelo em duas
 * invocações.
 */
let preparado = false
export async function prepararBanco() {
  if (preparado) return
  /* Tudo numa transação com trava consultiva: esta função roda em toda
     invocação fria, e duas funções que acordam juntas (leads e resumo,
     abrindo o painel) faziam o mesmo CREATE ao mesmo tempo. O IF NOT EXISTS
     não protege disso — as duas passam pela checagem e a segunda cai com
     "já existe" ou com chave duplicada no catálogo, e quem abriu o painel
     via "falha 500". Com a trava, a segunda espera a primeira terminar e
     encontra tudo pronto. */
  await sql().begin(async (s) => {
  await s`SELECT pg_advisory_xact_lock(202609)`
  await s`
    CREATE TABLE IF NOT EXISTS leads (
      id            BIGSERIAL PRIMARY KEY,
      criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      nome          TEXT NOT NULL DEFAULT '',
      empresa       TEXT NOT NULL DEFAULT '',
      contato       TEXT NOT NULL DEFAULT '',
      canal         TEXT NOT NULL DEFAULT 'site',
      necessidade   TEXT NOT NULL DEFAULT '',
      urgencia      TEXT NOT NULL DEFAULT '',
      orcamento     TEXT NOT NULL DEFAULT '',
      resumo        TEXT NOT NULL DEFAULT '',
      conversa      JSONB NOT NULL DEFAULT '[]'::jsonb,
      situacao      TEXT NOT NULL DEFAULT 'novo',
      valor_centavos BIGINT NOT NULL DEFAULT 0,
      anotacoes     TEXT NOT NULL DEFAULT ''
    )`
  /* Colunas acrescentadas depois da primeira versão. IF NOT EXISTS porque
     esta função roda em toda invocação fria, e em paralelo. */
  await s`ALTER TABLE leads ADD COLUMN IF NOT EXISTS retorno_em DATE`
  await s`ALTER TABLE leads ADD COLUMN IF NOT EXISTS responsavel TEXT NOT NULL DEFAULT ''`
  await s`CREATE INDEX IF NOT EXISTS leads_criado_em_idx ON leads (criado_em DESC)`
  await s`CREATE INDEX IF NOT EXISTS leads_situacao_idx ON leads (situacao)`
  await s`CREATE INDEX IF NOT EXISTS leads_retorno_idx ON leads (retorno_em) WHERE retorno_em IS NOT NULL`
  /* Prospecção pelo número pessoal (api/_lib/prospeccao.js): '' (não é),
     'bot' (o robô conduz) ou 'pausado' (a mão humana assumiu). */
  await s`ALTER TABLE leads ADD COLUMN IF NOT EXISTS prospeccao TEXT NOT NULL DEFAULT ''`
  await s`CREATE INDEX IF NOT EXISTS leads_contato_idx ON leads (contato, criado_em DESC)`
  /* A Evolution reentrega o que demora: cada mensagem da prospecção
     responde uma vez só. */
  await s`
    CREATE TABLE IF NOT EXISTS prospeccao_mensagens (
      wamid  TEXT PRIMARY KEY,
      quando TIMESTAMPTZ NOT NULL DEFAULT now()
    )`

  /* O histórico do relacionamento. É isto que separa um CRM de uma lista de
     contatos: saber o que já foi conversado, e quando. */
  await s`
    CREATE TABLE IF NOT EXISTS atividades (
      id      BIGSERIAL PRIMARY KEY,
      lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      quando  TIMESTAMPTZ NOT NULL DEFAULT now(),
      tipo    TEXT NOT NULL DEFAULT 'nota',
      texto   TEXT NOT NULL DEFAULT ''
    )`
  await s`CREATE INDEX IF NOT EXISTS atividades_lead_idx ON atividades (lead_id, quando DESC)`

  /* Configuração editável pelo painel — hoje os textos do robô do WhatsApp.
     Ficam no banco para a equipe mudar sem mexer em código nem republicar. */
  await s`
    CREATE TABLE IF NOT EXISTS config (
      chave TEXT PRIMARY KEY,
      valor JSONB NOT NULL,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  /* O diário do robô: cada mensagem que entrou (WhatsApp ou chat do site)
     e o que saiu. É o que o painel mostra como interações em tempo real.
     Podado a duas mil linhas por quem grava. */
  await s`
    CREATE TABLE IF NOT EXISTS bot_logs (
      id      BIGSERIAL PRIMARY KEY,
      quando  TIMESTAMPTZ NOT NULL DEFAULT now(),
      canal   TEXT NOT NULL DEFAULT '',
      de      TEXT NOT NULL DEFAULT '',
      entrada TEXT NOT NULL DEFAULT '',
      saida   TEXT NOT NULL DEFAULT '',
      modo    TEXT NOT NULL DEFAULT ''
    )`
  /* Tentativas de entrar no painel. Serve para travar força bruta sem
     precisar de um Redis só para isso. */
  await s`
    CREATE TABLE IF NOT EXISTS tentativas_login (
      id        BIGSERIAL PRIMARY KEY,
      quando    TIMESTAMPTZ NOT NULL DEFAULT now(),
      origem    TEXT NOT NULL DEFAULT '',
      sucesso   BOOLEAN NOT NULL DEFAULT false
    )`
  await s`CREATE INDEX IF NOT EXISTS tentativas_quando_idx ON tentativas_login (quando DESC)`
  })
  preparado = true
}

/** As situações do funil, na ordem em que um negócio anda. */
export const SITUACOES = ['novo', 'contatado', 'proposta', 'fechado', 'perdido']
