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
    scene/            a cena WebGL: TriScene (mount e loop), keyframes (tabelas),
                      triangles (matéria e shaders), stars, rocket
    scenes/Panels     as telas de produto fictícias usadas em ServiceBlocks
    ui/Primitives     botões, reveals, títulos animados, wrappers de seção
tests/                funções puras da cena, `npm test` (node --test)
docs/superpowers/     spec e planos da cena espacial
public/
  logo/               arquivos da marca
  media/              fotos e vídeos
tools/                gerador dos ícones PNG
```

Ordem das seções (definida em `App.tsx`): hero, marquee, serviços, integrações, manifesto, vídeo, missão, cenários, projetos, CTA do meio, processo, entregáveis, sobre, equipe, insights, FAQ, contato, rodapé.

## O que trocar antes de publicar

| Onde | O quê |
| --- | --- |
| `src/lib/site.ts` | e-mail, telefone, WhatsApp, Instagram e cidade |
| `src/components/Projects.tsx` | só projeto publicado e autorizado: Compromisso (`compromissose.com`) e Neve na Nave (`nevenanave.netlify.app`). Para incluir outro, print da home em 1280×800 dentro de `public/media/projects/` (a CSP só aceita imagem do próprio domínio) e uma entrada na lista `projects` — todos os campos são obrigatórios, inclusive `url` |
| `src/components/Cases.tsx` | os três cenários são exemplos genéricos de dor por segmento |
| `src/components/Insights.tsx` | os posts são de exemplo, até o blog existir |
| `index.html` | `<title>`, description, og:description e o domínio dentro do JSON-LD |

## Marca

Os arquivos ficam em `public/logo/`:

O símbolo é um disco recortado em quatro pétalas; o vão entre elas desenha uma estrela de quatro pontas. As fendas têm largura constante do centro à borda, então a marca não deforma na redução. **Uma pétala só é desenhada** — as outras três são a mesma path girada em 90°.

| Arquivo | Uso |
| --- | --- |
| `astro-mark.svg` | tonal: as quatro peças giram em tom, do azul claro no topo ao marinho embaixo. Fundo claro |
| `astro-mark-duo.svg` | dois tons alternados, mais gráfica e mais barata de imprimir. Fundo claro |
| `astro-mark-navy.svg` | traço único em navy (também é o `mask-icon` do Safari) |
| `astro-mark-light.svg` | negativo, tudo branco. Fundo escuro |
| `astro-mark-night.svg` | branco e azul alternados — é a do site, guarda a cor que o branco puro perde |
| `favicon.svg` | tonal sobre placa branca — é o favicon do site |
| `favicon-32.png` · `favicon-64.png` · `favicon-180.png` · `favicon-512.png` | favicon em PNG, **tonal** sobre placa branca. Gerados por `tools/favicon-png.html` |
| `astro-badge.svg` | negativo sobre placa navy, para avatar de rede social |

Paleta: `#0B2545` marinho, `#1E86CF` azul, `#2E5A87` aço, `#5B7A99` cinza-azul.

Dentro do React o símbolo é componente: `src/components/brand/AstroMark.tsx` exporta `AstroMark` (com `tone` = `tonal` \| `duo` \| `mono` \| `negative` \| `night`) e `AstroStar` (só a estrela — o mesmo vão da marca remontado como contorno próprio, usada como marcador no `Label`, no marquee e nas listas do FAQ). A geometria é a mesma dos SVGs em `public/logo/`: mudou num lugar, mude nos dois.

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

O que separa "trabalho de escola" de "futuro" nessa cena não é resolução, é linguagem: partículas viraram poeira fina em vez de triângulos grandes, o foguete tem luz de chave quente, contorno azul por trás e a luz do próprio motor batendo na saia, a atmosfera tem limbo fino e névoa larga, o sol do hero é um clarão macio, e o HUD de telemetria dá a leitura de missão.

