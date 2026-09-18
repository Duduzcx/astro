import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSmoothScroll } from './lib/scroll'

initSmoothScroll()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/* Rede de segurança: se o WebGL falhar, ou o aparelho não tiver contexto, a
   cena nunca desenha e a tela de entrada ficaria para sempre na frente do
   site. Oito segundos e ela sai de qualquer jeito. */
window.setTimeout(() => {
  document.documentElement.dataset.sceneReady = 'true'
}, 8000)
