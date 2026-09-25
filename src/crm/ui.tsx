import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { navegar } from './rotas'

/* Peças pequenas, com a mesma cara do painel da agência. */

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="block">
      <span className="label-voice text-[9px]">{rotulo}</span>
      {children}
      {dica ? <span className="mt-1 block text-[11px] leading-[1.5] text-slate">{dica}</span> : null}
    </label>
  )
}

export function Botao({
  children,
  tipo = 'primario',
  ...resto
}: { children: ReactNode; tipo?: 'primario' | 'fantasma' | 'perigo' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const classe =
    tipo === 'primario'
      ? 'rounded-full bg-cobalt px-5 py-2 text-[13px] text-white transition-colors hover:bg-[#5d92ea]'
      : tipo === 'perigo'
        ? 'rounded-full border border-[#ff9b9b]/40 px-4 py-2 text-[13px] text-[#ff9b9b] transition-colors hover:bg-[#ff9b9b]/10'
        : 'rounded-full border border-white/12 px-4 py-2 text-[13px] text-ash transition-colors hover:text-ivory'
  return (
    <button type="button" {...resto} className={`${classe} disabled:cursor-not-allowed disabled:opacity-50 ${resto.className || ''}`}>
      {children}
    </button>
  )
}

export function Aviso({ children, tom = 'atencao' }: { children: ReactNode; tom?: 'atencao' | 'info' | 'erro' | 'ok' }) {
  const cores = {
    atencao: 'border-[#ffd479]/30 bg-[#ffd479]/5 text-[#ffd479]',
    info: 'border-[#8db4f5]/25 bg-[#8db4f5]/5 text-[#8db4f5]',
    erro: 'border-[#ff9b9b]/30 bg-[#ff9b9b]/5 text-[#ff9b9b]',
    ok: 'border-[#86e8a8]/30 bg-[#86e8a8]/5 text-[#86e8a8]',
  }
  return <p className={`rounded-xl border px-4 py-3 text-[13px] leading-[1.5] ${cores[tom]}`}>{children}</p>
}

export function Pilula({ children, cor = 'text-slate border-white/12' }: { children: ReactNode; cor?: string }) {
  return <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase ${cor}`}>{children}</span>
}

export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <h2 className="text-[1.5rem] text-ivory">{children}</h2>
      {sub ? <p className="mt-1 text-[13px] text-slate">{sub}</p> : null}
    </div>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-[13px] text-slate">{children}</p>
}

export function Numero({ rotulo, valor, cor = 'text-ivory' }: { rotulo: string; valor: ReactNode; cor?: string }) {
  return (
    <div className="graphite-card">
      <p className="label-voice text-[9px]">{rotulo}</p>
      <p className={`mt-2 text-[1.8rem] leading-none ${cor}`}>{valor}</p>
    </div>
  )
}

export function Link({ para, className = '', children, ativo }: { para: string; className?: string; children: ReactNode; ativo?: boolean }) {
  return (
    <a
      href={`/crm/${para}`}
      onClick={(evento) => {
        if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return
        evento.preventDefault()
        navegar(para)
      }}
      aria-current={ativo ? 'page' : undefined}
      className={className}
    >
      {children}
    </a>
  )
}