A cena mora em `src/components/scene/`: `TriScene.tsx` (mount, palco, loop), `keyframes.ts` (tabelas e funções puras, testadas com `npm test`), `triangles.ts` (a matéria e os shaders), `stars.ts` (estrelas ao fundo, descendo com o scroll), `rocket.ts` (foguete, chama, fumaça, brilho da plataforma, gancho GLB em `ROCKET_MODEL_URL`) `planet.ts` (o planeta de verdade), `blackhole.ts` (horizonte, disco de acreção e arcos), `nova.ts` (halo da supernova), `space.ts` (o céu: panorama da Via Láctea numa esfera virada para dentro, sobre o onyx da página, girando devagar com o scroll), `postfx.ts` (só no desktop: bloom em meia resolução com limiar alto — só motor, disco, núcleo da supernova e limbo da atmosfera sangram luz — mais vinheta e grão de filme) e `glsl.ts` (ruído simplex compartilhado). `src/components/TriScene.tsx` só reexporta.

É um canvas fixo atrás do documento inteiro contando uma história: a humanidade saindo da Terra rumo à tecnologia. O hero é a Terra — um horizonte curvo no pé da tela (o mesmo `planet.ts` com `kind: 'earth'`: oceano, continentes, nuvens, calotas, luzes de cidade na noite, atmosfera), satélites em órbita (`satellites.ts`) e o foguete na superfície. A Terra fica longe da câmera (z −9,9) com tamanho e posição aparentes convertidos por perspectiva, porque perto uma esfera desse tamanho atravessaria a lente; e deitada 90°, porque de pé o horizonte mostrava a calota polar. Na primeira tela de rolagem o foguete decola (`takeoffSpan`, `rocketWindow`) e a Terra recua e some. O foguete é um lançador pesado de três núcleos, no estilo dos veículos reutilizáveis de hoje: núcleo central com interestágio preto, segundo estágio e coifa larga; dois propulsores laterais com cone presos ao núcleo por presilhas; pernas de pouso recolhidas ao longo dos três corpos, grid fins com lâminas cruzadas no alto, nove motores por núcleo (vinte e sete sinos num `InstancedMesh`), canalizações, fuligem na saia. Cada corpo é um torneado (`LatheGeometry` com pontos igualmente espaçados em altura, para o v da textura correr linear) com dois canvases: cor (painéis, costuras dos tanques com rebites, escotilhas, interestágio preto, linha cobalto, fuligem, marca e bandeira) e rugosidade. Tinta branca acetinada (metalness baixo, base cinza-clara porque sem tone mapping no composer o branco iluminado passa de 1,0 e vira neve no bloom) iluminada pelo sol da cena e pelo mapa de ambiente (`PMREMGenerator` + `RoomEnvironment`). Largo por escolha: o veículo fino de antes lia como brinquedo; três corpos lado a lado leem como lançador. Na plataforma ele só balança devagar mostrando os três corpos de frente; na subida gira inteiro. Em cruzeiro voa só o segundo estágio com a coifa e um motor de vácuo, recentrado para o eixo de inclinação passar pelo meio dele. Antes disso foram testados um foguete torneado de tinta acetinada com nove diâmetros e um veículo de aço escovado com telhas pretas; os modelos livres da NASA (Saturn V com bandeiras dos EUA, Ares e Atlas cinza sem textura, SLS só em 7z de 74 MB) não serviam para a marca. Os planetas usam fotografia (`public/space/`, Solar System Scope, CC BY 4.0: Terra de dia e de noite, nuvens, Júpiter, Marte, Lua com tinta azul virando lua de gelo, Netuno com as nuvens da Terra como alvo, anel de Saturno) por cima do procedural, que segue valendo enquanto a textura carrega; escurecimento de borda, terminador quente, especular na água, luzes de cidade fotografadas, nuvens numa esfera própria girando em outro ritmo, e o anel do gigante recebe a sombra do planeta. A Terra tem ainda mapa normal (relevo fotografado no quadro tangente analítico da esfera; o mapa da Solar System Scope tem o verde apontando para o sul, daí o sinal invertido em y), máscara de água fotografada para o especular, sombra das nuvens no chão (de cada ponto da superfície sobe na direção da luz até uma casca de nuvens mais alta que a real e amostra a foto das nuvens com `textureLod`, sem risco na costura de longitude) e névoa da atmosfera sobre a superfície perto da borda. A casca da atmosfera é fina por tipo (`KIND_SHELL`: 5,5% do raio na Terra, 7% no alvo): o shader mede, na casca `BackSide`, o cosseno entre normal e visada, que vai de zero na borda externa até um valor fixo na borda do planeta, e pinta só essa faixa, clara colada ao limbo e sumindo para fora; atrás do planeta a profundidade da superfície oclui. A redoma larga de antes (16% do raio) foi o que o cliente pediu para diminuir. Relevo por derivadas de tela só no procedural: a derivada de uma amostra bilinear é constante por texel e vira mosaico; chama em duas camadas, fumaça de 200 pontos na CPU, tremor de câmera. O foguete se move de verdade: curva de gravidade (sobe reto e vai tombando para o centro da tela com o eixo no rumo, `arcAt`/`tiltAt` em `TriScene.tsx`), deriva e balanço no tempo, bocal com gimbal, giro lento até na plataforma e vapor de respiro escapando do casco antes da ignição. A inclinação mora num grupo pai e o giro no filho: no mesmo objeto a ordem de Euler faz a inclinação girar junto com o giro, e o bico aponta para fora do rumo metade do tempo. O rastro (`trail.ts`) é uma fita analítica: em vez de guardar posições por frame (que enrolam quando o scroll volta), amostra a própria trajetória um trecho atrás do bocal, quente e estreita na cabeça, larga e rala na cauda, com ruído correndo para trás; no cruzeiro a cauda quase não abre, porque é vácuo. Pelos Serviços e Integrações passa o desfile: Saturno com o anel, Marte, Júpiter enorme e longe, e a Lua com tinta azul virando lua de gelo (`planet.ts` com `kind` gas/rock/ice), cada um na sua profundidade e janela de progresso, entrando por cima e saindo por baixo, com a nave em cruzeiro (`createRocket({ cruise: true })`) varrendo a tela de um lado ao outro entre eles, subindo, chegando perto e se afastando (escala pela fase da curva), com o eixo no rumo e o rastro atrás. O planeta-alvo chega no Manifesto, fica inteiro pela faixa de vídeo e explode na Missão ("Seu negócio em novas órbitas"), à vista; o buraco negro nasce nos Resultados e fica pelos Projetos. É uma esfera com shader dentro da casca de triângulos: superfície por ruído simplex (oceano cobalto, gelo ivory, calotas, nuvens lentas), terminador dia/noite com luz fixa em espaço de câmera, especular no oceano, fresnel azul na borda e uma segunda esfera `BackSide` aditiva como atmosfera. A superfície grava profundidade e desenha antes dos triângulos, então a metade de trás da casca some e sobra a crosta da frente. A explosão não tem janela própria: `planetBreak(mix, form)` lê o estado do campo, e o planeta se despedaça (vértices voando por normal × ruído, cor esquentando, atmosfera inchando num flash) exatamente quando os triângulos dispersam. Dali o mesmo conjunto de triângulos passa pelos astros:

