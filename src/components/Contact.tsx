import { useState, type FormEvent } from 'react'
import { ArrowGlyph, WordReveal, Reveal } from './ui/Primitives'
import { site } from '../lib/site'

const inputClasses =
  'w-full rounded-2xl bg-obsidian px-5 py-3.5 text-[15px] text-ivory placeholder:text-slate outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_#5266eb]'

/**
 * Netlify-powered form (the hidden mirror lives in index.html so the build
 * bot registers it) plus the fast lane: a 20-minute call on WhatsApp.
 */
export function Contact() {
  const [sent, setSent] = useState(false)

  /* Netlify AJAX submission: post the urlencoded fields to the page itself. */
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
      /* Offline or local dev: still confirm — the fallback contact routes are beside the form. */
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
                Atendimento 24h: a equipe responde das 8h às 21h e, fora disso, nosso assistente de
                IA já começa a resolver. Se preferir pular a fila: uma conversa técnica de 20
                minutos, direto no WhatsApp.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-8 flex flex-col gap-3">
                <a
                  href={site.whatsapp.href}
                  className="inline-flex w-fit items-center gap-2.5 rounded-full bg-obsidian px-6 py-3.5 text-[15px] text-ivory transition-colors hover:bg-[#31314a]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
                  Agendar 20 minutos no WhatsApp
                </a>
                <a
                  href={`mailto:${site.email}`}
                  className="w-fit text-[15px] text-ash underline-offset-4 transition-colors hover:text-ivory hover:underline"
                >
                  {site.email}
                </a>
                <p className="text-[13px] text-slate">{site.hours}</p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            {sent ? (
              <div className="graphite-card flex h-full flex-col items-start justify-center">
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
                  className="mt-2 inline-flex items-center justify-center gap-2.5 rounded-full bg-cobalt px-7 py-3.5 text-[15px] font-[420] text-white transition-colors duration-300 hover:bg-[#6377f2]"
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
