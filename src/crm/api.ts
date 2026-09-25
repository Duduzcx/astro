import { supabase } from './supabase'

/** Chama /api/crm/… com a sessão do Supabase no cabeçalho. */
export async function pedir<T = Record<string, unknown>>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const resposta = await fetch(`/api/crm/${caminho.replace(/^\//, '')}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opcoes.headers || {}),
    },
  })
  const corpo = (await resposta.json().catch(() => ({}))) as T & { erro?: string }
  if (!resposta.ok) throw new Error(corpo?.erro || `falha ${resposta.status}`)
  return corpo
}

export const enviar = <T = Record<string, unknown>>(caminho: string, dados: unknown, metodo = 'POST') =>
  pedir<T>(caminho, { method: metodo, body: JSON.stringify(dados) })

export const apagar = <T = Record<string, unknown>>(caminho: string) => pedir<T>(caminho, { method: 'DELETE' })

export type Progresso = {
  clinica: boolean
  dentistas: boolean
  procedimentos: boolean
  horarios: boolean
  conhecimento: boolean
  simulador: boolean
  whatsapp: boolean
}

export type Clinica = {
  id: string
  nome: string
  dentista_nome: string | null
  endereco: string | null
  link_maps: string | null
  recomendacoes: string | null
  telefone_recepcao: string | null
  timezone: string
  event_type_avaliacao: number | null
  event_type_limpeza: number | null
  horario_funcionamento: Record<string, [string, string][]>
  tom_voz: 'formal' | 'acolhedor' | 'descontraido'
  palavras_urgencia: string[]
  valor_avaliacao: number | null
  mensagens: Record<string, string>
  evolution_instance: string | null
  whatsapp_numero: string | null
  whatsapp_status: 'desconectado' | 'aguardando_qr' | 'conectado'
  simulador_testado_em: string | null
}

export type Eu = {
  usuario: { id: string; email: string }
  papel: 'admin' | 'recepcao' | null
  clinica: Clinica | null
  progresso: Progresso
  servicos: { supabase: boolean; evolution: boolean; calcom: boolean; groq: boolean; cron: boolean; telegram: boolean }
}

export const quando = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

export const quandoCompleto = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export const telefoneBonito = (t: string) => (t.startsWith('sim_') ? 'simulador' : t.replace(/^\+55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3'))
