/**
 * Operações de lead: o que entra pelo chat do site, pelo formulário e pelo
 * robô do WhatsApp cai tudo na mesma tabela, para o painel ter uma lista só.
 */
import { prepararBanco, sql, SITUACOES, temBanco } from './db.js'

/** Corta e limpa um campo de texto vindo de fora. Nada entra sem limite. */
export function texto(valor, limite = 500) {
  return String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limite)
}

/**
 * A conversa vem do navegador, então é dado de terceiro: entra com tamanho
 * limitado, campos conhecidos e nada mais. O painel a exibe como texto.
 */
export function limparConversa(bruta) {
  if (!Array.isArray(bruta)) return []
  return bruta.slice(0, 60).map((passo) => ({
    de: passo?.de === 'pessoa' ? 'pessoa' : 'robo',
    texto: texto(passo?.texto, 800),
  }))
}

export async function criarLead(dados) {
  await prepararBanco()
  const s = sql()
  const [linha] = await s`
    INSERT INTO leads ${s({
      nome: texto(dados.nome, 120),
      empresa: texto(dados.empresa, 120),
      contato: texto(dados.contato, 160),
      canal: texto(dados.canal, 30) || 'site',
      necessidade: texto(dados.necessidade, 200),
      urgencia: texto(dados.urgencia, 60),
      orcamento: texto(dados.orcamento, 60),
      resumo: texto(dados.resumo, 1500),
      conversa: JSON.stringify(limparConversa(dados.conversa)),
    })}
    RETURNING *`
  return linha
}

export async function listarLeads({ situacao = '', busca = '', limite = 200 } = {}) {
  await prepararBanco()
  const s = sql()
  const filtroSituacao = SITUACOES.includes(situacao) ? situacao : null
  const termo = texto(busca, 80)
  return s`
    SELECT * FROM leads
    WHERE (${filtroSituacao}::text IS NULL OR situacao = ${filtroSituacao})
      AND (${termo} = '' OR nome ILIKE ${'%' + termo + '%'} OR empresa ILIKE ${'%' + termo + '%'}
           OR contato ILIKE ${'%' + termo + '%'} OR resumo ILIKE ${'%' + termo + '%'})
    ORDER BY criado_em DESC
    LIMIT ${Math.min(Number(limite) || 200, 500)}`
}

