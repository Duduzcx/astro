# Astro Soluções — site institucional

Landing page de uma página só. React 19 + TypeScript + Vite + Tailwind v4 + Framer Motion, com uma cena em three.js atrás do documento inteiro.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint     # oxlint
npm run build    # gera dist/
npm run preview  # serve o dist/
```

## Estrutura

```
index.html            metadados, ícones, JSON-LD e o espelho do formulário do Netlify
src/
  main.tsx            monta o React e liga o scroll suave
  App.tsx             ordem das seções da página
  index.css           tokens de cor, tipografia e utilitários do Tailwind
  lib/
    site.ts           dados da empresa e alvos de navegação
    scroll.ts         scroll suave (Lenis) e navegação por âncora
    useAutoPauseVideo.ts
  components/         uma seção por arquivo
    brand/AstroMark   o símbolo da marca em React
    scenes/Panels     as telas de produto fictícias usadas em ServiceBlocks
    ui/Primitives     botões, reveals, títulos animados, wrappers de seção
public/
  logo/               arquivos da marca
  media/              fotos e vídeos
tools/                gerador dos ícones PNG
```

Ordem das seções (definida em `App.tsx`): hero, marquee, serviços, integrações, manifesto, vídeo, missão, cenários, projetos, CTA do meio, processo, entregáveis, sobre, equipe, insights, FAQ, contato, rodapé.

## O que trocar antes de publicar

| Onde | O quê |
| --- | --- |
| `src/lib/site.ts` | e-mail, telefone, WhatsApp, cidade e as redes sociais quando existirem |
| `src/components/Projects.tsx` | os seis projetos são **conceitos fictícios**, marcados com o selo "Projeto conceito". Troque por casos reais (e tire o selo) quando o cliente autorizar o nome |
| `src/components/Cases.tsx` | os três cenários são exemplos genéricos de dor por segmento |
| `src/components/Insights.tsx` | os posts são de exemplo, até o blog existir |
| `index.html` | `<title>`, description, og:description e o domínio dentro do JSON-LD |

## Marca

Os arquivos ficam em `public/logo/`:

| Arquivo | Uso |
| --- | --- |
| `astro-mark.svg` | símbolo em degradê, para fundo claro |
| `astro-mark-light.svg` | símbolo em ivory, para fundo escuro |
| `astro-mark-navy.svg` | símbolo em navy sólido (também é o `mask-icon` do Safari) |
| `favicon.svg` | símbolo navy sobre placa branca — é o favicon do site |
| `favicon-64.png` | fallback do favicon para navegador sem suporte a SVG |
| `astro-badge.svg` | símbolo branco sobre placa navy, para avatar de rede social |

Dentro do React o símbolo é componente: `src/components/brand/AstroMark.tsx` exporta `AstroMark` (símbolo completo, com `tone` = `light` \| `gradient` \| `navy` \| `mono`) e `AstroStar` (só a estrela, usada como marcador no `Label`, no marquee e nas listas do FAQ). A geometria é a mesma dos SVGs em `public/logo/`: mudou num lugar, mude nos dois.

`public/apple-touch-icon.png` (180×180) e `public/og-image.png` (1200×630) saem de `tools/icon-generator.html`. Sirva a pasta por HTTP (`python -m http.server`), abra a página e capture cada placa no tamanho CSS exato.

## Sistema visual

Os tokens estão em `src/index.css`. Profundidade vem de degrau de superfície, nunca de sombra.

**Superfícies:** `onyx #0a0f1e` (página), `graphite #131b2e` (card), `obsidian #1b2740` (preenchimento clicável).

**Texto:** `ivory #f5f7fb` em título e nav, `ash #b9c2d4` no corpo, `slate #6d7a94` em label e legenda, `mist #e8edf5` em hover.

**Cor:** `cobalt #4d84e0` é a única. Preenche a ação principal, marca os eyebrows e pontua o campo de partículas.

**Tipografia:** Inter Tight no corpo (títulos em peso 480, nunca negrito), Anton nas frases de cartaz (`.font-impact`), Allura só na palavra "soluções" da assinatura, JetBrains Mono em label e dado técnico.

**Raio:** 16px no card, pill nos botões, 4px no que for pequeno.

Utilitários próprios: `.shell` (container), `.graphite-card` (vidro), `.label-voice`, `.font-impact`, `.giant-outline`, `.aurora`, `.text-spectrum`, `.text-spectrum-animated`, `.no-scrollbar`.

## A cena de fundo

`TriScene.tsx` desenha um canvas fixo atrás do documento inteiro. Cada seção é um estado da mesma cena, e o mesmo conjunto de triângulos passa por **três astros** ao longo da rolagem:

