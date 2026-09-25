import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AstroMark } from './brand/AstroMark'
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

/* Elementos que, se estiverem sob o botão, já bastam para escondê-lo: são
   coisas que a pessoa precisa ver ou tocar. */
const IMPORTANTES = new Set(['IMG', 'SVG', 'BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'VIDEO'])

/** Este elemento pinta alguma coisa neste ponto, ou é só espaço vazio? */
function pinta(elemento: Element): boolean {
  const tag = elemento.tagName.toUpperCase()
  /* A cena, a página e a raiz são o fundo: passar por cima delas é justamente
     o que o botão deve poder fazer. */
  if (tag === 'CANVAS' || tag === 'HTML' || tag === 'BODY') return false
  if ((elemento as HTMLElement).id === 'root') return false
  if (IMPORTANTES.has(tag)) return true

  /* Camadas do tamanho da tela são fundo, não conteúdo: o banho de cor, o
     véu de leitura e os contêineres de seção cobrem a viewport inteira e
     pintam alguma coisa em todo ponto. Contá-los escondia o botão na página
     inteira — medido: ele nunca aparecia. Conteúdo de verdade tem tamanho de
     conteúdo, e os filhos que de fato pintam vêm antes na pilha. */
  const caixa = elemento.getBoundingClientRect()
  if (caixa.width >= window.innerWidth * 0.95 && caixa.height >= window.innerHeight * 0.95) return false

  const estilo = getComputedStyle(elemento)
  if (estilo.visibility === 'hidden' || estilo.opacity === '0') return false

  /* Cor de fundo e borda NÃO contam como informação.
     Contavam, e no celular — onde o conteúdo ocupa a largura toda — o canto
     quase sempre cai sobre o fundo de algum cartão: o botão não aparecia em
     página nenhuma, medido. O que a pessoa precisa ler é texto, imagem e
     coisa clicável; o canto vazio de um cartão não é informação. */

  /* Texto escrito NESTE elemento, não num filho: o filho já teria sido
     devolvido antes por elementsFromPoint, que entrega do mais fundo ao mais
     raso. */
  for (const no of elemento.childNodes) {
    if (no.nodeType === Node.TEXT_NODE && no.textContent && no.textContent.trim()) return true
  }
  return false
}

/**
 * Tem conteúdo debaixo do botão?
 *
 * Testa alguns pontos dentro da área que o botão ocupa e pergunta ao
 * navegador o que está ali. É o único jeito honesto: qualquer lista de
 * "seções onde ele atrapalha" fica desatualizada no dia em que alguém mexe
 * no layout, e foi assim que ele acabou cobrindo um cartão.
 *
 * Custa um teste de posição por parada da rolagem, nunca por quadro.
 */
function temConteudoAtras(): boolean {
  if (typeof document === 'undefined') return false
  const largo = window.innerWidth >= 640
  const margem = largo ? 28 : 20
  const tamanho = largo ? 60 : 56
  const folga = 10
  const direita = window.innerWidth - margem + folga
  const esquerda = window.innerWidth - margem - tamanho - folga
  const baixo = window.innerHeight - margem + folga
  const cima = window.innerHeight - margem - tamanho - folga
  const meioX = (esquerda + direita) / 2
  const meioY = (cima + baixo) / 2
  const pontos: [number, number][] = [
    [meioX, meioY],
    [esquerda + 2, cima + 2],
    [direita - 2, cima + 2],
    [esquerda + 2, baixo - 2],
    [direita - 2, baixo - 2],
  ]
  for (const [x, y] of pontos) {
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue
    for (const elemento of document.elementsFromPoint(x, y)) {
      /* O próprio botão e a gaveta não contam como obstáculo. */
      if (elemento.closest('.astro-fab') || elemento.closest('#astro-chat')) continue
      if (pinta(elemento)) return true
      /* Elemento transparente: continua descendo a pilha. */
    }
  }
  return false
}

export function Chatbot() {
  const [aberto, setAberto] = useState(false)
  const [indice, setIndice] = useState(0)
  const [falas, setFalas] = useState<Fala[]>(ABERTURA)
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [rascunho, setRascunho] = useState('')
  const [estado, setEstado] = useState<'conversando' | 'enviando' | 'pronto' | 'whatsapp' | 'livre'>(
    'conversando',
  )
  /* Conversa livre depois do roteiro, quando há inteligência ligada em
     /api/bot. Sem chave configurada a rota diz `roteiro` e este caminho
     simplesmente não aparece — o chat termina como sempre terminou. */
  const [pensando, setPensando] = useState(false)
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
  /* Nada de conteúdo embaixo. Medido de verdade, não adivinhado por seção. */
  const [canoLivre, setCanoLivre] = useState(true)

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

  /* O teste de colisão roda quando a rolagem PARA, e não durante: durante a
     rolagem ele custaria um cálculo de layout por quadro, disputando thread
     com a cena. Enquanto a página se move o botão fica escondido, o que de
     quebra tira ele da frente justamente quando ninguém vai clicar nele. */
  useEffect(() => {
    const relogios: number[] = []
    let quadro = 0
    const medir = () => {
      quadro = 0
      setCanoLivre(!temConteudoAtras())
    }
    const agendar = (espera: number) => {
      relogios.push(
        window.setTimeout(() => {
          if (!quadro) quadro = requestAnimationFrame(medir)
        }, espera),
      )
    }
    const aoMexer = () => {
      setCanoLivre(false)
      for (const r of relogios.splice(0)) window.clearTimeout(r)
      /* Duas medições, e a segunda é a que importa.
         O conteúdo desta página entra por animação quando aparece na tela: à
         primeira medição, 220ms depois da rolagem parar, um cartão que está
         subindo ainda não ocupa o lugar dele. Medido em produção — sobrava um
         caso de sobreposição em cada aparelho. A segunda medição, com a
         revelação já assentada, pega o que faltou. */
      agendar(220)
      agendar(1100)
    }
    medir()
    window.addEventListener('scroll', aoMexer, { passive: true })
    window.addEventListener('resize', aoMexer)
    return () => {
      for (const r of relogios) window.clearTimeout(r)
      if (quadro) cancelAnimationFrame(quadro)
      window.removeEventListener('scroll', aoMexer)
      window.removeEventListener('resize', aoMexer)
    }
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

  /** Manda uma mensagem solta para a ponte e traz a resposta. */
  async function conversar(texto: string) {
    const minhas = [...falas, { de: 'pessoa' as const, texto }]
    setFalas(minhas)
    setRascunho('')
    setPensando(true)
    try {
      const resposta = await fetch('/api/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: texto, historico: falas, armadilha }),
      })
      const corpo = await resposta.json()
      if (corpo?.modo === 'ia' && corpo.resposta) {
        setFalas([...minhas, { de: 'robo', texto: corpo.resposta }])
      } else {
        /* Sem inteligência, ou ela falhou: nunca deixar no vácuo. */
        setFalas([
          ...minhas,
          {
            de: 'robo',
            texto: 'Anotei! Uma pessoa do time responde no seu contato — se preferir agora, é só chamar no WhatsApp.',
          },
        ])
        setEstado('whatsapp')
      }
    } catch {
      setFalas([...minhas, { de: 'robo', texto: 'Não consegui responder agora. Me chama no WhatsApp que a gente resolve.' }])
      setEstado('whatsapp')
    } finally {
      setPensando(false)
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
      {/* Botão flutuante, só a marca. Sem texto ele ocupa um canto em vez de
          uma faixa, e some no hero, no contato e no rodapé. O nome do que ele
          faz vive no aria-label, que é onde o leitor de tela procura. */}
      <AnimatePresence>
        {entrou && !aberto && podeAparecer && canoLivre ? (
          <motion.button
            type="button"
            onClick={() => setAberto(true)}
            aria-label="Abrir o atendimento da Astro Soluções"
            aria-expanded={false}
            aria-controls="astro-chat"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            className="astro-fab fixed right-5 bottom-5 z-[70] grid h-14 w-14 place-items-center rounded-full sm:right-7 sm:bottom-7 sm:h-15 sm:w-15"
          >
            <AstroMark className="h-7 w-7" />
            {/* O anel que pulsa. É um pseudo-elemento em transform e opacity,
                então mora no compositor e não repinta nada — nem a página,
                nem o canvas da cena. */}
            <span aria-hidden="true" className="astro-fab-anel" />
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {aberto ? (
          <>
            {/* O véu. Escurece a cena sem apagá-la, e fechar tocando fora é o
                gesto que todo mundo tenta primeiro. */}
            <motion.button
              type="button"
              aria-label="Fechar o atendimento"
              onClick={() => setAberto(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="fixed inset-0 z-[70] cursor-default bg-onyx/45"
            />
            <motion.div
              id="astro-chat"
              ref={painel}
              role="dialog"
              aria-modal="true"
              aria-label="Atendimento da Astro Soluções"
              /* Entra deslizando da direita, em transform — o compositor
                 resolve sozinho, sem empurrar layout nem forçar o canvas da
                 cena a repintar. No celular a gaveta ocupa a tela toda. */
              initial={{ x: semMovimento() ? 0 : '100%', opacity: semMovimento() ? 0 : 1 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: semMovimento() ? 0 : '100%', opacity: semMovimento() ? 0 : 1 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              className="astro-gaveta fixed top-0 right-0 bottom-0 z-[71] flex w-full max-w-[420px] flex-col"
            >
              <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <span className="flex items-center gap-3 text-[14px] text-ivory">
                  <AstroMark className="h-6 w-6" />
                  <span className="flex flex-col leading-tight">
                    Atendimento Astro
                    <span className="flex items-center gap-1.5 text-[11px] text-slate">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
                      respondemos agora
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  aria-label="Fechar o atendimento"
                  className="rounded-full border border-white/12 px-3 py-1.5 text-[12px] text-slate transition-colors hover:text-ivory"
                >
                  Fechar
                </button>
              </header>

              <div
                aria-live="polite"
                className="flex min-h-[180px] flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-5"
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

              <footer className="border-t border-white/10 px-5 py-4">
              {estado === 'enviando' ? (
                <p className="text-[13px] text-slate">Enviando…</p>
              ) : estado === 'pronto' ? (
                <div className="flex flex-col gap-3">
                  <p className="text-[13px] text-slate">Conversa encerrada. Obrigado!</p>
                  <button
                    type="button"
                    onClick={() => {
                      setEstado('livre')
                      setFalas((atuais) => [
                        ...atuais,
                        { de: 'robo', texto: 'Claro! Pode perguntar o que quiser sobre a Astro.' },
                      ])
                    }}
                    className="self-start text-[13px] text-[#8db4f5] underline underline-offset-4 hover:text-ivory"
                  >
                    Tenho outra dúvida
                  </button>
                </div>
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
              ) : estado === 'livre' ? (
                <form
                  onSubmit={(evento) => {
                    evento.preventDefault()
                    const texto = rascunho.trim()
                    if (texto && !pensando) void conversar(texto)
                  }}
                  className="flex items-center gap-2"
                >
                  <label className="sr-only" htmlFor="astro-chat-livre">
                    Sua pergunta
                  </label>
                  <input
                    id="astro-chat-livre"
                    value={rascunho}
                    onChange={(evento) => setRascunho(evento.target.value)}
                    placeholder={pensando ? 'Pensando…' : 'Escreva a sua pergunta'}
                    disabled={pensando}
                    maxLength={600}
                    className="w-full rounded-full bg-obsidian px-4 py-2.5 text-[14px] text-ivory outline-none placeholder:text-slate focus:shadow-[inset_0_0_0_1px_#4d84e0] disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={pensando}
                    aria-label="Enviar pergunta"
                    className="shrink-0 rounded-full bg-cobalt px-4 py-2.5 text-[14px] text-white transition-colors hover:bg-[#5d92ea] disabled:opacity-60"
                  >
                    →
                  </button>
                </form>
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
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
