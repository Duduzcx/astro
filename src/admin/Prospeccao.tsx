import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A aba de prospecção do painel: o número pessoal conectado por QR code, a
 * instrução mestre e as conversas do aparelho, para escolher quais o robô
 * assume. O que acontece do outro lado está em api/_lib/prospeccao.js e em
 * docs/prospeccao-whatsapp.md.
 */
type Conversa = {
  oculta?: boolean
  jid: string
  telefone: string
  nome: string
  ultima: { de: string; texto: string } | null
  quando: string | null
  lead: { id: number; prospeccao: string; situacao: string } | null
}

type Dados = {
  estado: {
    configurado: boolean
    estado: 'conectado' | 'aguardando_qr' | 'desconectado'
    numero: string | null
    instancia: string
  }
  instrucao: string
  instrucaoPadrao: string
  gatilho: string
  gatilhoPadrao: string
  modo: 'responder' | 'ativo'
  quarentenaAte: string | null
  abordagens?: { usadas: number; limite: number }
  segmento: 'imobiliaria' | 'cursinho' | 'odonto'
  conversas: Conversa[]
  ponte: { url: string; instancia: string; quando: string } | null
  inteligencia: boolean
  banco: boolean
}

type Resultado = { jid: string; lead?: number; enviado?: boolean; erro?: string }

async function pedir(caminho: string, opcoes: RequestInit = {}) {
  /* Vinte e cinco segundos e desiste, com aviso: um banco travado deixava o
     painel em "Atualizando…" para sempre, sem dizer nada. */
  const resposta = await fetch(caminho, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
    signal: AbortSignal.timeout(25000),
  }).catch((falha) => {
    throw new Error(falha?.name === 'TimeoutError' ? 'o servidor não respondeu em 25 s (banco travado?)' : 'sem conexão com o servidor')
  })
  const corpo = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(corpo?.erro || `falha ${resposta.status}`)
  return corpo
}

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

const mensagemDe = (falha: unknown) => (falha instanceof Error ? falha.message : 'falhou')

