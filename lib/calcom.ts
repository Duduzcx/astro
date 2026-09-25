import type { Agenda, Vaga } from './bot/tipos.ts'

/**
 * Cal.com API v2. Três chamadas: vagas, criar e cancelar. Cada uma pede o seu
 * próprio cabeçalho de versão — a API é versionada por rota.
 */
const BASE = 'https://api.cal.com/v2'

/**
 * A resposta de /slots vem agrupada por dia: { "2026-09-25": [{ start }] }.
 * Achatar e ordenar deixa a lista em ordem cronológica a partir de agora, o
 * que faz as vagas desta semana aparecerem antes das da próxima sem regra
 * nenhuma a mais.
 */
export function achatarVagas(dados: unknown): Vaga[] {
  const porDia = (dados && typeof dados === 'object' ? (dados as Record<string, unknown>) : {}) as Record<string, unknown>
  const vagas: Vaga[] = []
  for (const lista of Object.values(porDia)) {
    if (!Array.isArray(lista)) continue
    for (const item of lista) {
      const inicio = typeof item === 'string' ? item : (item as { start?: string; time?: string })?.start || (item as { time?: string })?.time
      if (inicio && !Number.isNaN(Date.parse(inicio))) vagas.push({ inicio: new Date(inicio).toISOString() })
    }
  }
  return vagas.sort((a, b) => a.inicio.localeCompare(b.inicio))
}

export function criarCalcom(apiKey: string): Agenda {
  const cabecalhos = (versao: string) => ({
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'cal-api-version': versao,
  })

  return {
    async vagas(eventTypeId, inicio, fim, timezone) {
      const url = new URL(`${BASE}/slots`)
      url.searchParams.set('eventTypeId', String(eventTypeId))
      url.searchParams.set('start', inicio.toISOString())
      url.searchParams.set('end', fim.toISOString())
      url.searchParams.set('timeZone', timezone)
      const r = await fetch(url, { headers: cabecalhos('2024-09-04'), signal: AbortSignal.timeout(12000) })
      if (!r.ok) throw new Error(`cal.com slots ${r.status}`)
      const corpo = (await r.json()) as { data?: unknown }
      const agora = inicio.getTime()
      return achatarVagas(corpo.data).filter((v) => Date.parse(v.inicio) > agora)
    },

    async criar({ eventTypeId, inicio, nome, email, timezone }) {
      const r = await fetch(`${BASE}/bookings`, {
        method: 'POST',
        headers: cabecalhos('2024-08-13'),
        body: JSON.stringify({
          start: inicio,
          eventTypeId,
          attendee: { name: nome, email, timeZone: timezone, language: 'pt' },
        }),
        signal: AbortSignal.timeout(12000),
      })
      if (!r.ok) throw new Error(`cal.com booking ${r.status}: ${(await r.text()).slice(0, 200)}`)
      const corpo = (await r.json()) as { data?: { uid?: string } }
      if (!corpo.data?.uid) throw new Error('cal.com booking sem uid')
      return { uid: corpo.data.uid }
    },

    async cancelar(uid, motivo) {
      const r = await fetch(`${BASE}/bookings/${encodeURIComponent(uid)}/cancel`, {
        method: 'POST',
        headers: cabecalhos('2024-08-13'),
        body: JSON.stringify({ cancellationReason: motivo }),
        signal: AbortSignal.timeout(12000),
      })
      if (!r.ok) throw new Error(`cal.com cancel ${r.status}`)
    },
  }
}
