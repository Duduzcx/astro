import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { Painel } from './Painel'

/* Sem Lenis, sem cena, sem tela de entrada: o painel é uma ferramenta de
   trabalho. O que importa aqui é abrir rápido e mostrar número certo. */
createRoot(document.getElementById('painel')!).render(
  <StrictMode>
    <Painel />
  </StrictMode>,
)
