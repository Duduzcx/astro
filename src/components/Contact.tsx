import { useState, type FormEvent } from 'react'
import { ArrowGlyph, MagneticButton, WordReveal, Reveal } from './ui/Primitives'
import { site, whatsappLink } from '../lib/site'
import { AstroMark } from './brand/AstroMark'

const inputClasses =
  'w-full rounded-2xl bg-obsidian px-5 py-3.5 text-[15px] text-ivory placeholder:text-slate outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_#4d84e0]'

/**
 * O formulário entrega no WhatsApp.
 *
 * Antes ele postava para o Netlify Forms. O site mudou para a Vercel, que é
 * estática e responde 405 a um POST na própria página — medido: TODO envio
 * caía na tela de erro. Um formulário que sempre falha é pior do que não
 * ter formulário.
 *
 * Sem servidor, o caminho honesto é o que já era o resgate: o que a pessoa
 * escreveu vira uma mensagem pronta no WhatsApp, aberta no mesmo gesto do
 * clique — e é por ser no mesmo gesto que o navegador não bloqueia a aba. A
 * tela seguinte confirma e deixa o link à mão, porque abrir aba é coisa que
 * bloqueador de anúncio às vezes come.
 *
 * Se um dia houver caixa de entrada de verdade (função serverless mandando
 * e-mail, ou um serviço de formulário), o lugar de mexer é `entregar`:
 * o resto da tela não precisa saber por onde a mensagem saiu.
 */
