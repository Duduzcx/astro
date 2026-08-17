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

Raio: 16px em card, 12px nos cards do hero, pill (`rounded-full`) em botão. Nada além disso.

Estrutura: seções de reveal ocupam 100svh com um objeto centralizado e texto flanqueando — título uppercase à esquerda, descrição em caixa mista à direita. Separadores são sempre tracejados de 1px (`.dashed-rule`), nunca sólidos e nunca decorativos.

Voz tipográfica, duas e só duas:

1. **Uppercase peso 500** — nav, títulos, labels, botões, legal. `line-height` 0.9 nos tamanhos de display, para as caixas altas se empilharem como bloco sólido.
2. **Caixa mista peso 400** — só nos parágrafos descritivos. A troca de caixa é o sinal de que o texto virou explicação e não rótulo.

## Objetos animados

O site não usa nenhuma imagem ou vídeo externo — toda a "fotografia" é gerada em runtime. Nada para baixar, nada para licenciar, e a paleta fica exata.

| Componente | O que é | Custo |
| --- | --- | --- |
| `scenes/VideoPlate.tsx` | as duas filmagens em `public/videos`. Nada é baixado até a faixa chegar perto da viewport, e a reprodução para quando ela sai — 4K decodificando fora da tela é o jeito mais rápido de travar a página | `<video>` + IntersectionObserver |
| `Planet.tsx` | planeta 3D: bandas com duplo domain warp e tempestades, casca de nuvens girando mais rápido que a superfície, anel com lanes, rim light por shader fresnel, rig de três luzes | three.js, carregado sob demanda |
| `scenes/Aurora.tsx` | campo de cor que respira atrás do hero e do painel de contato — gradientes radiais em deriva elíptica | canvas 2D a meia resolução |
| `scenes/CoverArt.tsx` | seis pratos ilustrados, um por serviço: núcleo aceso dentro de figura orbital sobre papel milimetrado. Nenhum repete a geometria do outro | SVG estático |
| `scenes/ProductPanel.tsx` | o produto como objeto: mostrador em anel, curva suave que avança sozinha, três figuras | SVG + rAF |
| `scenes/PipelineScene.tsx` | diagrama de integração com pacotes viajando entre ERP/e-commerce/WhatsApp, o hub e financeiro/BI/estoque | SVG + `animateMotion` |
| `Starfield.tsx` | céu fixo atrás da página inteira, paralaxe por scroll em 3 profundidades | canvas 2D |
| `OrbitField.tsx` | casca de 1600 pontos em esfera de Fibonacci com satélites em órbitas inclinadas | canvas 2D |
| `Constellation.tsx` | constelação desenhada conforme você rola; cada nó é uma frente de atuação | canvas 2D |
| `Kinetic.tsx` | marcador tipográfico gigante que deriva com o scroll | CSS + Framer Motion |

As texturas do planeta estão em `src/lib/textures.ts` (fbm noise em `ImageData`, amostrado em círculo para não deixar costura no wrap).

Textura da página: grão de filme em `body::after` (SVG `feTurbulence` inline, 5% de opacidade). Sem ele os campos de azul aparecem em faixas em monitor barato.

Todos respeitam `prefers-reduced-motion`: desenham um frame e param.

### Peso

`three.js` só é baixado quando a seção do planeta se aproxima 400px do viewport — `PlanetStage.tsx` faz `IntersectionObserver` + `React.lazy`. O bundle inicial fica em ~119 kB gzip; o planeta é um chunk separado de ~132 kB.

Os dois vídeos somam ~40 MB e estão versionados no repositório. Se o histórico começar a incomodar, mova-os para Git LFS ou sirva de um CDN e troque só os caminhos em `src/lib/media.ts`.

### Trocar por foto ou vídeo real

Se um dia você tiver imagem própria, o lugar natural é o card do hero em `Hero.tsx` (hoje ocupado pelo `OrbitField` pequeno) e o objeto central do `VoidReveal` em `App.tsx` — os dois recebem qualquer `ReactNode`.

## Deploy

Saída estática em `dist/`. Vercel, Netlify ou Cloudflare Pages: build `npm run build`, diretório `dist`.
