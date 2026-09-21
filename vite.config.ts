import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      /* Duas páginas, dois pacotes. O painel interno não pode viajar dentro
         do pacote que o visitante baixa: ele é peso morto para quem veio ver
         o site, e a cena 3D é peso morto para quem veio trabalhar. */
      input: {
        main: 'index.html',
        admin: 'admin.html',
      },
    },
  },
})