| Forma | Onde | Geometria | Cor |
| --- | --- | --- | --- |
| `0` planeta | serviços e manifesto | esfera com shader dentro de uma bola densa com três anéis inclinados em contra-rotação | azul cobalto e ivory |
| `1` buraco negro | da Missão aos Projetos: nasce pequeno, cresce engolindo os detritos e fica pelos Cenários inteiros | por cima dos triângulos, `blackhole.ts`: esfera preta opaca que tapa tudo atrás, disco de acreção em shader no mesmo plano dos anéis (borda interna branca-quente, doppler pela tangente em espaço de câmera, estrias girando mais depressa perto do centro, anel de fótons) e dois arcos de pé atrás do horizonte, o visual do Interstellar sem passe de lente. Os detritos chegam em espiral: o alvo no disco gira com a dispersão no vertex shader | branco-quente, âmbar e laranja profundo |
| `2` estrela | nasce durante o contato | bola compacta com casca brilhante e coroa rala, cintilando | dourado e branco |
| `3` supernova | "A sua operação tem a resposta" | núcleo ralo, raios de ejeção e duas cascas de detonação que respiram; atrás delas, `nova.ts`: um disco aditivo com núcleo pequeno, coroa do ouro ao violeta e raios por ângulo torcidos por uma onda lenta — o bloom sem passe de bloom. A cena escreve `--nova` (0 a 1) no `:root` no máximo a cada 80ms, e o CSS esquenta o contato e o rodapé por pseudo-elementos com opacidade em camada própria (trocar a cor de um gradiente repintava a seção inteira a cada frame) | ouro, laranja, magenta e violeta |