export function AbaProspeccao() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [escolhidas, setEscolhidas] = useState<Set<string>>(() => new Set())
  const [numeroNovo, setNumeroNovo] = useState('')
  const [mostrarOcultas, setMostrarOcultas] = useState(false)

  async function assumirNumero() {
    /* Vários números de uma vez (um por linha), um pedido por número com
       pausa entre eles. Erro em um número não para a lista: vira uma linha
       de resultado e o laço segue. "Aguarde" (intervalo mínimo do site)
       espera e tenta de novo uma vez. */
    const numeros = Array.from(
      new Set(
        numeroNovo
          .split(/[\n,;]+/)
          .map((n) => n.replace(/\D/g, ''))
          .filter((n) => n.length >= 10),
      ),
    ).slice(0, 10)
    if (numeros.length === 0) {
      setAviso('Digite o número com DDD (ex.: 11984680317), um por linha.')
      return
    }
    setOcupado(true)
    setAviso('')
    const todos: Resultado[] = []
    const espera = (ms: number) => new Promise((fim) => setTimeout(fim, ms))
    const abordar = async (numero: string) => {
      const r = await pedir('/api/admin/prospeccao', { method: 'POST', body: JSON.stringify({ numero }) })
      return (r.resultados || []) as Resultado[]
    }
    try {
      for (let i = 0; i < numeros.length; i += 1) {
        setAviso(`Abordando ${i + 1} de ${numeros.length}…`)
        try {
          todos.push(...(await abordar(numeros[i])))
        } catch (falha) {
          const motivo = mensagemDe(falha)
          if (/aguarde/i.test(motivo)) {
            setAviso(`Intervalo mínimo: esperando para abordar ${i + 1} de ${numeros.length}…`)
            await espera(65000)
            try {
              todos.push(...(await abordar(numeros[i])))
            } catch (denovo) {
              todos.push({ jid: `${numeros[i]}@s.whatsapp.net`, erro: mensagemDe(denovo) } as Resultado)
            }
          } else {
            todos.push({ jid: `${numeros[i]}@s.whatsapp.net`, erro: motivo } as Resultado)
          }
        }
        setResultados([...todos])
        if (i < numeros.length - 1) await espera(63000 + Math.random() * 15000)
      }
      const falhas = todos.filter((x) => x.erro).length
      setAviso(falhas ? `${falhas} de ${todos.length} não foram abordados; os motivos estão abaixo.` : `${todos.length} abordados.`)
      if (!falhas) setNumeroNovo('')
      await carregar()
    } finally {
      setOcupado(false)
    }
  }
  const [instrucao, setInstrucao] = useState('')
  const [gatilho, setGatilho] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [lidoEm, setLidoEm] = useState('')
  /* A conversa aberta para leitura, com as mensagens que a ponte devolve. */
  const [lendo, setLendo] = useState<{ conversa: Conversa; falas: { de: string; texto: string }[] | null } | null>(null)

  async function abrirConversa(conversa: Conversa) {
    setLendo({ conversa, falas: null })
    try {
      const r = await pedir(`/api/admin/prospeccao?conversa=${encodeURIComponent(conversa.jid)}`)
      setLendo({ conversa, falas: r.mensagens || [] })
    } catch {
      setLendo({ conversa, falas: [] })
    }
  }

  const carregar = useCallback(async () => {
    try {
      const r: Dados = await pedir('/api/admin/prospeccao')
      setDados(r)
      setInstrucao((atual) => atual || r.instrucao)
      setGatilho((atual) => atual || r.gatilho)
      setLidoEm(new Date().toLocaleTimeString('pt-BR'))
      setAviso('')
    } catch (falha) {
      setAviso(mensagemDe(falha))
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /* Conectado, relê a cada quinze segundos: as conversas do aparelho podem
     chegar depois de abrir a tela (o histórico do WhatsApp vem em pacotes), e
     o endereço do túnel muda a cada reinício da ponte — sem isto a lista
     ficava em zero até alguém clicar em Atualizar. Não relê com o QR na
     tela (aquele efeito já cuida) nem no meio de uma ação. */
  useEffect(() => {
    if (dados?.estado.estado !== 'conectado' || qr) return
    const id = window.setInterval(() => {
      if (!ocupado) void carregar()
    }, 15000)
    return () => window.clearInterval(id)
  }, [dados?.estado.estado, qr, ocupado, carregar])

  /* A ponte está esperando um QR (o número saiu, ou nunca entrou): busca e
     mostra sem pedir clique. Pela referência, para o efeito não depender da
     função que muda a cada render. */
  const conectarRef = useRef<() => Promise<void>>(async () => undefined)
  useEffect(() => {
    if (dados?.estado.estado === 'aguardando_qr' && !qr && !ocupado) void conectarRef.current()
  }, [dados?.estado.estado, qr, ocupado])

  /* Com o QR na tela, a cada cinco segundos pede o QR de novo: o WhatsApp
     troca o código a cada vinte segundos e um QR velho não lê. A mesma
     resposta diz quando o celular entrou. */
  useEffect(() => {
    if (!qr) return
    const id = window.setInterval(async () => {
      try {
        const r = await pedir('/api/admin/prospeccao?qr=1')
        if (r.estado === 'conectado') {
          setQr(null)
          await carregar()
        } else if (r.qr) {
          setQr((atual) => (atual === r.qr ? atual : r.qr))
        }
      } catch {
        /* Tenta de novo no próximo tique. */
      }
    }, 5000)
    return () => window.clearInterval(id)
  }, [qr, carregar])

  async function conectar() {
    setOcupado(true)
    setAviso('')
    try {
      /* O QR pode demorar uns segundos para nascer na ponte: insiste até
         seis vezes antes de desistir, senão o clique parece não fazer nada. */
      let r = await pedir('/api/admin/prospeccao?qr=1')
      for (let tentativa = 0; !r.qr && r.estado !== 'conectado' && tentativa < 3; tentativa += 1) {
        await new Promise((resolver) => setTimeout(resolver, 2000))
        r = await pedir('/api/admin/prospeccao?qr=1')
      }
      if (r.qr) setQr(r.qr)
      else if (r.estado === 'conectado') await carregar()
      else setAviso('A ponte não gerou o QR. Ela está rodando? Veja o terminal dela.')
    } catch (falha) {
      setAviso(mensagemDe(falha))
    } finally {
      setOcupado(false)
    }
  }

  conectarRef.current = conectar

  async function desconectar() {
    setOcupado(true)
    try {
      await pedir('/api/admin/prospeccao?desconectar=1')
      setQr(null)
      await carregar()
    } catch (falha) {
      setAviso(mensagemDe(falha))
    } finally {
      setOcupado(false)
    }
  }

  async function assumir() {
    const jids = [...escolhidas]
    if (jids.length === 0) return
    setOcupado(true)
    setAviso('')
    try {
      const r = await pedir('/api/admin/prospeccao', { method: 'POST', body: JSON.stringify({ jids }) })
      setResultados(r.resultados)
      setEscolhidas(new Set())
      /* Se todas falharam, joga o motivo da primeira no aviso do topo, para
         não passar despercebido na lista lá embaixo. */
      const falhas = (r.resultados || []).filter((x: Resultado) => x.erro)
      if (falhas.length && falhas.length === r.resultados.length) setAviso(falhas[0].erro || 'falhou')
      await carregar()
    } catch (falha) {
      setAviso(mensagemDe(falha))
    } finally {
      setOcupado(false)
    }
  }

  async function mudar(lead: number, prospeccao: string) {
    try {
      await pedir('/api/admin/prospeccao', { method: 'PATCH', body: JSON.stringify({ lead, prospeccao }) })
      await carregar()
    } catch (falha) {
      setAviso(mensagemDe(falha))
    }
  }

  async function salvarSegmento(segmento: 'imobiliaria' | 'cursinho' | 'odonto') {
    try {
      await pedir('/api/admin/prospeccao', { method: 'PUT', body: JSON.stringify({ segmento }) })
      setAviso('Segmento salvo. Vale para os leads que nascerem daqui em diante.')
      await carregar()
    } catch (falha) {
      setAviso(mensagemDe(falha))
    }
  }

  async function quarentena(horas: number) {
    try {
      await pedir('/api/admin/prospeccao', { method: 'PUT', body: JSON.stringify({ quarentena: horas }) })
      setAviso(horas > 0 ? 'Quarentena ligada: nada proativo por 3 dias, modo "só responde".' : 'Quarentena encerrada.')
      await carregar()
    } catch (falha) {
      setAviso(mensagemDe(falha))
    }
  }

  async function atualizarComCelular() {
    setOcupado(true)
    setAviso('Pedindo ao celular a lista de conversas…')
    try {
      const r: Dados = await pedir('/api/admin/prospeccao?sincronizar=1')
      setDados(r)
      setLidoEm(new Date().toLocaleTimeString('pt-BR'))
      setAviso('')
    } catch (falha) {
      setAviso(mensagemDe(falha))
    } finally {
      setOcupado(false)
    }
  }

  async function salvarModo(modo: 'responder' | 'ativo') {
    try {
      await pedir('/api/admin/prospeccao', { method: 'PUT', body: JSON.stringify({ modo }) })
      setAviso(modo === 'ativo' ? 'Modo ativo ligado. Abordagem a frio limitada a 10 por dia; o risco de restrição é seu.' : 'Modo "só responde" ligado.')
      await carregar()
    } catch (falha) {
      setAviso(mensagemDe(falha))
    }
  }

  async function salvarGatilho(texto: string) {
    try {
      const r = await pedir('/api/admin/prospeccao', { method: 'PUT', body: JSON.stringify({ gatilho: texto }) })
      setGatilho(r.gatilho)
      setAviso('Frases gatilho salvas.')
    } catch (falha) {
      setAviso(mensagemDe(falha))
    }
  }

  async function salvarInstrucao(texto: string) {
    try {
      const r = await pedir('/api/admin/prospeccao', { method: 'PUT', body: JSON.stringify({ instrucao: texto }) })
      setInstrucao(r.instrucao)
      setAviso('Instrução salva.')
    } catch (falha) {
      setAviso(mensagemDe(falha))
    }
  }

  if (!dados) return <p className="text-[14px] text-slate">{aviso || 'Carregando…'}</p>

  const conectado = dados.estado.estado === 'conectado'
  const nomeDe = (conversa: Conversa) => conversa.nome || conversa.telefone
  const visiveis = dados ? dados.conversas.filter((c) => mostrarOcultas || !c.oculta) : []
  const totalOcultas = dados ? dados.conversas.filter((c) => c.oculta).length : 0

  async function ocultarConversa(conversa: Conversa, sim: boolean) {
    try {
      await pedir('/api/admin/prospeccao', { method: 'PATCH', body: JSON.stringify(sim ? { ocultar: conversa.telefone } : { mostrar: conversa.telefone }) })
      setEscolhidas((atual) => {
        const prox = new Set(atual)
        prox.delete(conversa.jid)
        return prox
      })
      await carregar()
    } catch (falha) {
      setAviso(mensagemDe(falha))
    }
  }
  const alternar = (jid: string) =>
    setEscolhidas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(jid)) proximo.delete(jid)
      else proximo.add(jid)
      return proximo
    })

  return (
    <div className="flex flex-col gap-4">
      {!dados.estado.configurado ? (
        <p className="rounded-xl border border-[#ffd479]/30 bg-[#ffd479]/5 px-4 py-3 text-[13px] text-[#ffd479]">
          A ponte ainda não avisou onde está. No seu PC: entre em ponte-whatsapp, rode npm install, copie
          .env.exemplo para .env com a mesma chave cadastrada na Vercel como EVOLUTION_API_KEY, e rode npm start.
          Ela abre o túnel e se registra aqui sozinha (docs/prospeccao-whatsapp.md).
        </p>
      ) : null}
      {!dados.inteligencia || !dados.banco ? (
        <p className="rounded-xl border border-[#ffd479]/30 bg-[#ffd479]/5 px-4 py-3 text-[13px] text-[#ffd479]">
          {!dados.banco ? 'Sem banco (POSTGRES_URL) não há onde guardar as conversas assumidas. ' : ''}
          {!dados.inteligencia ? 'Sem ANTHROPIC_API_KEY ou OPENAI_API_KEY o robô não tem com que escrever.' : ''}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="graphite-card">
          <p className="label-voice text-[10px]">Número pessoal</p>
          <p className={`mt-2 flex items-center gap-2 text-[15px] ${conectado ? 'text-[#86e8a8]' : 'text-[#ffd479]'}`}>
            <span aria-hidden="true">{conectado ? '●' : '○'}</span>
            {conectado ? `Conectado${dados.estado.numero ? ` · ${dados.estado.numero}` : ''}` : qr ? 'Aguardando o QR code' : 'Desconectado'}
          </p>
          <p className="mt-1 text-[12px] text-slate">
            {lidoEm ? `lido às ${lidoEm} · ` : ''}instância {dados.estado.instancia}
            {dados.ponte
              ? ` · ponte em ${dados.ponte.url.replace('https://', '').replace('http://', '')} · registrada ${quando(dados.ponte.quando)}`
              : ''}
          </p>
          {qr ? (
            <div className="mt-4">
              <img src={`data:image/png;base64,${qr}`} alt="QR code para conectar o WhatsApp" className="h-56 w-56 rounded-lg bg-white p-2" />
              <p className="mt-2 max-w-sm text-[12px] leading-[1.5] text-slate">
                No celular: WhatsApp → Aparelhos conectados → Conectar aparelho. O painel confere sozinho.
              </p>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {conectado ? (
              <button type="button" disabled={ocupado} onClick={() => void desconectar()} className="rounded-full border border-white/12 px-4 py-2 text-[13px] text-ash hover:text-ivory disabled:opacity-50">
                Desconectar
              </button>
            ) : (
              <button type="button" disabled={ocupado || !dados.estado.configurado} onClick={() => void conectar()} className="rounded-full bg-cobalt px-4 py-2 text-[13px] text-white disabled:opacity-50">
                {qr ? 'Gerar outro QR' : 'Conectar número'}
              </button>
            )}
            <button type="button" disabled={ocupado} onClick={() => void carregar()} className="rounded-full border border-white/12 px-4 py-2 text-[13px] text-ash hover:text-ivory disabled:opacity-50">
              Atualizar
            </button>
            {conectado ? (
              <button type="button" disabled={ocupado} onClick={() => void atualizarComCelular()} className="rounded-full border border-white/12 px-4 py-2 text-[13px] text-ash hover:text-ivory disabled:opacity-50">
                Buscar conversas no celular
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-[11px] leading-[1.5] text-slate">
            Conversa que você não marcar nunca recebe resposta do robô. Se você escrever pelo celular numa
            conversa assumida, o robô cala naquela vez e continua na próxima resposta da pessoa, levando em conta o
            que você disse. Para desligar o robô numa conversa, mande "#pausa" nela; "#robo" religa.
          </p>
        </div>

        <div className="graphite-card">
          <p className="label-voice text-[10px]">Segmento dos próximos leads</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ['imobiliaria', 'Imobiliária'],
                ['cursinho', 'Cursinho preparatório'],
                ['odonto', 'Clínica odontológica'],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={dados.segmento === valor}
                onClick={() => void salvarSegmento(valor)}
                className={`rounded-full px-4 py-2 text-[13px] ${dados.segmento === valor ? 'bg-cobalt text-white' : 'border border-white/12 text-ash hover:text-ivory'}`}
              >
                {rotulo}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-[1.5] text-slate">
            Escolha antes de abordar uma lista. Cada lead guarda o segmento com que nasceu: dor, contorno e fechamento
            mudam conforme o ramo; o roteiro de vendas é o mesmo.
          </p>
        </div>

        <div className="graphite-card">
          <p className="label-voice text-[10px]">Modo do robô</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={dados.modo !== 'ativo'}
              onClick={() => void salvarModo('responder')}
              className={`rounded-full px-4 py-2 text-[13px] ${dados.modo !== 'ativo' ? 'bg-cobalt text-white' : 'border border-white/12 text-ash hover:text-ivory'}`}
            >
              Só responde
            </button>
            <button
              type="button"
              aria-pressed={dados.modo === 'ativo'}
              onClick={() => void salvarModo('ativo')}
              className={`rounded-full px-4 py-2 text-[13px] ${dados.modo === 'ativo' ? 'bg-cobalt text-white' : 'border border-white/12 text-ash hover:text-ivory'}`}
            >
              Ativo
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-[1.5] text-slate">
            "Só responde": o robô fala com quem escreveu primeiro ou com quem você abriu à mão pelo celular (frase gatilho).
            Sem abordagem a frio e sem empurrão automático. "Ativo": empurrão em conversa parada e abordagem a frio pelo
            painel, até 10 por dia, só em horário comercial, só para número com WhatsApp, nunca para quem pediu para
            parar, e suspensa sozinha se os envios deixarem de ser confirmados. Para prospectar em volume, o caminho é
            a API oficial do WhatsApp Business.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {dados.quarentenaAte ? (
              <>
                <span className="text-[12px] text-[#ffd479]">
                  Em quarentena até {new Date(dados.quarentenaAte).toLocaleString('pt-BR')}: nada proativo.
                </span>
                <button type="button" onClick={() => void quarentena(0)} className="rounded-full border border-white/12 px-3 py-1.5 text-[12px] text-ash hover:text-ivory">
                  Encerrar quarentena
                </button>
              </>
            ) : (
              <button type="button" onClick={() => void quarentena(72)} className="rounded-full border border-[#ffd479]/40 px-3 py-1.5 text-[12px] text-[#ffd479] hover:bg-[#ffd479]/10">
                Fui restrito pelo WhatsApp: quarentena de 3 dias
              </button>
            )}
          </div>
          {dados.abordagens ? (
            <p className="mt-2 text-[12px] text-ash">
              Abordagens a frio hoje: {dados.abordagens.usadas} de {dados.abordagens.limite}. O limite sobe 5 a cada dois dias sem
              restrição, até 30, e volta a 10 depois de uma quarentena.
            </p>
          ) : null}
        </div>

        <div className="graphite-card">
          <p className="label-voice text-[10px]">Frases gatilho (uma por linha)</p>
          <p className="mt-1 text-[11px] leading-[1.5] text-slate">
            Mande uma destas frases pelo seu celular, em qualquer conversa, e o robô assume: ele guarda a sua mensagem
            como a primeira dele e responde sozinho quando a pessoa replicar. Vale se a mensagem contiver a frase,
            sem ligar para maiúsculas, acentos ou pontuação. Depois, o que você escrever pelo celular entra na conversa e o robô
            segue dali; "#pausa" desliga o robô naquela conversa.
          </p>
          <textarea
            value={gatilho}
            onChange={(evento) => setGatilho(evento.target.value)}
            rows={4}
            className="mt-2 w-full rounded-lg border border-white/10 bg-onyx/60 p-3 text-[13px] leading-[1.5] text-ash outline-none focus:border-[#8db4f5]/50"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!dados.banco} onClick={() => void salvarGatilho(gatilho)} className="rounded-full bg-cobalt px-4 py-2 text-[13px] text-white disabled:opacity-50">
              Salvar frases
            </button>
            <button type="button" onClick={() => setGatilho(dados.gatilhoPadrao)} className="rounded-full border border-white/12 px-4 py-2 text-[13px] text-ash hover:text-ivory">
              Voltar ao padrão
            </button>
          </div>
        </div>

        <div className="graphite-card">
          <p className="label-voice text-[10px]">Instrução mestre da prospecção</p>
          <textarea
            value={instrucao}
            onChange={(evento) => setInstrucao(evento.target.value)}
            rows={9}
            className="mt-2 w-full rounded-lg border border-white/10 bg-onyx/60 p-3 text-[13px] leading-[1.5] text-ash outline-none focus:border-[#8db4f5]/50"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!dados.banco} onClick={() => void salvarInstrucao(instrucao)} className="rounded-full bg-cobalt px-4 py-2 text-[13px] text-white disabled:opacity-50">
              Salvar instrução
            </button>
            <button type="button" onClick={() => setInstrucao(dados.instrucaoPadrao)} className="rounded-full border border-white/12 px-4 py-2 text-[13px] text-ash hover:text-ivory">
              Voltar ao padrão
            </button>
          </div>
        </div>
      </div>

      {aviso ? <p className="text-[13px] text-[#ffd479]">{aviso}</p> : null}

      <div className="graphite-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="label-voice text-[10px]">
            Conversas do aparelho {conectado ? `(${visiveis.length})` : ''}
            {totalOcultas ? (
              <button type="button" onClick={() => setMostrarOcultas((v) => !v)} className="ml-3 rounded-full border border-white/12 px-2.5 py-0.5 text-[10px] normal-case tracking-normal text-ash hover:text-ivory">
                {mostrarOcultas ? 'Esconder ocultas' : `Mostrar ${totalOcultas} ocultas`}
              </button>
            ) : null}
          </p>
          {/* Prospectar quem não está na lista: digita o número e o robô
              aborda. Não depende do histórico do aparelho. */}
          {conectado && dados.inteligencia && dados.banco ? (
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <textarea
                rows={2}
                value={numeroNovo}
                onChange={(e) => setNumeroNovo(e.target.value)}
                placeholder="Números para abordar, um por linha (DDD + número), até 10 por dia, um por minuto"
                className="min-w-0 flex-1 rounded-xl border border-white/12 bg-onyx/60 px-4 py-2 text-[13px] leading-[1.4] text-ivory outline-none placeholder:text-slate focus:border-[#8db4f5]/50 sm:w-72"
              />
              <button
                type="button"
                disabled={ocupado || numeroNovo.replace(/\D/g, '').length < 10}
                onClick={() => void assumirNumero()}
                className="shrink-0 rounded-full border border-cobalt/50 px-4 py-2 text-[13px] text-ivory hover:bg-cobalt/15 disabled:opacity-50"
              >
                Abordar
              </button>
            </div>
          ) : null}
          <button
            type="button"
            disabled={ocupado || escolhidas.size === 0 || !dados.inteligencia || !dados.banco}
            onClick={() => void assumir()}
            className="rounded-full bg-cobalt px-4 py-2 text-[13px] text-white disabled:opacity-50"
          >
            {ocupado ? 'Escrevendo…' : `O robô assume ${escolhidas.size ? `${escolhidas.size} conversa${escolhidas.size > 1 ? 's' : ''}` : ''}`}
          </button>
        </div>
        {/* Diz por que o botão não liga, em vez de deixar a pessoa adivinhar. */}
        {!dados.inteligencia || !dados.banco ? (
          <p className="mt-2 text-[12px] text-[#ffd479]">
            {!dados.banco ? 'Cadastre POSTGRES_URL na Vercel. ' : ''}
            {!dados.inteligencia ? 'Cadastre ANTHROPIC_API_KEY (ou OPENAI_API_KEY) na Vercel para o robô ter com que escrever.' : ''}
          </p>
        ) : escolhidas.size === 0 && conectado && dados.conversas.length ? (
          <p className="mt-2 text-[12px] text-slate">Marque uma ou mais conversas na lista para o robô assumir.</p>
        ) : null}
        {!conectado ? (
          <p className="mt-3 text-[13px] text-slate">Conecte o número para ver as conversas.</p>
        ) : dados.conversas.length === 0 ? (
          <p className="mt-3 text-[13px] text-slate">Nenhuma conversa individual no aparelho.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/8">
            {visiveis.map((conversa) => {
              const modo = conversa.lead?.prospeccao || ''
              const marcada = escolhidas.has(conversa.jid)
              return (
                <li key={conversa.jid} className="flex items-start gap-3 py-3">
                  {/* A linha inteira marca e desmarca: a caixa sozinha era um
                      alvo pequeno demais. O botão do robô e o de ler a
                      conversa ficam fora deste clique. */}
                  <button
                    type="button"
                    aria-label={`Escolher ${nomeDe(conversa)}`}
                    aria-pressed={marcada}
                    disabled={modo === 'bot'}
                    onClick={() => alternar(conversa.jid)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left disabled:opacity-60"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${marcada ? 'border-cobalt bg-cobalt text-white' : 'border-white/25'}`}
                    >
                      {marcada ? '✓' : ''}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-[14px] text-ivory">
                        {nomeDe(conversa)}
                        {conversa.nome ? <span className="text-[12px] text-slate">{conversa.telefone}</span> : null}
                        {modo === 'bot' ? (
                          <span className="rounded-full bg-[#86e8a8]/15 px-2 py-0.5 text-[11px] text-[#86e8a8]">robô prospectando</span>
                        ) : modo === 'pausado' ? (
                          <span className="rounded-full bg-[#ffd479]/15 px-2 py-0.5 text-[11px] text-[#ffd479]">pausado, sua mão</span>
                        ) : conversa.lead ? (
                          <span className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-slate">lead · {conversa.lead.situacao}</span>
                        ) : null}
                      </span>
                      {conversa.ultima ? (
                        <span className="mt-0.5 block truncate text-[12px] text-slate">
                          {conversa.ultima.de === 'robo' ? 'você: ' : ''}
                          {conversa.ultima.texto}
                        </span>
                      ) : null}
                      <span className="mt-0.5 block text-[11px] text-slate">{quando(conversa.quando)}</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => void abrirConversa(conversa)}
                      className="rounded-full border border-white/12 px-3 py-1 text-[12px] text-ash hover:text-ivory"
                    >
                      Ler
                    </button>
                    <button
                      type="button"
                      onClick={() => void ocultarConversa(conversa, !conversa.oculta)}
                      title={conversa.oculta ? 'Voltar a mostrar e liberar o robô' : 'Esconder da lista e tirar o robô desta conversa (amigo, família, cliente antigo)'}
                      className="rounded-full border border-white/12 px-3 py-1 text-[12px] text-slate hover:text-ivory"
                    >
                      {conversa.oculta ? 'Mostrar' : 'Ocultar'}
                    </button>
                    {conversa.lead && modo ? (
                      <button
                        type="button"
                        onClick={() => void mudar(conversa.lead!.id, modo === 'bot' ? 'pausado' : 'bot')}
                        className="rounded-full border border-white/12 px-3 py-1 text-[12px] text-ash hover:text-ivory"
                      >
                        {modo === 'bot' ? 'Pausar' : 'Devolver ao robô'}
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {resultados.length ? (
          <ul className="mt-4 space-y-1 text-[12px]">
            {resultados.map((r) => (
              <li key={r.jid} className={r.erro ? 'text-[#ff9b9b]' : 'text-[#86e8a8]'}>
                {r.jid.split('@')[0]}: {r.erro ? r.erro : 'abordagem enviada'}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* A gaveta de leitura: a conversa inteira, do jeito que a ponte tem. */}
      {lendo ? (
        <div className="fixed inset-0 z-[80] flex justify-end">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setLendo(null)}
            className="absolute inset-0 cursor-default bg-onyx/65 backdrop-blur-[2px]"
          />
          <aside className="relative z-10 flex w-full max-w-[460px] flex-col border-l border-white/10 bg-graphite">
            <header className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-[15px] text-ivory">{lendo.conversa.nome || lendo.conversa.telefone}</p>
                <p className="text-[12px] text-slate">{lendo.conversa.telefone}</p>
              </div>
              <button
                type="button"
                onClick={() => setLendo(null)}
                className="rounded-full border border-white/12 px-3 py-1 text-[12px] text-ash hover:text-ivory"
              >
                Fechar
              </button>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {lendo.falas === null ? (
                <p className="text-[13px] text-slate">Carregando a conversa…</p>
              ) : lendo.falas.length === 0 ? (
                <p className="text-[13px] text-slate">Sem mensagens de texto guardadas nesta conversa ainda.</p>
              ) : (
                lendo.falas.map((fala, i) => (
                  <div
                    key={i}
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] ${fala.de === 'robo' ? 'ml-auto bg-cobalt/25 text-ivory' : 'bg-obsidian text-ash'}`}
                  >
                    <span className="mb-1 block text-[10px] uppercase opacity-60">{fala.de === 'robo' ? 'você' : 'pessoa'}</span>
                    {fala.texto}
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