export async function atualizarLead(id, campos) {
  await prepararBanco()
  const s = sql()
  const mudancas = {}
  if (campos.situacao !== undefined) {
    if (!SITUACOES.includes(campos.situacao)) throw new Error('situação desconhecida')
    mudancas.situacao = campos.situacao
  }
  if (campos.anotacoes !== undefined) mudancas.anotacoes = texto(campos.anotacoes, 4000)
  if (campos.responsavel !== undefined) mudancas.responsavel = texto(campos.responsavel, 60)
  if (campos.retorno_em !== undefined) {
    const valor = String(campos.retorno_em || '').trim()
    if (valor && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error('data inválida')
    mudancas.retorno_em = valor || null
  }
  if (campos.valor_centavos !== undefined) {
    const n = Math.round(Number(campos.valor_centavos))
    if (!Number.isFinite(n) || n < 0) throw new Error('valor inválido')
    mudancas.valor_centavos = Math.min(n, 100_000_000_00)
  }
  if (Object.keys(mudancas).length === 0) throw new Error('nada para mudar')
  mudancas.atualizado_em = new Date()
  const [linha] = await s`UPDATE leads SET ${s(mudancas)} WHERE id = ${Number(id)} RETURNING *`
  return linha || null
}

/** O histórico de um lead: o que foi conversado e quando. */
export async function listarAtividades(leadId) {
  await prepararBanco()
  const s = sql()
  return s`SELECT * FROM atividades WHERE lead_id = ${Number(leadId)} ORDER BY quando DESC LIMIT 100`
}

export async function registrarAtividade(leadId, { tipo = 'nota', texto: conteudo = '' } = {}) {
  await prepararBanco()
  const s = sql()
  const limpo = texto(conteudo, 2000)
  if (!limpo) throw new Error('nada para registrar')
  const [linha] = await s`
    INSERT INTO atividades ${s({ lead_id: Number(leadId), tipo: texto(tipo, 20) || 'nota', texto: limpo })}
    RETURNING *`
  /* Tocar no lead move ele para o topo de "mexido recentemente", que é como
     um CRM deve ordenar quando alguém está trabalhando a carteira. */
  await s`UPDATE leads SET atualizado_em = now() WHERE id = ${Number(leadId)}`
  return linha
}

export async function apagarLead(id) {
  await prepararBanco()
  const s = sql()
  const [linha] = await s`DELETE FROM leads WHERE id = ${Number(id)} RETURNING id`
  return Boolean(linha)
}

/**
 * Os números do painel. Tudo numa consulta só por assunto — são poucas
 * linhas, e é melhor o Postgres contar do que trazer a tabela inteira.
 */
export async function resumo() {
  await prepararBanco()
  const s = sql()
  const [porSituacao, porSemana, porCanal, totais] = await Promise.all([
    s`SELECT situacao, count(*)::int AS quantos, sum(valor_centavos)::bigint AS valor
        FROM leads GROUP BY situacao`,
    s`SELECT to_char(date_trunc('week', criado_em), 'YYYY-MM-DD') AS semana, count(*)::int AS quantos
        FROM leads WHERE criado_em > now() - interval '12 weeks'
        GROUP BY 1 ORDER BY 1`,
    s`SELECT canal, count(*)::int AS quantos FROM leads GROUP BY canal ORDER BY quantos DESC`,
    s`SELECT count(*)::int AS total,
             count(*) FILTER (WHERE criado_em > now() - interval '7 days')::int AS semana,
             count(*) FILTER (WHERE situacao = 'fechado')::int AS fechados,
             coalesce(sum(valor_centavos) FILTER (WHERE situacao = 'fechado'), 0)::bigint AS receita
        FROM leads`,
  ])
  const [atrasados] = await s`
    SELECT count(*)::int AS quantos FROM leads
    WHERE retorno_em IS NOT NULL AND retorno_em <= current_date
      AND situacao NOT IN ('fechado', 'perdido')`
  const t = totais[0] || { total: 0, semana: 0, fechados: 0, receita: 0 }
  return {
    total: t.total,
    semana: t.semana,
    /* Retornos vencidos. É o número que faz alguém abrir o painel de manhã. */
    atrasados: atrasados?.quantos || 0,
    fechados: t.fechados,
    receitaCentavos: Number(t.receita),
    /* Conversão sobre o que já saiu do funil: contar quem entrou ontem como
       "ainda não fechou" faria o número parecer pior do que é. */
    conversao: (() => {
      const mapa = Object.fromEntries(porSituacao.map((l) => [l.situacao, l.quantos]))
      const decididos = (mapa.fechado || 0) + (mapa.perdido || 0)
      return decididos ? Math.round(((mapa.fechado || 0) / decididos) * 100) : null
    })(),
    porSituacao: porSituacao.map((l) => ({ situacao: l.situacao, quantos: l.quantos, valorCentavos: Number(l.valor) })),
    porSemana,
    porCanal,
  }
}

/**
 * Avisa a equipe de um lead novo pelo WhatsApp, se a Cloud API estiver
 * configurada (as mesmas variáveis do robô) e houver um destino em
 * `EQUIPE_WHATSAPP`. Falhar aqui não pode derrubar o lead: ele já está salvo.
 */
export async function avisarEquipe(lead) {
  const destino = process.env.EQUIPE_WHATSAPP
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!destino || !token || !phoneId) return false
  const corpo = [
    '🚀 *Lead novo no site*',
    '',
    `*Nome:* ${lead.nome || '—'}`,
    `*Empresa:* ${lead.empresa || '—'}`,
    `*Contato:* ${lead.contato || '—'}`,
    `*Precisa de:* ${lead.necessidade || '—'}`,
    `*Quando:* ${lead.urgencia || '—'}`,
    `*Investimento:* ${lead.orcamento || '—'}`,
    '',
    lead.resumo || '',
  ].join('\n')
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: destino,
        type: 'text',
        text: { body: corpo.slice(0, 4000) },
      }),
    })
    if (!r.ok) console.error('aviso de lead recusado:', r.status, await r.text())
    return r.ok
  } catch (erro) {
    console.error('aviso de lead falhou:', erro?.message)
    return false
  }
}

export { temBanco, SITUACOES }