Cada astro precisa estar **formado enquanto a seção dele está na tela**, e as duas tabelas trabalham em fração da página — que muda com a largura, porque o texto quebra diferente. Os números vieram de medição real (400×820 e 1280×900): a Missão ocupa 0.267–0.307 no celular e 0.334–0.383 no desktop; o Manifesto 0.226–0.242 e 0.257–0.299; o fechamento do rodapé entra na tela em 0.93. Mexeu na ordem ou no tamanho de alguma seção, remeça antes de confiar nesses valores — foi o que aconteceu quando os projetos conceito saíram: a página encurtou e o buraco negro passou a se formar ainda no Manifesto.

As posições e as cores de cada astro vivem em atributos separados da mesma geometria (`aSphere`/`aHole`/`aStar`/`aNova` e os `a*Color` correspondentes); o uniform `uForm` anda de 0 a 3 e o shader interpola entre vizinhos. **Quase toda troca acontece com o campo disperso ou invisível**, então ninguém vê a costura. A exceção é proposital: a passagem 2 para 3 é feita agrupada e à vista — a estrela recém-nascida detona em supernova quando o fechamento entra, e o morph dos triângulos voando do corpo compacto para as cascas de detonação É a explosão.

Com blending aditivo não existe partícula escura: o preto do buraco negro é literalmente a ausência de triângulos no meio.

Duas tabelas de keyframes governam o movimento. Cada linha é `[progresso da página, dispersão, x, y, escala, opacidade, forma]`:

- `KEYFRAMES` — a partir de 1024px. Campo apagado no hero (só foguete e estrelas), planeta na borda direita nos Serviços, no centro no Manifesto, e dali se move, dispersa e reagrupa ao longo da página inteira.
- `mobileKeyframes()` — abaixo disso. O objeto fica atrás do texto e o `uClear` do shader reduz o alfa dentro de uma elipse que acompanha o bloco de texto do hero (medido no DOM, em `#hero-copy`). É isso que mantém a leitura limpa sem tapar o objeto com uma placa opaca. **A clareira só vale enquanto o hero está na tela** — dali para baixo o buraco negro e a supernova aparecem inteiros. Nos trechos entre os astros o campo cai para 10% de opacidade e vira grão de fundo, para não competir com os cards.

A ordem das seções em `App.tsx` e a tabela de desktop andam juntas: mexeu numa, refaça as medidas da outra.

Custo controlado: three.js entra num chunk separado por `React.lazy`; a contagem de triângulos e o pixel ratio caem em celular e em máquina de poucos núcleos; e há uma queda de qualidade automática se os primeiros frames vierem lentos. Com `prefers-reduced-motion` o movimento para.

**Telas de produto vivas.** Cada painel de `scenes/Panels` se monta quando entra na tela, uma vez: o gráfico do dashboard se desenha (`pathLength`) e ganha uma ponta que pulsa, os números contam, a vitrine entra card a card com um brilho varrendo as fotos, a conversa do WhatsApp cai balão a balão com o "digitando" antes de cada resposta, as sparklines da telemetria se traçam sob um radar que varre o painel, e no hub de integração os pacotes de dados correm pelas curvas (`<animateMotion>`, SMIL nativo — segue a curva exata sem custo de layout) enquanto o centro respira num anel que se expande. Loops só em transform, opacidade e traço de SVG.

