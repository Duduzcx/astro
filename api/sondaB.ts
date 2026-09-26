/* SONDA TEMPORÁRIA: TypeScript importando a dependência do Supabase. */
import { createClient } from '@supabase/supabase-js'
export default function handler(_req: unknown, res: { status(n: number): { json(x: unknown): void } }) {
  res.status(200).json({ sonda: 'B', ok: true, tipo: typeof createClient })
}
