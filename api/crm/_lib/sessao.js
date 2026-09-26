import { supabaseAdmin } from './ambiente.js'
import { paraClinica,                   } from './clinica.js'
import { ErroHttp,          } from './http.js'

/**
 * Quem está chamando: o JWT do Supabase Auth no cabeçalho Authorization,
 * conferido pelo próprio Supabase, e a clínica ligada a esse usuário em
 * usuarios_clinica. Toda consulta do painel parte daqui: nada é lido ou
 * escrito sem `clinica.id` no filtro.
 */
export async function sessaoDaRequisicao(req     )                  {
  const cabecalho = String(req.headers.authorization || '')
  const token = cabecalho.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new ErroHttp(401, 'entre para continuar')
  const admin = supabaseAdmin()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new ErroHttp(401, 'sessão inválida ou vencida')
  const { data: ligacao } = await admin.from('usuarios_clinica').select('clinica_id, papel').eq('user_id', data.user.id).maybeSingle()
  let clinica                      = null
  if (ligacao?.clinica_id) {
    const { data: linha } = await admin.from('config_clinica').select('*').eq('id', ligacao.clinica_id).maybeSingle()
    if (linha) clinica = paraClinica(linha                           )
  }
  return {
    usuario: { id: data.user.id, email: data.user.email || '' },
    clinica,
    papel: (ligacao?.papel                   ) ?? null,
  }
}

export function exigirClinica(sessao        )               {
  if (!sessao.clinica) throw new ErroHttp(409, 'cadastre a clínica primeiro')
  return sessao.clinica
}

export async function clinicaPorInstancia(instancia        )                               {
  const { data } = await supabaseAdmin().from('config_clinica').select('*').eq('evolution_instance', instancia).maybeSingle()
  return data ? paraClinica(data                           ) : null
}

export async function clinicaPorId(id        )                               {
  const { data } = await supabaseAdmin().from('config_clinica').select('*').eq('id', id).maybeSingle()
  return data ? paraClinica(data                           ) : null
}
