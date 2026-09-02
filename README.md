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

`TriScene.tsx` desenha um núcleo orbital: uma bola densa de triângulos vazados com três anéis inclinados girando em velocidades e sentidos diferentes, mais uma camada ambiente sempre dispersa. É um canvas fixo atrás do documento; cada seção é um estado da mesma cena.

Duas tabelas de keyframes governam isso:

- `KEYFRAMES` — telas largas. O objeto se move, dispersa e reagrupa ao longo da página inteira.
- `MOBILE_KEYFRAMES` — telas em retrato (`aspect < 0.9`). Ali o objeto pertence ao hero: fica acima do título, dissolve quando você sai da primeira dobra e só volta no fechamento. Ocupando a página inteira ele virava sujeira atrás dos cards.

Cada linha é `[progresso da página, dispersão, x, y, escala, opacidade]`. A ordem das seções em `App.tsx` e essas tabelas andam juntas: mexeu numa, refaça as medidas da outra.

Custo controlado: three.js entra num chunk separado por `React.lazy`; a contagem de triângulos e o pixel ratio caem em celular e em máquina de poucos núcleos; e há uma queda de qualidade automática se os primeiros frames vierem lentos. Com `prefers-reduced-motion` o movimento para.

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
