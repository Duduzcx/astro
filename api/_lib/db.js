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

const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || ''

export function temBanco() {
  return Boolean(url)
}

let sqlCache = null

/** A conexão. Lança se não houver banco: quem chama deve checar antes. */
export function sql() {
  if (!url) throw new Error('POSTGRES_URL não configurada')
  if (!sqlCache) {
    sqlCache = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
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
  const s = sql()
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
  await s`CREATE INDEX IF NOT EXISTS leads_criado_em_idx ON leads (criado_em DESC)`
  await s`CREATE INDEX IF NOT EXISTS leads_situacao_idx ON leads (situacao)`
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
  preparado = true
}

/** As situações do funil, na ordem em que um negócio anda. */
export const SITUACOES = ['novo', 'contatado', 'proposta', 'fechado', 'perdido']
