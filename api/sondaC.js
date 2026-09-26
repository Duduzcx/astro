/* SONDA TEMPORÁRIA: JavaScript importando o Supabase, para separar a
   dependência da linguagem. */
import { createClient } from '@supabase/supabase-js'
export default function handler(_req, res) {
  res.status(200).json({ sonda: 'C', ok: true, tipo: typeof createClient })
}
