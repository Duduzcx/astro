

/** Tira acento, caixa e espaço sobrando: "Avaliação" e "avaliacao" viram iguais. */
export function simplificar(texto        ) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function somenteDigitos(texto        ) {
  return texto.replace(/\D/g, '')
}

/**
 * Qual opção a pessoa escolheu. Aceita o número ("2", "opção 2", "2)"), o
 * texto da opção inteiro ou o começo dele ("limpeza" para "Limpeza 60min").
 * Devolve o índice, ou -1.
 */
export function escolher(entrada        , opcoes          )         {
  const t = simplificar(entrada)
  const numero = t.match(/^(?:opcao\s*)?(\d{1,2})\b/)
  if (numero) {
    const i = Number(numero[1]) - 1
    return i >= 0 && i < opcoes.length ? i : -1
  }
  const normalizadas = opcoes.map((o) => simplificar(o.replace(/\s*\d+\s*min$/i, '')))
  const exata = normalizadas.findIndex((o) => o === t)
  if (exata >= 0) return exata
  const contida = normalizadas.findIndex((o) => t.length >= 3 && (o.includes(t) || t.includes(o)))
  if (contida >= 0) return contida
  /* Uma palavra distintiva basta: "manutencao" para "Retorno/Manutenção". */
  const palavras = t.split(' ').filter((p) => p.length >= 4)
  return normalizadas.findIndex((o) => palavras.some((p) => o.split(/[\s/]+/).some((w) => w.startsWith(p) || p.startsWith(w))))
}

/** Nome e sobrenome, só letras: "vocês aceitam convênio?" não é nome. */
export function nomeValido(texto        ) {
  if (/[?\d]/.test(texto)) return false
  const partes = texto.trim().split(/\s+/)
  return partes.length >= 2 && partes.length <= 8 && partes.every((p) => /^[\p{L}'.-]+$/u.test(p))
}

export function cpfValido(texto        ) {
  return somenteDigitos(texto).length === 11
}

/** ***.***.***-12 — o que o painel mostra. */
export function mascararCpf(cpf                           ) {
  const d = somenteDigitos(cpf || '')
  return d.length === 11 ? `***.***.***-${d.slice(-2)}` : d ? '***' : ''
}

export function ehUrgente(texto        , palavras          ) {
  const t = simplificar(texto)
  return palavras.some((p) => p && t.includes(simplificar(p)))
}

const INTERROGATIVAS = /^(quanto|qual|quais|onde|como|quando|voces|vcs|tem|aceita|aceitam|atende|atendem|fazem|faz|posso|pode|precisa|preciso|existe|funciona|e verdade|sera)\b/

/** Texto livre que parece pergunta, e não resposta ao que o bot pediu. */
export function pareceUmaPergunta(texto        ) {
  const t = simplificar(texto)
  return t.includes('?') || INTERROGATIVAS.test(t)
}

const DIAS                                             = {
  Mon: 'seg',
  Tue: 'ter',
  Wed: 'qua',
  Thu: 'qui',
  Fri: 'sex',
  Sat: 'sab',
  Sun: 'dom',
}

/** Partes de uma data no fuso da clínica. */
export function partesNoFuso(data      , timezone        ) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(data)
  const pegar = (tipo        ) => partes.find((p) => p.type === tipo)?.value || ''
  const hora = pegar('hour') === '24' ? '00' : pegar('hour')
  return { dia: DIAS[pegar('weekday')] || 'seg', horario: `${hora}:${pegar('minute')}` }
}

/** A clínica está aberta agora? Sem horário cadastrado, considera aberta. */
export function dentroDoHorario(horario                                         , agora      , timezone        ) {
  if (!horario || Object.keys(horario).length === 0) return true
  const { dia, horario: hm } = partesNoFuso(agora, timezone)
  const intervalos = horario[dia] || []
  return intervalos.some(([de, ate]) => hm >= de && hm < ate)
}

/** "25/09/2026 - 14:30" no fuso da clínica. */
export function formatarDataHora(iso        , timezone        ) {
  const d = new Date(iso)
  const data = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${data} - ${hora}`
}

/** "quinta-feira, 25/09 às 14:30", para mensagens. */
export function formatarVagaAmigavel(iso        , timezone        ) {
  const d = new Date(iso)
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, weekday: 'long', day: '2-digit', month: '2-digit' }).format(d)
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${dia} às ${hora}`
}

export function somarMinutos(iso        , minutos        ) {
  return new Date(new Date(iso).getTime() + minutos * 60_000).toISOString()
}

/** Preenche {chaves} num texto. Chave sem valor vira vazio, não "undefined". */
export function preencher(modelo        , valores                                                    ) {
  return modelo.replace(/\{(\w+)\}/g, (_, chave        ) => {
    const v = valores[chave]
    return v === null || v === undefined ? '' : String(v)
  })
}
