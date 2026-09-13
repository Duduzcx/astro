# Cena espacial: do foguete à supernova

Data: 2026-09-13. Estado: aprovado.

## Objetivo

Trocar a sensação de "pontinhos na tela" por matéria: um foguete que decola no
hero, um planeta com superfície, um buraco negro com disco de acreção e uma
supernova que ilumina a interface. Tudo preso ao scroll, na cena WebGL fixa
que já existe, sem perder a fluidez medida no celular (0% de frames longos).

## Decisões fechadas

- Evoluir a `TriScene`, não reconstruir. Sem GSAP, sem ScrollTrigger: o
  amostrador de keyframes e o amortecimento por frame já fazem esse papel.
- Sem pós-processamento. Bloom vira halo aditivo; lente gravitacional vira o
  arco dobrado por geometria e shader. Um render target só, o da tela.
- Foguete estilizado por código, no visual da marca. Gancho para GLB.
- A estrela nascendo no Contato fica. Cadeia final: buraco negro, poeira,
  estrela, supernova.
- Trabalho em branch `feat/cena-espacial`, um PR por fase, preview do
  Netlify antes de ir para `main`.

## Narrativa por seção

Progresso é fração do scroll da página. Os valores de desktop são medidos na
tabela `KEYFRAMES`; os de celular saem de `mobileKeyframes`, em telas de
rolagem, como hoje.

| Seção | Cena |
|---|---|
| Hero | Foguete na plataforma, parte de baixo da tela (à direita no desktop, centro-baixo no celular). Sem planeta. Estrelas ao fundo. |
| Primeira tela de scroll | Decolagem: o foguete acelera para cima e sai por cima. Chama cresce, fumaça se espalha, câmera treme de leve e a tremida decai. Brilho da plataforma acende e apaga. |
| Serviços | Planeta entra pela borda direita, grande, meio cortado, opacidade média. Cards legíveis. No celular fica centralizado atrás do texto, com a clareira existente. |
| Manifesto | O encontro: planeta inteiro no centro, girando. No fim da seção ele racha e explode: a esfera se despedaça (vértices deslocados por ruído, alfa caindo) com um flash; a casca de triângulos se espalha. |
| FilmBand | Invisível. A forma dos triângulos troca para buraco negro aqui, como hoje. |
| Missão | Detritos dispersos são puxados para o buraco negro em espiral: o morph disperso → disco fica visível, com giro em torno do eixo do disco proporcional ao quanto falta agrupar. Disco de acreção e arco dobrado por cima. |
| Cases até FAQ | Campo disperso fraco, como hoje. Estrelas continuam descendo. |
| Contato | Poeira condensa em estrela, como hoje. |
| Fechamento | Estrela explode em supernova. Halo aditivo cresce; `--nova` sobe de 0 a 1 e o CSS do Contato e do rodapé esquenta o fundo. |

A camada de estrelas desce devagar com o scroll a página inteira e dá a
sensação de viagem entre as seções.

## Elementos

### Estrelas
`THREE.Points`, 1.200 pontos no celular e 2.400 no desktop, tamanho e brilho
por atributo, cor entre ivory e azul claro. Deslocamento vertical = progresso
× constante, com wrap. Um draw call, sempre visível.

### Foguete
Grupo com corpo (cilindro), nariz (cone), três aletas (extrusão simples),
bocal (cone invertido). Dois materiais: silhueta escura quase opaca
(`MeshBasicMaterial`, azul-onyx, opacidade 0,92) e arestas em
`LineSegments` (`EdgesGeometry`) em cobalto e ivory. Chama: cone aditivo com
`ShaderMaterial`, gradiente branco → laranja → transparente, ruído rolando no
tempo, comprimento por uniforme `uThrust`. Fumaça: `Points` com textura
circular gerada em canvas, 200 pontos, nascendo no bocal, caindo e abrindo,
alfa decaindo pela idade.

Estado por frame: `{ visible, y, thrust, opacity }`. `y` sai de uma janela
de progresso (0 a `takeoff`), com ease-in quadrática. `thrust` sobe rápido no
início da janela e cai a zero quando o foguete sai da tela. Tremor de câmera:
deslocamento aleatório de amplitude `thrust × 0,012` no `uCenter` dos campos
e na posição do foguete.

Gancho: `ROCKET_MODEL_URL` em `rocket.ts`. Preenchido, `GLTFLoader` (com
`DRACOLoader` apontando para `/draco/`) carrega o modelo, aplica a mesma
escala e esconde o estilizado quando pronto. Vazio, nada é baixado.

### Planeta
`SphereGeometry(0.62, 48, 32)` com `ShaderMaterial`:
- fbm de ruído simplex 3D em 5 oitavas para continentes; abaixo do limiar,
  oceano cobalto escuro; acima, gelo ivory com faixas azul claro.
- Terminador dia/noite por direção de luz fixa (`uLight`), lado noturno com
  0,08 de ambiente.
- Fresnel na borda em azul claro, expoente 3.
- Rotação lenta em Y no tempo.
- `uBreak` 0 → 1: vértices deslocados ao longo da normal por ruído × 0,9 ×
  `uBreak`, alfa = 1 − `uBreak`, cor aquecendo para laranja no meio do
  caminho.
Atmosfera: `SphereGeometry(0.7)` em `BackSide`, aditiva, fresnel puro em azul
claro, some com `uBreak`.

