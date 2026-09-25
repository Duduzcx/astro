import { useCallback, useEffect, useState } from 'react'
import { pedir, type Eu } from './api'
import { Agendamentos } from './paginas/Agendamentos'
import { Configuracoes } from './paginas/Configuracoes'
import { Conhecimento } from './paginas/Conhecimento'
import { Conversas } from './paginas/Conversas'
import { Dashboard } from './paginas/Dashboard'
import { ListaEspera } from './paginas/ListaEspera'
import { Login } from './paginas/Login'
import { Onboarding } from './paginas/Onboarding'
import { Pacientes } from './paginas/Pacientes'
import { Simulador } from './paginas/Simulador'
import { navegar, useRota } from './rotas'
import { supabase } from './supabase'
import { Aviso, Link } from './ui'

const MENU: [string, string][] = [
  ['dashboard', 'Início'],
  ['conversas', 'Conversas'],
  ['agendamentos', 'Agenda'],
  ['pacientes', 'Pacientes'],
  ['lista-espera', 'Espera'],
  ['conhecimento', 'Conhecimento'],
  ['simulador', 'Simulador'],
  ['configuracoes', 'Configurações'],
]

export function App() {
  const [sessaoPronta, setSessaoPronta] = useState(false)
  const [logado, setLogado] = useState(false)
  const [eu, setEu] = useState<Eu | null>(null)
  const [erro, setErro] = useState('')
  const rota = useRota()

  const recarregar = useCallback(async () => {
    try {
      setEu(await pedir<Eu>('eu'))
      setErro('')
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'falhou')
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLogado(Boolean(data.session))
      setSessaoPronta(true)
    })
    const { data: escuta } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setLogado(Boolean(sessao))
      if (!sessao) setEu(null)
    })
    return () => escuta.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (logado) void recarregar()
  }, [logado, recarregar])

  if (!sessaoPronta) return <div className="flex min-h-svh items-center justify-center text-slate">Carregando…</div>
  if (!logado) return <Login />
  if (!eu) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        {erro ? (
          <Aviso tom="erro">
            {erro}. {erro.includes('SUPABASE') ? 'A chave de serviço do Supabase precisa estar na Vercel.' : ''}{' '}
            <button type="button" className="underline" onClick={() => void recarregar()}>
              tentar de novo
            </button>
          </Aviso>
        ) : (
          <p className="text-slate">Carregando a clínica…</p>
        )}
      </div>
    )
  }

  const precisaOnboarding = !eu.clinica || rota === 'onboarding'
  if (!eu.clinica && rota !== 'onboarding') navegar('onboarding')

  return (
    <div className="min-h-svh pb-20 lg:pb-0">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-onyx/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo/astro-badge.svg" alt="" className="h-7 w-7" />
            <div>
              <p className="text-[14px] text-ivory">{eu.clinica?.nome || 'Nova clínica'}</p>
              <p className="text-[11px] text-slate">{eu.usuario.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {eu.clinica ? (
              <span className={`text-[11px] ${eu.clinica.whatsapp_status === 'conectado' ? 'text-[#86e8a8]' : 'text-[#ffd479]'}`}>
                ● WhatsApp {eu.clinica.whatsapp_status === 'conectado' ? 'conectado' : eu.clinica.whatsapp_status === 'aguardando_qr' ? 'aguardando QR' : 'desconectado'}
              </span>
            ) : null}
            <button type="button" onClick={() => void supabase.auth.signOut()} className="text-[12px] text-slate underline underline-offset-4 hover:text-ivory">
              Sair
            </button>
          </div>
        </div>
        {eu.clinica ? (
          <nav className="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-5 pb-2 lg:flex">
            {MENU.map(([chave, rotulo]) => (
              <Link
                key={chave}
                para={chave === 'dashboard' ? '' : chave}
                ativo={rota === chave}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${rota === chave ? 'border-[#8db4f5]/50 text-ivory' : 'border-transparent text-slate hover:text-ivory'}`}
              >
                {rotulo}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-5">
        {precisaOnboarding ? (
          <Onboarding eu={eu} aoMudar={recarregar} />
        ) : rota === 'conversas' ? (
          <Conversas clinica={eu.clinica!} />
        ) : rota === 'agendamentos' ? (
          <Agendamentos clinica={eu.clinica!} />
        ) : rota === 'pacientes' ? (
          <Pacientes />
        ) : rota === 'lista-espera' ? (
          <ListaEspera />
        ) : rota === 'conhecimento' ? (
          <Conhecimento />
        ) : rota === 'simulador' ? (
          <Simulador clinica={eu.clinica!} aoMudar={recarregar} />
        ) : rota === 'configuracoes' ? (
          <Configuracoes eu={eu} aoMudar={recarregar} />
        ) : (
          <Dashboard eu={eu} />
        )}
      </main>

      {eu.clinica ? (
        <nav className="fixed inset-x-0 bottom-0 z-20 flex gap-1 overflow-x-auto border-t border-white/8 bg-onyx/95 px-2 py-2 backdrop-blur lg:hidden">
          {MENU.map(([chave, rotulo]) => (
            <Link
              key={chave}
              para={chave === 'dashboard' ? '' : chave}
              ativo={rota === chave}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] ${rota === chave ? 'bg-obsidian text-ivory' : 'text-slate'}`}
            >
              {rotulo}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  )
}
