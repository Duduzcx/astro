import { supabaseAdmin } from './ambiente.ts'
import { paraClinica, type LinhaClinica } from './clinica.ts'
import { ErroHttp, type Req } from './http.ts'

export type Sessao = {
  usuario: { id: string; email: string }
  clinica: LinhaClinica | null
  papel: 'admin' | 'recepcao' | null
}

/**
 * Quem está chamando: o JWT do Supabase Auth no cabeçalho Authorization,
 * conferido pelo próprio Supabase, e a clínica ligada a esse usuário em
 * usuarios_clinica. Toda consulta do painel parte daqui: nada é lido ou
 * escrito sem `clinica.id` no filtro.
 */
export async function sessaoDaRequisicao(req: Req): Promise<Sessao> {
  const cabecalho = String(req.headers.authorization || '')
  const token = cabecalho.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new ErroHttp(401, 'entre para continuar')
  const admin = supabaseAdmin()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new ErroHttp(401, 'sessão inválida ou vencida')
  const { data: ligacao } = await admin.from('usuarios_clinica').select('clinica_id, papel').eq('user_id', data.user.id).maybeSingle()
  let clinica: LinhaClinica | null = null
  if (ligacao?.clinica_id) {
    const { data: linha } = await admin.from('config_clinica').select('*').eq('id', ligacao.clinica_id).maybeSingle()
    if (linha) clinica = paraClinica(linha as Record<string, unknown>)
  }
  return {
    usuario: { id: data.user.id, email: data.user.email || '' },
    clinica,
    papel: (ligacao?.papel as Sessao['papel']) ?? null,
  }
}

export function exigirClinica(sessao: Sessao): LinhaClinica {
  if (!sessao.clinica) throw new ErroHttp(409, 'cadastre a clínica primeiro')
  return sessao.clinica
}

export async function clinicaPorInstancia(instancia: string): Promise<LinhaClinica | null> {
  const { data } = await supabaseAdmin().from('config_clinica').select('*').eq('evolution_instance', instancia).maybeSingle()
  return data ? paraClinica(data as Record<string, unknown>) : null
}

export async function clinicaPorId(id: string): Promise<LinhaClinica | null> {
  const { data } = await supabaseAdmin().from('config_clinica').select('*').eq('id', id).maybeSingle()
  return data ? paraClinica(data as Record<string, unknown>) : null
}