| Forma | Onde | Geometria | Cor |
| --- | --- | --- | --- |
| `0` planeta | hero | bola densa com três anéis inclinados em contra-rotação | azul cobalto e ivory |
| `1` buraco negro | "Seu negócio em novas órbitas" | horizonte vazio, anel de fótons e disco de acreção inclinado, mais rápido perto do centro | branco-quente, âmbar e laranja profundo |
| `2` estrela | nasce durante o contato | bola compacta com casca brilhante e coroa rala, cintilando | dourado e branco |
| `3` supernova | "A sua operação tem a resposta" | núcleo ralo, raios de ejeção e duas cascas de detonação que respiram | ouro, laranja, magenta e violeta |

Cada astro precisa estar **formado enquanto a seção dele está na tela**, e as duas tabelas trabalham em fração da página — que muda com a largura, porque o texto quebra diferente. Os números vieram de medição real: a Missão ocupa 0.222–0.294 no celular e 0.285–0.383 no desktop; o fechamento entra em 0.935 e 0.933. Mexeu na ordem ou no tamanho de alguma seção, remeça antes de confiar nesses valores.

As posições e as cores de cada astro vivem em atributos separados da mesma geometria (`aSphere`/`aHole`/`aStar`/`aNova` e os `a*Color` correspondentes); o uniform `uForm` anda de 0 a 3 e o shader interpola entre vizinhos. **Quase toda troca acontece com o campo disperso ou invisível**, então ninguém vê a costura. A exceção é proposital: a passagem 2 para 3 é feita agrupada e à vista — a estrela recém-nascida detona em supernova quando o fechamento entra, e o morph dos triângulos voando do corpo compacto para as cascas de detonação É a explosão.

Com blending aditivo não existe partícula escura: o preto do buraco negro é literalmente a ausência de triângulos no meio.

Duas tabelas de keyframes governam o movimento. Cada linha é `[progresso da página, dispersão, x, y, escala, opacidade, forma]`:

- `KEYFRAMES` — a partir de 1024px. O objeto ocupa a metade direita e se move, dispersa e reagrupa ao longo da página inteira.
- `mobileKeyframes()` — abaixo disso. O objeto fica atrás do texto e o `uClear` do shader reduz o alfa dentro de uma elipse que acompanha o bloco de texto do hero (medido no DOM, em `#hero-copy`). É isso que mantém a leitura limpa sem tapar o objeto com uma placa opaca. **A clareira só vale enquanto o hero está na tela** — dali para baixo o buraco negro e a supernova aparecem inteiros. Nos trechos entre os astros o campo cai para 10% de opacidade e vira grão de fundo, para não competir com os cards.

A ordem das seções em `App.tsx` e a tabela de desktop andam juntas: mexeu numa, refaça as medidas da outra.

Custo controlado: three.js entra num chunk separado por `React.lazy`; a contagem de triângulos e o pixel ratio caem em celular e em máquina de poucos núcleos; e há uma queda de qualidade automática se os primeiros frames vierem lentos. Com `prefers-reduced-motion` o movimento para.

**Redimensionamento tem duas metades.** O buffer do canvas acompanha a viewport em todo evento de resize: no celular a altura cresce ~60px quando a barra de URL recolhe, e um canvas do tamanho antigo deixa uma faixa sem desenho no pé da tela. Já a remedição de scroll fica atrás de uma guarda de 180px, porque `maxScroll` depende de `innerHeight` e recalcular no recolher da barra faz o progresso saltar e o objeto pular. O canvas também é esticado por CSS (`width/height: 100%`, com `setSize(..., false)`), então nem no intervalo de um frame sobra tela sem cobertura.

## Mídia

| Arquivo | Onde |
| --- | --- |
| `media/plexus.mp4` | `FilmBand` — só roda a partir de `md`, decodificar isso trava o scroll no celular |
| `media/office.mp4` | `About` |
| `media/alpine.jpg` | `CtaBand` |
| `media/insight-*.jpg` | `Insights` |

Os dois vídeos somam ~28 MB e estão versionados. Se o histórico começar a incomodar, mova para Git LFS ou para um CDN e troque só os caminhos.

## Formulário

O formulário de contato é do Netlify. O `index.html` carrega um espelho oculto com os mesmos campos porque o build só enxerga HTML estático — sem ele o Netlify não registra o formulário. O envio é feito por AJAX (POST urlencoded para a própria página).

**Se o deploy sair do Netlify, o formulário para de funcionar em silêncio**: o `catch` engole o erro e a tela de confirmação aparece mesmo assim. Nesse caso troque o `handleSubmit` em `Contact.tsx` pelo endpoint do novo provedor.

## Deploy

Saída estática em `dist/`. Build `npm run build`, diretório de publicação `dist`. O `netlify.toml` já traz o redirect de página única.
