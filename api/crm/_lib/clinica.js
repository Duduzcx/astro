
import { CHAVES_TEXTO } from './bot/textos.js'
import { numeroOuNulo, textoCurto, textoLongo } from './http.js'

/** A linha de config_clinica como está no banco. */

const URGENCIA_PADRAO = ['dor', 'inchaço', 'trauma', 'quebrou', 'sangue', 'urgente', 'emergência']
const TONS             = ['formal', 'acolhedor', 'descontraido']
const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

/** Normaliza o que veio do banco: nulo vira o valor que o motor espera. */
export function paraClinica(linha                         )               {
  return {
    ...(linha                           ),
    timezone: String(linha.timezone || 'America/Sao_Paulo'),
    horario_funcionamento: (linha.horario_funcionamento && typeof linha.horario_funcionamento === 'object' ? linha.horario_funcionamento : {})                        ,
    tom_voz: TONS.includes(linha.tom_voz            ) ? (linha.tom_voz            ) : 'acolhedor',
    palavras_urgencia: Array.isArray(linha.palavras_urgencia) && linha.palavras_urgencia.length ? (linha.palavras_urgencia            ) : URGENCIA_PADRAO,
    valor_avaliacao: numeroOuNulo(linha.valor_avaliacao),
    mensagens: (linha.mensagens && typeof linha.mensagens === 'object' ? linha.mensagens : {})                          ,
    whatsapp_status: (['desconectado', 'aguardando_qr', 'conectado'].includes(String(linha.whatsapp_status)) ? linha.whatsapp_status : 'desconectado')                                   ,
  }
}

/** Só as colunas que o painel pode escrever, cada uma limpa. */
export function camposEditaveis(bruto                         , criando = false) {
  const saida                          = {}
  const tem = (chave        ) => Object.prototype.hasOwnProperty.call(bruto, chave)

  if (tem('nome') || criando) saida.nome = textoCurto(bruto.nome, 120)
  for (const chave of ['dentista_nome', 'endereco', 'link_maps', 'telefone_recepcao', 'timezone']         ) {
    if (tem(chave)) saida[chave] = textoCurto(bruto[chave], chave === 'link_maps' ? 500 : 200) || null
  }
  if (tem('recomendacoes')) saida.recomendacoes = textoLongo(bruto.recomendacoes, 1500) || null
  for (const chave of ['event_type_avaliacao', 'event_type_limpeza']         ) {
    if (tem(chave)) saida[chave] = numeroOuNulo(bruto[chave])
  }
  if (tem('valor_avaliacao')) saida.valor_avaliacao = numeroOuNulo(bruto.valor_avaliacao)
  if (tem('tom_voz') && TONS.includes(bruto.tom_voz            )) saida.tom_voz = bruto.tom_voz
  if (tem('palavras_urgencia')) {
    const lista = Array.isArray(bruto.palavras_urgencia) ? bruto.palavras_urgencia : String(bruto.palavras_urgencia || '').split(',')
    saida.palavras_urgencia = lista.map((p) => textoCurto(p, 40).toLowerCase()).filter(Boolean).slice(0, 40)
  }
  if (tem('horario_funcionamento') && bruto.horario_funcionamento && typeof bruto.horario_funcionamento === 'object') {
    const horario                       = {}
    for (const dia of DIAS) {
      const intervalos = (bruto.horario_funcionamento                           )[dia]
      if (!Array.isArray(intervalos)) continue
      const limpos = intervalos
        .map((par) => (Array.isArray(par) ? [textoCurto(par[0], 5), textoCurto(par[1], 5)] : null))
        .filter((par)                          => par !== null && /^\d{2}:\d{2}$/.test(par[0]) && /^\d{2}:\d{2}$/.test(par[1]) && par[0] < par[1])
      if (limpos.length) horario[dia] = limpos
    }
    saida.horario_funcionamento = horario
  }
  if (tem('mensagens') && bruto.mensagens && typeof bruto.mensagens === 'object') {
    const mensagens                         = {}
    for (const chave of CHAVES_TEXTO) {
      const valor = textoLongo((bruto.mensagens                           )[chave], 1500)
      if (valor) mensagens[chave] = valor
    }
    saida.mensagens = mensagens
  }
  if (!saida.timezone && criando) saida.timezone = 'America/Sao_Paulo'
  return saida
}

/** O que vai para o navegador: sem id do número da Cloud API, que não é deste módulo. */
export function publica(clinica              ) {
  const { whatsapp_phone_number_id: _ignorado, ...resto } = clinica
  return resto
}
