import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AstroStar } from './brand/AstroMark'
import { site, whatsappLink } from '../lib/site'

/**
 * O atendente do site.
 *
 * Ele não improvisa: segue um roteiro de seis perguntas que existe para
 * qualificar, não para conversar. Em troca, é previsível, custa zero por
 * conversa e nunca inventa preço nem prazo — que é o risco real de soltar um
 * modelo de linguagem falando pela empresa sem ninguém olhando.
 *
 * No fim, o lead vai para `/api/lead`. Se o banco não estiver ligado, ou se
 * a rota falhar, a conversa inteira vira uma mensagem pronta de WhatsApp: o
 * contato nunca se perde por causa de infraestrutura.
 *
 * Nada aqui roda por quadro. É estado de React e CSS; a cena 3D não fica
 * sabendo que este componente existe.
 */

type Passo = {
  chave: 'necessidade' | 'urgencia' | 'orcamento' | 'nome' | 'contato' | 'detalhe'
  pergunta: string
  opcoes?: readonly string[]
  /** Campo aberto: o que aparece dentro da caixa antes de escrever. */
  dica?: string
  opcional?: boolean
}

const ROTEIRO: readonly Passo[] = [
  {
    chave: 'necessidade',
    pergunta: 'O que você precisa resolver?',
    opcoes: [
      'Site ou landing page',
      'Sistema sob medida',
      'Automação de processo',
      'Integração entre ferramentas',
      'Ainda não sei — quero ajuda',
    ],
  },
  {
    chave: 'urgencia',
    pergunta: 'E para quando?',
    opcoes: ['Era para ontem', 'Nas próximas semanas', 'Neste trimestre', 'Só pesquisando'],
  },
  {
    chave: 'orcamento',
    pergunta: 'Já existe um orçamento previsto?',
    opcoes: ['Até R$ 10 mil', 'R$ 10 a 30 mil', 'Acima de R$ 30 mil', 'Prefiro conversar antes'],
  },
  {
    chave: 'detalhe',
    pergunta: 'Me conta em uma frase o que trava hoje. (Pode pular.)',
    dica: 'Ex.: o fechamento do mês leva duas semanas na planilha',
    opcional: true,
  },
  { chave: 'nome', pergunta: 'Como posso te chamar?', dica: 'Seu nome' },
  {
    chave: 'contato',
    pergunta: 'E onde te respondemos?',
    dica: 'WhatsApp ou e-mail',
  },
]

type Fala = { de: 'robo' | 'pessoa'; texto: string }

const ABERTURA: Fala[] = [
  { de: 'robo', texto: 'Olá! Sou o atendimento da Astro Soluções 👋' },
  { de: 'robo', texto: 'Seis perguntas rápidas e eu já encaminho para a pessoa certa do time.' },
]

const semMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Chatbot() {
  const [aberto, setAberto] = useState(false)
  const [indice, setIndice] = useState(0)
  const [falas, setFalas] = useState<Fala[]>(ABERTURA)
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [rascunho, setRascunho] = useState('')
  const [estado, setEstado] = useState<'conversando' | 'enviando' | 'pronto' | 'whatsapp'>('conversando')
  const [linkResgate, setLinkResgate] = useState('')
  /* Isca de robô: fica fora da tela, gente nunca preenche. */
  const [armadilha, setArmadilha] = useState('')

  /* O botão não acompanha a página inteira.
     Ele fica fora do caminho no hero (onde os dois botões principais já
     pedem a ação), some quando o contato ou o rodapé estão à vista — ali
     ele cobriria justamente o formulário e os links que a pessoa foi
     procurar — e só aparece no meio do percurso, que é onde alguém trava e
     precisa perguntar. Enquanto a tela de carregamento está no ar, nada.
     IntersectionObserver, não scroll: o navegador avisa quando muda, em vez
     de a página perguntar a cada quadro. */
  const [podeAparecer, setPodeAparecer] = useState(false)

  useEffect(() => {
    const alvos = ['#topo', '#contato', 'footer']
      .map((selector) => document.querySelector(selector))
      .filter((no): no is Element => Boolean(no))
    if (alvos.length === 0) {
      setPodeAparecer(true)
      return
    }
    const atrapalhando = new Set<Element>()
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) atrapalhando.add(entrada.target)
          else atrapalhando.delete(entrada.target)
        }
        setPodeAparecer(atrapalhando.size === 0)
      },
      /* Uma margem negativa embaixo: o botão some um pouco ANTES de a seção
         de contato encostar nele, e não no instante da colisão. */
      { rootMargin: '0px 0px -25% 0px' },
    )
    for (const alvo of alvos) observador.observe(alvo)
    return () => observador.disconnect()
  }, [])

  /* Enquanto a tela de carregamento cobre a página, o botão não existe. */
  const [entrou, setEntrou] = useState(() => !document.getElementById('entrada'))
  useEffect(() => {
    if (entrou) return
    const aoEntrar = () => setEntrou(true)
    window.addEventListener('astro:entrou', aoEntrar, { once: true })
    return () => window.removeEventListener('astro:entrou', aoEntrar)
  }, [entrou])

  const fim = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const painel = useRef<HTMLDivElement>(null)

  const passo = ROTEIRO[indice]

  useEffect(() => {
    if (!aberto) return
    fim.current?.scrollIntoView({ block: 'end', behavior: semMovimento() ? 'auto' : 'smooth' })
    if (passo && !passo.opcoes) campo.current?.focus()
  }, [aberto, falas, passo])

  /* Esc fecha. Atalho esperado em qualquer coisa que se sobreponha à página. */
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  const montarTexto = (dados: Record<string, string>) =>
    [
      'Olá, Astro Soluções! 👋',
      '',
      'Conversei com o atendimento do site:',
      '',
      `• Preciso de: ${dados.necessidade || '—'}`,
      `• Prazo: ${dados.urgencia || '—'}`,
      `• Investimento: ${dados.orcamento || '—'}`,
      ...(dados.detalhe ? ['', `O que trava hoje: ${dados.detalhe}`] : []),
      '',
      `Meu nome é ${dados.nome || '—'} e meu contato é ${dados.contato || '—'}.`,
    ].join('\n')

  async function encerrar(dados: Record<string, string>, conversa: Fala[]) {
    setEstado('enviando')
    const texto = montarTexto(dados)
    setLinkResgate(whatsappLink(texto))
    try {
      const resposta = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: dados.nome,
          contato: dados.contato,
          necessidade: dados.necessidade,
          urgencia: dados.urgencia,
          orcamento: dados.orcamento,
          resumo: dados.detalhe || '',
          conversa,
          armadilha,
        }),
      })
      if (!resposta.ok) throw new Error(String(resposta.status))
      setEstado('pronto')
      setFalas((atuais) => [
        ...atuais,
        { de: 'robo', texto: 'Recebido! Uma pessoa do time responde no seu contato em até um dia útil — normalmente muito antes.' },
      ])
    } catch {
      /* O contato não se perde por causa de infraestrutura: vai pelo
         WhatsApp com tudo o que a pessoa já escreveu. */
      setEstado('whatsapp')
      setFalas((atuais) => [
        ...atuais,
        { de: 'robo', texto: 'Quase lá! Toque no botão abaixo e me manda no WhatsApp — a mensagem já vai escrita.' },
      ])
    }
  }

  function responder(valor: string) {
    const limpo = valor.trim()
    if (!limpo && !passo?.opcional) return
    if (!passo) return

    const proximas = [...falas, { de: 'pessoa' as const, texto: limpo || '(pulei)' }]
    const dados = { ...respostas, [passo.chave]: limpo }
    setRespostas(dados)
    setRascunho('')

    const seguinte = ROTEIRO[indice + 1]
    if (seguinte) {
      setFalas([...proximas, { de: 'robo', texto: seguinte.pergunta }])
      setIndice(indice + 1)
      return
    }
    setFalas(proximas)
    setIndice(indice + 1)
    void encerrar(dados, proximas)
  }

  /* A primeira pergunta entra junto com a abertura, uma vez só. */
  useEffect(() => {
    if (aberto && falas.length === ABERTURA.length) {
      setFalas([...ABERTURA, { de: 'robo', texto: ROTEIRO[0].pergunta }])
    }
  }, [aberto, falas.length])

  return (
    <>
      {/* O botão. Some no hero, no contato e no rodapé; no celular some
          também quando o painel está aberto, onde não cabem os dois. */}
      <AnimatePresence>
        {entrou && (podeAparecer || aberto) ? (
          <motion.button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            aria-controls="astro-chat"
            initial={{ opacity: 0, y: semMovimento() ? 0 : 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: semMovimento() ? 0 : 10, scale: 0.96 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className={`fixed right-4 bottom-4 z-[70] inline-flex items-center gap-2.5 rounded-full bg-cobalt px-5 py-3.5 text-[15px] font-[420] text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)] transition-colors hover:bg-[#5d92ea] sm:right-6 sm:bottom-6 ${
              aberto ? 'hidden sm:inline-flex' : ''
            }`}
          >
            <AstroStar className="h-3.5 w-3.5" />
            {aberto ? 'Fechar' : 'Falar com a Astro'}
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {aberto ? (
          <motion.div
            id="astro-chat"
            ref={painel}
            role="dialog"
            aria-label="Atendimento da Astro Soluções"
            initial={{ opacity: 0, y: semMovimento() ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: semMovimento() ? 0 : 16 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="graphite-card fixed inset-x-3 bottom-3 z-[71] flex max-h-[82svh] flex-col gap-4 !p-0 sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-[380px]"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
              <span className="flex items-center gap-2.5 text-[14px] text-ivory">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
                Atendimento Astro
              </span>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar o atendimento"
                className="text-[13px] text-slate transition-colors hover:text-ivory"
              >
                Fechar
              </button>
            </header>

            <div
              aria-live="polite"
              className="flex min-h-[180px] flex-1 flex-col gap-2.5 overflow-y-auto px-5"
            >
              {falas.map((fala, i) => (
                <p
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-[1.45] ${
                    fala.de === 'robo'
                      ? 'self-start bg-obsidian text-ash'
                      : 'self-end bg-cobalt text-white'
                  }`}
                >
                  {fala.texto}
                </p>
              ))}
              <div ref={fim} />
            </div>

            <footer className="border-t border-white/8 px-5 py-4">
              {estado === 'enviando' ? (
                <p className="text-[13px] text-slate">Enviando…</p>
              ) : estado === 'pronto' ? (
                <p className="text-[13px] text-slate">Conversa encerrada. Obrigado!</p>
              ) : estado === 'whatsapp' ? (
                <a
                  href={linkResgate || site.whatsapp.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-obsidian px-5 py-3 text-[14px] text-ivory transition-colors hover:bg-[#1e2c4c]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
                  Enviar no WhatsApp
                </a>
              ) : passo?.opcoes ? (
                <div className="flex flex-wrap gap-2">
                  {passo.opcoes.map((opcao) => (
                    <button
                      key={opcao}
                      type="button"
                      onClick={() => responder(opcao)}
                      className="rounded-full border border-white/15 px-3.5 py-2 text-[13px] text-ash transition-colors hover:border-[#8db4f5]/50 hover:text-ivory"
                    >
                      {opcao}
                    </button>
                  ))}
                </div>
              ) : passo ? (
                <form
                  onSubmit={(evento) => {
                    evento.preventDefault()
                    responder(rascunho)
                  }}
                  className="flex items-center gap-2"
                >
                  <label className="sr-only" htmlFor="astro-chat-campo">
                    {passo.pergunta}
                  </label>
                  <input
                    id="astro-chat-campo"
                    ref={campo}
                    value={rascunho}
                    onChange={(evento) => setRascunho(evento.target.value)}
                    placeholder={passo.dica}
                    maxLength={300}
                    className="w-full rounded-full bg-obsidian px-4 py-2.5 text-[14px] text-ivory outline-none placeholder:text-slate focus:shadow-[inset_0_0_0_1px_#4d84e0]"
                  />
                  {passo.opcional ? (
                    <button
                      type="button"
                      onClick={() => responder('')}
                      className="shrink-0 text-[13px] text-slate transition-colors hover:text-ivory"
                    >
                      Pular
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    aria-label="Enviar resposta"
                    className="shrink-0 rounded-full bg-cobalt px-4 py-2.5 text-[14px] text-white transition-colors hover:bg-[#5d92ea]"
                  >
                    →
                  </button>
                </form>
              ) : null}

              {/* Fora da tela e fora do foco: só robô preenche. */}
              <input
                value={armadilha}
                onChange={(evento) => setArmadilha(evento.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-px w-px opacity-0"
              />
            </footer>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