**Medições.** Rolagem automatizada em passos de 14px, segunda passada, frames acima de 24ms. 14/09/2026, cena v2 (Terra, foguete torneado, desfile, buraco negro longo): 400px 0,7% no total, 0% na viagem e 0% no buraco negro; 1280px medido numa máquina que naquela noite dava 13–24% até para o build anterior, então sem número confiável — o trecho do buraco negro é o mais pesado do desktop e por isso o disco de acreção perdeu o ruído por pixel e 20% do raio. 13/09/2026, com estrelas, foguete, planeta com shader e buraco negro — 400px 0,06% (p95 16,8ms, pior 33ms), 1280px 1,5% (p95 16,9ms, pior 50ms). Fase 2 (sem o buraco negro): 0% e 1,0%. Fase 4 (halo da supernova) medida em A/B contra a fase 3 na mesma máquina, já mais lenta à noite: 400px 0,6% vs 0,7% no total e 6,0% vs 6,3% no último décimo da página; 1280px 13–24% vs 13–17%. Ou seja, o halo não custa nada mensurável; o que pesa no fim da página é o morph dos triângulos para a supernova, e existe desde antes. Fase 1 (só estrelas e foguete): 0,06% e 2,4%. Antes da cena espacial: 0% e 12%.

**Como medir antes de otimizar.** Um `requestAnimationFrame` que rola a página em passos fixos e guarda o intervalo entre frames dá p95, pior frame e porcentagem de frames acima de 24ms. Duas armadilhas: a primeira passada mede decodificação de mídia, não animação (rode duas vezes e compare), e desligar um efeito por vez no console é o único jeito de saber quem custa o quê — foi assim que o `skewY` dos grids apareceu valendo 13 pontos de frames longos por um efeito que quase ninguém nota.

**O que ficou de fora por medição.** `content-visibility: auto` nas seções parecia o maior ganho estrutural, mas o `contain-intrinsic-size` mudou a altura da página em 3.400px — e as tabelas de keyframes da cena trabalham em fração da página, então os astros sairiam do lugar. Revertido.

**Custo do movimento no celular.** Efeito que reage ao scroll só entra se não pagar em frames: o `DecodeText` escreve direto no nó e a 15fps (era um `setState` por frame, por eyebrow — a maior fonte de travamento), `useScrollLean` e o shear do marquee devolvem zero abaixo de 1024px (`skewY`/`skewX` repintam o bloco inteiro a cada frame), e o `TriangleDrift` cacheia o gradiente no resize em vez de alocar dois por frame em seis canvases.

**Scroll como entrada.** Quatro coisas reagem à rolagem além dos reveals: (1) a velocidade do scroll entra na cena como `uRush` — arrastar rápido acelera a rotação dos astros, amplia a deriva das partículas e afrouxa um pouco o agrupamento, tudo decaindo devagar quando o dedo para; (2) os grids de projetos, cenários e entregáveis inclinam uns graus com a velocidade (`lib/useScrollLean`, mola sobre `useVelocity`, só `skewY`); (3) os eyebrows se decodificam ao entrar na tela (`DecodeText` em Primitives: glifos aleatórios assentando da esquerda para a direita em 600ms, largura mínima em `ch` para não pular).

**Movimento entre seções.** `ui/TriangleDrift` é a costura feita da mesma matéria dos astros: triângulos vazados pequenos numa corrente lenta ao longo de um fio de um pixel, cada um derivando, balançando e girando devagar, e a cada ~7s um pulso de luz percorre o fio e acende quem está perto. Canvas 2D, só anima enquanto está na tela, para na aba escondida, frame parado com `prefers-reduced-motion`.

**O palco tem altura fixa e só cresce.** A barra de URL do celular recolhe e volta o tempo todo durante o scroll. Qualquer coisa amarrada a `innerHeight` — projeção da câmera, buffer do canvas, `maxScroll` — muda junto, e o objeto salta de tamanho de um frame para o outro. Então o canvas nasce com `100lvh` — o viewport grande, já com a barra recolhida — e é dimensionado pela MAIOR altura já vista (`stageHeight`), fica `fixed top-0` com essa altura em pixels, e `maxScroll` é medido contra ela. Quando a barra some, a tela apenas revela mais de um canvas que já estava desenhado ali: nada reprojeta, nada salta, e não sobra faixa sem desenho. Se ainda assim o palco precisar crescer, `sizeStage` recalcula o FOV vertical para manter a mesma largura de mundo visível: pixels por unidade de mundo não mudam, logo o tamanho do objeto também não. Só uma mudança de **largura** (girar o aparelho, redimensionar a janela) refaz a cena.

