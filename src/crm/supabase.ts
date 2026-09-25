import { createClient } from '@supabase/supabase-js'

/**
 * O cliente do navegador: só a chave pública (anon), que a RLS limita ao que
 * o usuário logado pode ler da própria clínica. Toda escrita vai pelas rotas
 * em /api/crm, com a chave de serviço, que nunca chega aqui.
 *
 * Os valores abaixo são públicos por natureza; as variáveis VITE_* permitem
 * apontar para outro projeto sem mexer no código.
 */
const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://mtmrotcstapfmtxqzwog.supabase.co'
const CHAVE_PUBLICA =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10bXJvdGNzdGFwZm10eHF6d29nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNjM4MjAsImV4cCI6MjEwNTgzOTgyMH0.XvqQSfrYX6QKsC9GfZtJX5z5dyCzJ6vymkr9sQoB8o4'

export const supabase = createClient(URL, CHAVE_PUBLICA, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
