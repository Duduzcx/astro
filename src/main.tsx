import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSmoothScroll } from './lib/scroll'
import { installSpotlight } from './lib/spotlight'

initSmoothScroll()
installSpotlight()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
