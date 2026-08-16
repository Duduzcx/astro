# Astro — site institucional

Landing page one-page da Astro. React 19 + TypeScript + Vite + Tailwind v4 + Framer Motion.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/
npm run preview  # serve o dist/
```

## O que trocar antes de publicar

| Onde | O quê |
| --- | --- |
| `src/lib/site.ts` | e-mail, WhatsApp, LinkedIn, GitHub, cidade — hoje são placeholders |
| `src/components/Results.tsx` | os três "cenários" são exemplos genéricos. Troque por casos reais assim que existirem |
| `index.html` | `<title>`, description e og:description |
| `public/astro-mark.svg` | favicon, se a marca definitiva for outra |

## Sistema visual

Profundidade vem de degrau de superfície, nunca de sombra. Três níveis, definidos em `src/index.css`:

- `void` `#030a1c` — canvas da página
- `deep` `#020714` — superfície recuada (marquee, processo, stack, painel de contato, rodapé)
- `orbit` `#0a2050` — card elevado e botão sólido

Texto: `platinum` em títulos e nav, `silver` no corpo, `mist` em ênfase, `phosphor` **só** em número grande. O gradiente azul (`nebula`) aparece exclusivamente no CTA principal.

Tipografia: Inter em peso 400/500 — títulos sempre 500, nunca negrito nem light. JetBrains Mono em label, eyebrow e dado técnico, com tracking largo.

Raio: 16px em card, 6px em botão. Nada além disso.

## Elemento assinatura

`src/components/OrbitField.tsx` — casca de 1500 pontos em esfera de Fibonacci girando em canvas 2D, com cinco satélites em órbitas inclinadas e paralaxe pelo ponteiro. Com `prefers-reduced-motion` desenha um único frame e para.

## Deploy

Saída estática em `dist/`. Vercel, Netlify ou Cloudflare Pages: build `npm run build`, diretório `dist`.
