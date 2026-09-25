import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { criarCalcom } from '../../../lib/calcom.ts'
import { criarEvolution } from '../../../lib/evolution.ts'
import { criarFaq } from '../../../lib/bot/faq.ts'
import { ErroHttp } from './http.ts'

/**
 * Tudo o que vem do ambiente da Vercel, num lugar só.
 *
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  o banco, pelo servidor (nunca no cliente)
 *   EVOLUTION_API_URL, EVOLUTION_API_KEY     a Evolution API (WhatsApp por QR)
 *   CAL_API_KEY                              agenda no Cal.com
 *   GROQ_API_KEY                             perguntas livres (opcional)
 *   CRON_SECRET                              protege o lembrete anti-faltas
 *   CRM_WEBHOOK_TOKEN                        protege o webhook da Evolution (cai no CRON_SECRET)
 *   PUBLIC_URL                               endereço público do site, para o webhook
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID     aviso à recepção (opcional)
 */
const env = process.env

export const SUPABASE_URL_PADRAO = 'https://mtmrotcstapfmtxqzwog.supabase.co'

let admin: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  const url = env.SUPABASE_URL || SUPABASE_URL_PADRAO
  const chave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!chave) throw new ErroHttp(503, 'CRM sem banco: cadastre SUPABASE_SERVICE_ROLE_KEY na Vercel')
  if (!admin) admin = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })
  return admin
}

export function evolution() {
  return criarEvolution(env)
}

export function agenda() {
  return env.CAL_API_KEY ? criarCalcom(env.CAL_API_KEY) : null
}

export function faq() {
  return criarFaq(env)
}

export function urlPublica() {
  const base = env.PUBLIC_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://astrosolucoes.vercel.app')
  return base.replace(/\/+$/, '')
}

export function tokenDoWebhook() {
  return env.CRM_WEBHOOK_TOKEN || env.CRON_SECRET || ''
}

export function segredoDoCron() {
  return env.CRON_SECRET || ''
}

/** Aviso opcional à recepção por Telegram. Falhar nunca pode travar o bot. */
export async function avisarTelegram(texto: string) {
  const token = env.TELEGRAM_BOT_TOKEN
  const chat = env.TELEGRAM_CHAT_ID
  if (!token || !chat) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: texto.slice(0, 3000) }),
      signal: AbortSignal.timeout(6000),
    })
  } catch (erro) {
    console.error('aviso ao Telegram falhou:', (erro as Error)?.message)
  }
}

export function configuracao() {
  return {
    supabase: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    evolution: Boolean(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY),
    calcom: Boolean(env.CAL_API_KEY),
    groq: Boolean(env.GROQ_API_KEY),
    cron: Boolean(env.CRON_SECRET),
    telegram: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
  }
}