O raio 0,62 casa com a casca de triângulos do corpo (0,6 a 0,66): a casca
fica em volta como crosta. Anéis ficam.

### Buraco negro
Disco: anel plano (`RingGeometry` 0,45 a 1,7, 96 segmentos) inclinado no
mesmo plano `RING_NORMAL` dos triângulos, `ShaderMaterial` aditivo:
- brilho cai com o raio (1/r²), borda interna branca-quente, meio laranja,
  borda externa vermelho profundo (paleta `HOLE_*`).
- doppler: um lado 1,6× mais claro, o outro 0,5×, pela componente do vetor
  tangencial na direção da câmera.
- textura de ruído girando no tempo, mais rápido perto do centro.
- anel de fótons: linha fina branca em r = 0,42.
Arco dobrado: segundo anel, metade superior, rotacionado para ficar de pé
atrás do horizonte, mesma cor, alfa 0,6. Horizonte: disco preto opaco
(`CircleGeometry` 0,4) desenhado antes, sem blending, que apaga os triângulos
e as estrelas atrás.

Espiral de sucção: no vertex shader dos triângulos, quando `wHole > 0` e
`uMix` está entre 0,05 e 0,9, rotacionar `coreHole` em torno de `discAxis`
por `uMix × 2,4`. Já agrupado, sem giro extra.

### Supernova
Halo: `PlaneGeometry` billboard, `ShaderMaterial` aditivo. Radial: núcleo
branco (raio 0,12), coroa ouro → laranja → magenta (paleta `NOVA_*`), raios
pela função do ângulo com ruído, respiração leve no tempo. Escala 3,2 ×
`uScale` do campo. Opacidade = `wNova × opacidade do campo`.

`--nova`: a cena escreve `document.documentElement.style.setProperty('--nova',
v)` só quando `v` muda mais que 0,02. CSS: o fundo de `#contato` e do rodapé
vira `color-mix(in oklab, var(--color-onyx), #ff9e57 calc(var(--nova) * 14%))`.

## Keyframes

Tabela ganha duas janelas derivadas do progresso, não colunas novas:
- `rocketWindow(progress)`: `takeoff` = primeira tela de rolagem
  (`screen × 1,0` no celular, 0,035 no desktop).
- `breakWindow(progress)`: explosão do planeta no fim do Manifesto (desktop
  0,29 a 0,31; celular medido na fase 2).

Mudanças na tabela de desktop: hero sem planeta (opacidade do campo 0 até
`takeoff`, forma 0), Serviços com planeta na borda direita (`x` 0,95, escala
1,4, opacidade 0,55, `mix` 0,05), Manifesto agrupado no centro (`mix` 0,05,
opacidade 1), Missão com sucção visível (`mix` 0,9 → 0,05 entre 0,328 e
0,36). Celular: mesmas intenções em telas de rolagem, medido.

## Módulos

`src/components/scene/`:

| Arquivo | Responsabilidade |
|---|---|
| `TriScene.tsx` | Mount, renderer, palco (`100lvh`, FOV travado), loop, resize, amortecimento, compõe os módulos. |
| `keyframes.ts` | `KEYFRAMES`, `mobileKeyframes`, `sampleKeyframes`, `rocketWindow`, `breakWindow`. |
| `triangles.ts` | Paleta, âncoras, `buildTriangles`, shaders dos triângulos, `makeMaterial`. |
| `stars.ts` | Camada de estrelas. |
| `rocket.ts` | Foguete, chama, fumaça, gancho GLB. |
| `planet.ts` | Esfera, atmosfera, quebra. |
| `blackhole.ts` | Horizonte, disco, arco. |
| `nova.ts` | Halo e `--nova`. |

Cada módulo exporta `create(opts) => { object: THREE.Object3D, update(state, time), dispose() }`
e liga `object.visible` só dentro da sua janela. `state` é o objeto `current`
amortecido mais `progress`, `rush`, `halfWidth`, `narrow`.

`src/components/TriScene.tsx` passa a reexportar de `scene/TriScene.tsx`
para o `lazy()` do `App.tsx` não mudar.

## Orçamento e verificação

- Draw calls no pico: 12 (hoje 2). Nenhum render target além da tela.
- DPR, contagem de triângulos e `considerDowngrade` como hoje. O downgrade
  também esconde a fumaça e reduz as estrelas pela metade.
- Depois de cada fase: rolagem automatizada por rAF em 400 px e 1280 px,
  registrando intervalo médio, p95, pior e % acima de 24 ms. Meta: celular
  igual ao atual (0% acima de 24 ms), desktop sem piorar.
- `tsc`, `oxlint`, `build` limpos a cada fase.
- Conferência visual no preview: hero, decolagem, Serviços, Manifesto,
  explosão, Missão, Contato, fechamento, nas duas larguras.

## Fases

1. Modularizar sem mudança visual. Estrelas. Foguete e decolagem.
2. Planeta com shader, encontro no Manifesto, explosão.
3. Disco de acreção, arco dobrado, horizonte, sucção em espiral.
4. Halo da supernova, `--nova`, CSS aquecendo.
5. GLB real quando existir; `/draco/` no `public/`.

## Fora do escopo

Lente gravitacional real, bloom real, modelo 3D comprado, mudanças de texto
das seções, fontes self-hosted, LGPD, compressão dos vídeos (itens da
auditoria, pendentes por outro motivo).
