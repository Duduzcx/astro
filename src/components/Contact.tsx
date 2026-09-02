import { useState, type FormEvent } from 'react'
import { ArrowGlyph, WordReveal, Reveal } from './ui/Primitives'
import { site } from '../lib/site'
import { AstroMark } from './brand/AstroMark'

const inputClasses =
  'w-full rounded-2xl bg-obsidian px-5 py-3.5 text-[15px] text-ivory placeholder:text-slate outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_#4d84e0]'

/**
 * Formulário do Netlify. O espelho oculto fica no index.html porque o build só
 * enxerga HTML estático. Ao lado, o atalho: 20 minutos no WhatsApp.
 */
export function Contact() {
  const [sent, setSent] = useState(false)

  /* Envio por AJAX: POST urlencoded para a própria página. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const body = new URLSearchParams(data as unknown as Record<string, string>).toString()
    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
    } catch {
      /* Offline ou dev local: confirma mesmo assim, os contatos diretos estão ao lado. */
    }
    setSent(true)
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
              <dl className="mt-9 grid gap-5 border-t border-white/10 pt-7 sm:grid-cols-2">
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
              </dl>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            {sent ? (
              <div className="graphite-card flex h-full flex-col items-start justify-center">
                <AstroMark className="mb-5 h-12 w-12" />
                <p className="text-[1.4rem] text-ivory">Recebido ✓</p>
                <p className="mt-3 max-w-sm text-ash">
                  Obrigado! A gente lê com atenção e responde em até um dia útil — normalmente
                  antes.
                </p>
              </div>
            ) : (
              <form
                name="contato"
                method="POST"
                data-netlify="true"
                onSubmit={handleSubmit}
                className="graphite-card flex flex-col gap-3"
              >
                <input type="hidden" name="form-name" value="contato" />
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
                <button
                  type="submit"
                  className="mt-2 inline-flex items-center justify-center gap-2.5 rounded-full bg-cobalt px-7 py-3.5 text-[15px] font-[420] text-white transition-colors duration-300 hover:bg-[#5d92ea]"
                >
                  Enviar desafio <ArrowGlyph />
                </button>
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  )
}