**Nada de arrasto lateral.** `overflow-x: clip` no `html` e no `body`, não `hidden`: `hidden` corta a sobra mas cria um container rolável, e o dedo continua arrastando a página de lado sem barra para denunciar. `clip` corta sem criar container. Somado a `touch-action: pan-y` no `body`, o toque só rola na vertical.

**Cauda plana nas tabelas.** Da última transição até 1.0 as linhas são idênticas. No pé da página o scroll treme, e sem isso a tremida virava mudança de tamanho na supernova.

## Mídia

Texturas dos astros e do céu em `public/space/`: Solar System Scope (CC BY 4.0, https://www.solarsystemscope.com/textures/), re-encodadas com `sharp-cli` em três degraus (1k, 2k, 4k) a partir das fontes em 8k (Terra dia/noite/nuvens, Júpiter, Saturno, Marte, Lua, Netuno, anel, Via Láctea). A cena carrega o 1k primeiro e substitui pelo pesado quando chega: 4k no desktop (~7,6 MB no total), 2k no celular (uma textura 4k com mipmaps são 32 MB de GPU). A Terra tem também mapa normal (1k/2k/4k) e máscara especular (1k/2k) da mesma fonte, convertidos do TIFF de 8k, e um terceiro degrau de 8k no mapa de dia (`ultra`, só desktop com `deviceMemory` ≥ 8: são ~180 MB de GPU com mipmaps). 8k é o teto das fontes livres; 10k ou 20k não existem em licença aberta e passariam do limite de textura de muita GPU. No celular só a Terra passa de 1k (2k): cada upload de textura trava o thread principal e vira tranco no scroll. O crédito está no rodapé. O céu (`space.ts`) roda em intensidade 0,75 sobre o onyx da página e, no desktop, soma nebulosas procedurais (dois véus de ruído simplex em cobalto e violeta, mais fortes longe da faixa da galáxia, girando com o céu). Uma versão mais escura do céu foi testada e recusada: o fundo é parte da identidade. Quem escurece por baixo do texto é a `.scene-scrim` (App.tsx): um véu fixo entre a cena e o conteúdo, uniforme no celular e em gradiente no desktop (mais denso à esquerda, onde o texto mora), que não toca o canvas. No desktop o pós ainda desfoca os cantos (oito amostras num anel que cresce com a distância do centro e com a velocidade do scroll), e os `Reveal` chegam desfocados (`filter: blur`) só em tela larga, porque animar filtro repinta o bloco a cada frame. No celular a cena desenha a 30fps sempre, sem MSAA, com menos triângulos, estrelas e fumaça, e sem mapa normal nem máscara de água na Terra: metade do trabalho por frame no thread principal, para o scroll nativo por cima ficar liso.

| Arquivo | Onde |
| --- | --- |
| `media/plexus.mp4` | `FilmBand` — só roda a partir de `md`, decodificar isso trava o scroll no celular |
| `media/office.mp4` | `About` |
| `media/alpine.jpg` | `CtaBand` |
| `media/insight-*.jpg` | `Insights` |

Os dois vídeos somam ~28 MB e estão versionados. Se o histórico começar a incomodar, mova para Git LFS ou para um CDN e troque só os caminhos.

## Formulário

**Scroll suave só no ponteiro fino.** Em tela de toque o Lenis intercepta o gesto e roda o scroll por JS: num arrastão rápido a página anda atrás do dedo e parece travamento. O celular usa o scroll nativo, que já tem inércia própria. Junto disso, `overscroll-behavior-y: none` e a cor de fundo no `html` matam a faixa que aparecia no pé do site — o vão do elástico pinta o fundo do `html`, não o do `body`, e não tem camada fixa atrás.

## Formulário

O formulário de contato é do Netlify. O `index.html` carrega um espelho oculto com os mesmos campos porque o build só enxerga HTML estático — sem ele o Netlify não registra o formulário. O envio é feito por AJAX (POST urlencoded para a própria página).

**Se o deploy sair do Netlify, o formulário para de funcionar em silêncio**: o `catch` engole o erro e a tela de confirmação aparece mesmo assim. Nesse caso troque o `handleSubmit` em `Contact.tsx` pelo endpoint do novo provedor.

## Deploy

Saída estática em `dist/`. Build `npm run build`, diretório de publicação `dist`. O `netlify.toml` já traz o redirect de página única.
