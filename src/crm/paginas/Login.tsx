import { useState } from 'react'
import { supabase } from '../supabase'
import { Aviso, Botao, Campo } from '../ui'
import { campoClasse } from '../estilos'

export function Login() {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [aviso, setAviso] = useState<{ tom: 'erro' | 'ok'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar() {
    setOcupado(true)
    setAviso(null)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
      } else {
        if (senha.length < 8) throw new Error('a senha precisa de 8 caracteres ou mais')
        const { data, error } = await supabase.auth.signUp({ email, password: senha })
        if (error) throw error
        if (!data.session) setAviso({ tom: 'ok', texto: 'Conta criada. Confirme o e-mail que acabou de chegar e entre.' })
      }
    } catch (falha) {
      const m = falha instanceof Error ? falha.message : 'falhou'
      setAviso({ tom: 'erro', texto: /invalid login/i.test(m) ? 'E-mail ou senha errados.' : m })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-5">
      <form
        onSubmit={(evento) => {
          evento.preventDefault()
          void enviar()
        }}
        className="graphite-card w-full max-w-sm"
      >
        <img src="/logo/astro-badge.svg" alt="" className="h-9 w-9" />
        <h1 className="mt-4 text-[1.4rem] text-ivory">CRM da clínica</h1>
        <p className="mt-1 text-[13px] text-slate">Assistente do WhatsApp, agenda e pacientes.</p>
        <div className="mt-6 flex flex-col gap-4">
          <Campo rotulo="E-mail">
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campoClasse} />
          </Campo>
          <Campo rotulo="Senha">
            <input type="password" required autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} value={senha} onChange={(e) => setSenha(e.target.value)} className={campoClasse} />
          </Campo>
        </div>
        {aviso ? (
          <div className="mt-4">
            <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>
          </div>
        ) : null}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className="text-[12px] text-slate underline underline-offset-4 hover:text-ivory" onClick={() => setModo(modo === 'entrar' ? 'criar' : 'entrar')}>
            {modo === 'entrar' ? 'Criar conta' : 'Já tenho conta'}
          </button>
          <Botao type="submit" disabled={ocupado}>
            {ocupado ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </Botao>
        </div>
      </form>
    </div>
  )
}