export function Contact() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  /* O link pronto, guardado para a tela de confirmação: se a aba não abrir,
     a pessoa clica e vai com o texto que escreveu. Sem isto ela teria de
     redigitar tudo, e quase ninguém redigita. */
  const [resgate, setResgate] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    /* Isca de robô: humano não vê o campo, robô preenche. Preenchido, a tela
       agradece e nada é aberto — o robô não fica sabendo que falhou. */
    if (String(data.get('bot-field') || '').trim()) {
      setStatus('sent')
      return
    }
    /* A mensagem vai pronta e arrumada: quem recebe lê de relance quem é,
       de onde veio e qual é o problema, sem ter de perguntar três vezes.
       Campos vazios não entram — "Empresa:" sozinho numa linha só suja. */
    const linha = (rotulo: string, valor: FormDataEntryValue | null) => {
      const texto = String(valor || '').trim()
      return texto ? [`${rotulo}: ${texto}`] : []
    }
    const desafio = String(data.get('desafio') || '').trim()
    const texto = [
      'Olá, Astro Soluções! 👋',
      '',
      'Vim pelo site e queria falar sobre o meu desafio.',
      '',
      ...linha('Nome', data.get('nome')),
      ...linha('E-mail', data.get('email')),
      ...linha('Empresa', data.get('empresa')),
      ...(desafio ? ['', 'O que trava hoje:', desafio] : []),
      '',
      'Fico no aguardo!',
    ].join('\n')
    const destino = whatsappLink(texto)
    setResgate(destino)
    /* No mesmo gesto do clique, senão o navegador trata como janela não
       pedida e bloqueia.

       Sem 'noopener' na string de recursos, de propósito: com ela o
       window.open devolve null MESMO tendo aberto a aba, por especificação,
       e a tela acusava bloqueio em todo envio bem-sucedido (medido). O elo
       com a janela nova é cortado logo abaixo, que dá a mesma proteção e
       ainda devolve a referência que diz se abriu. */
    const aba = window.open(destino, '_blank')
    if (aba) aba.opener = null
    setStatus(aba ? 'sent' : 'error')
  }

  return (
    <section id="contato" aria-label="Contato" className="relative z-10 overflow-hidden py-24 md:py-32">
      <div className="aurora" aria-hidden="true" />
      <div className="shell">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <WordReveal text={'Conta pra gente\no seu desafio'} className="font-impact text-[clamp(2.4rem,5.2vw,4.2rem)]" />
            <Reveal delay={0.12}>
              <p className="mt-6 max-w-md text-ash">
                Atendimento 24h: a equipe responde das 8h às 21h e, fora disso, o plantão registra
                e encaminha o seu chamado. Se preferir pular a fila: uma conversa técnica de 20
                minutos, direto no WhatsApp.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-8 flex flex-col gap-3">
                <a
                  href={site.whatsapp.href}
                  className="inline-flex w-fit items-center gap-2.5 rounded-full bg-obsidian px-6 py-3.5 text-[15px] text-ivory transition-colors hover:bg-[#1e2c4c]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
                  Agendar 20 minutos no WhatsApp
                </a>
                <p className="text-[13px] text-slate">{site.hours}</p>
              </div>
            </Reveal>

            {/* Quem não preenche formulário precisa de outra porta. */}
            <Reveal delay={0.26}>
              <dl className="mt-9 grid gap-5 border-t border-white/10 pt-7 sm:grid-cols-3">
                <div>
                  <dt className="label-voice text-[10px]">E-mail</dt>
                  <dd className="mt-1.5">
                    <a
                      href={site.email.href}
                      className="text-[15px] break-all text-ivory transition-colors hover:text-[#8db4f5]"
                    >
                      {site.email.label}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="label-voice text-[10px]">Telefone</dt>
                  <dd className="mt-1.5">
                    <a
                      href={site.phone.href}
                      className="text-[15px] text-ivory transition-colors hover:text-[#8db4f5]"
                    >
                      {site.phone.label}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="label-voice text-[10px]">Instagram</dt>
                  <dd className="mt-1.5">
                    <a
                      href={site.instagram.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[15px] text-ivory transition-colors hover:text-[#8db4f5]"
                    >
                      {site.instagram.label}
                    </a>
                  </dd>
                </div>
              </dl>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            {status === 'sent' ? (
              <div
                role="status"
                className="graphite-card flex h-full flex-col items-start justify-center"
              >
                <AstroMark className="mb-5 h-12 w-12" />
                <p className="text-[1.4rem] text-ivory">Tudo pronto ✓</p>
                <p className="mt-3 max-w-sm text-ash">
                  Abrimos o WhatsApp com a sua mensagem já escrita — é só enviar. A gente
                  responde na hora, e em até um dia útil no pior caso.
                </p>
                <a
                  href={resgate || site.whatsapp.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2.5 rounded-full bg-obsidian px-6 py-3.5 text-[15px] text-ivory transition-colors hover:bg-[#1e2c4c]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
                  Não abriu? Abrir aqui
                </a>
              </div>
            ) : status === 'error' ? (
              <div
                role="alert"
                className="graphite-card flex h-full flex-col items-start justify-center"
              >
                <p className="text-[1.4rem] text-ivory">Quase lá.</p>
                <p className="mt-3 max-w-sm text-ash">
                  O navegador bloqueou a aba nova, mas nada se perdeu: o botão abaixo abre o
                  WhatsApp já com o que você escreveu. A gente responde na hora.
                </p>
                <a
                  href={resgate || site.whatsapp.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2.5 rounded-full bg-obsidian px-6 py-3.5 text-[15px] text-ivory transition-colors hover:bg-[#1e2c4c]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
                  {site.whatsapp.label}
                </a>
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="mt-4 text-[13px] text-slate underline underline-offset-4 hover:text-ivory"
                >
                  Tentar de novo
                </button>
              </div>
            ) : (
              <form
                name="contato"
                onSubmit={handleSubmit}
                className="graphite-card flex flex-col gap-3"
              >
                {/* Isca: humano não vê o campo, robô preenche — e aí nada é enviado. */}
                <input
                  name="bot-field"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                />
                <label className="sr-only" htmlFor="contato-nome">
                  Nome
                </label>
                <input
                  id="contato-nome"
                  name="nome"
                  required
                  placeholder="Seu nome"
                  className={inputClasses}
                />
                <label className="sr-only" htmlFor="contato-email">
                  E-mail
                </label>
                <input
                  id="contato-email"
                  name="email"
                  type="email"
                  required
                  placeholder="E-mail de trabalho"
                  className={inputClasses}
                />
                <label className="sr-only" htmlFor="contato-empresa">
                  Empresa
                </label>
                <input
                  id="contato-empresa"
                  name="empresa"
                  placeholder="Empresa"
                  className={inputClasses}
                />
                <label className="sr-only" htmlFor="contato-desafio">
                  Qual é o seu desafio atual?
                </label>
                <textarea
                  id="contato-desafio"
                  name="desafio"
                  required
                  rows={4}
                  placeholder="Qual é o seu desafio atual? Ex.: fechamento do mês leva duas semanas…"
                  className={`${inputClasses} resize-none`}
                />
                <MagneticButton
                  type="submit"
                  className="mt-2 inline-flex items-center justify-center gap-2.5 rounded-full bg-cobalt px-7 py-3.5 text-[15px] font-[420] text-white transition-colors duration-300 hover:bg-[#5d92ea]"
                >
                  Enviar no WhatsApp <ArrowGlyph />
                </MagneticButton>
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  )
}
