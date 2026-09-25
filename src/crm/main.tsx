import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { App } from './App'

/* O CRM das clínicas: terceira entrada do site, sem cena e sem tela de
   entrada. A recepção abre isto no celular entre um paciente e outro. */
createRoot(document.getElementById('crm')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
