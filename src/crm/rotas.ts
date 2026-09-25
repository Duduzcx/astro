import { useEffect, useState } from 'react'

/**
 * Um roteador de um arquivo: o caminho depois de /crm decide a tela. A
 * Vercel reescreve /crm e /crm/* para crm.html, então recarregar a página
 * em qualquer tela funciona.
 */
const EVENTO = 'crm:rota'

export function caminhoAtual() {
  const c = window.location.pathname.replace(/^\/crm\/?/, '').replace(/\/+$/, '')
  return c || 'dashboard'
}

export function navegar(destino: string) {
  const alvo = `/crm/${destino.replace(/^\//, '')}`.replace(/\/dashboard$/, '')
  if (window.location.pathname !== alvo) window.history.pushState(null, '', alvo || '/crm')
  window.dispatchEvent(new Event(EVENTO))
}

export function useRota() {
  const [rota, setRota] = useState(caminhoAtual)
  useEffect(() => {
    const ler = () => setRota(caminhoAtual())
    window.addEventListener('popstate', ler)
    window.addEventListener(EVENTO, ler)
    return () => {
      window.removeEventListener('popstate', ler)
      window.removeEventListener(EVENTO, ler)
    }
  }, [])
  return rota
}
