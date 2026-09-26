import test from 'node:test'
import assert from 'node:assert/strict'

/* A cadeia de conexão é o ponto em que o painel para de mostrar exemplos e
   passa a guardar lead de verdade. Quem cola do painel da Supabase traz
   aspas, `psql ` na frente e a porta do pooler — e cada um desses detalhes
   já custou uma tarde de "cadastrei e não funcionou". */

delete process.env.POSTGRES_URL
delete process.env.DATABASE_URL
process.env.SUPABASE_DB_URL = '  psql "postgresql://postgres.abc:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"  '

const { temBanco, fonteDoBanco, sql } = await import('../api/_lib/db.js')

test('a cadeia colada do painel do provedor é aceita, com aspas e tudo', () => {
  assert.equal(temBanco(), true)
  assert.equal(fonteDoBanco(), 'SUPABASE_DB_URL')
})

test('pelo pooler, o driver desliga as instruções preparadas', () => {
  /* Em modo transação o pgbouncer não guarda a instrução preparada entre uma
     chamada e outra: a segunda consulta viria com "prepared statement does
     not exist". O driver precisa nascer com prepare desligado. */
  const s = sql() as unknown as { options: { prepare: boolean; ssl: string | boolean } }
  assert.equal(s.options.prepare, false)
  assert.equal(s.options.ssl, 'require')
})
