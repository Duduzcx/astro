# Sessão dedicada: qualidade dos planetas, do fundo e do movimento

Briefing para uma sessão nova trabalhar a cena 3D da landing page da Astro
Soluções. Escrito em 18/09/2026, com `main` em `9e88817`.

## Contexto de negócio

O site entra em uso oficial na segunda-feira, 21/09/2026. O cliente é o dono
da agência e julga a cena como diretor de arte, não como desenvolvedor. As
referências de acabamento que ele cita são mercury.com e oryzon.ai. A frase
que ele usa quando não gosta é "parece maquete de escola".

**O celular é a prioridade.** É por onde a maioria dos visitantes chega. O
desktop está aprovado e não deve mudar sem pedido explícito.

## Estado atual da direção de arte

Duas linguagens convivendo, de propósito:

| Elemento | Acabamento |
| -------- | ---------- |
| Terra | Fotográfico (NASA), com nuvens, luzes de cidade e relevo |
| Sol, buraco negro, supernova, explosão | Fotográfico, shaders próprios |
| Foguete | Modelo GLB real (Starship), Draco, intocado por pedido do cliente |
| Marte, Júpiter, Saturno | Ilustração: sem nenhuma textura, rampa de cor em degrau |

A rampa de luz dos três mundos ilustrados é **deslocada de propósito**
(`facing * 0.55 + 0.42`, nove degraus): centrada em 0,5 ela gastava metade
dos degraus no hemisfério invisível, e 64% do disco caía em duas faixas que
diferiam 16% — era essa a causa de Saturno ler chapado. Junto com isso,
o posterizador por canal está fora do caminho TOON (ele existe para domar
fotografia, e ali não há textura), o limbo tem piso e expoente próprios, e
há um lustro fraco em dois degraus no vetor médio. **Não desfaça nenhum dos
quatro procurando "mais faixas": as faixas nunca foram o problema.**

Marte NÃO usa nada disso. Ele foi devolvido ao acabamento anterior a pedido
do cliente, e a separação é feita por `bool gigante = uToonBands > 0.5` —
uniforme, não `#define`. Isso importa: os três mundos ilustrados continuam
num único programa, e a armadilha dos 150ms não é acionada, porque todos os
fragmentos de um mesmo desenho seguem o mesmo ramo. A reversão foi
conferida contra o commit `af1fa62` num worktree separado: saturação 0,833 e
matiz 17,3 graus idênticos, luminância 51,2 contra 51,6.

Duas medidas de Saturno que explicam a cor, para não se perderem:

- A mancha vermelha de Júpiter estava em Saturno o tempo todo. O portão era
  `uToonBands > 9.5` e Saturno tem DOZE faixas. Hoje é `> 10.5 && < 11.5`.
  Ela somava `vec3(0.12, 0.03, 0.0)`, e era boa parte do "barro".
- As faixas são **cinco** degraus, não dez. Entre `uToonA` e `uToonB` há
  (43, 62, 83) em 8 bits; por dez, cada degrau muda uns 6 de 255 e o olho
  não separa isso numa tela de mão — as faixas dissolvem e é isso que lê
  como borrão. Mais degraus não é mais qualidade aqui.

Medido no disco antes e depois: saturação 0,53 para 0,15 (a paleta define
0,11 a 0,26 — antes a tela estava MAIS saturada que qualquer um dos tons),
matiz 29 para 39 graus e luminância mediana 101 para 127.

**Saturno tem referência fechada**, escolhida pelo cliente: o modelo "Saturn"
de Nestaeric no Sketchfab (`c09a1970148c43ad99db134a9d6d00b5`). A miniatura
sai pela API — `api.sketchfab.com/v3/models/<id>`, campo `thumbnails` — e
vale baixá-la antes de discutir a cor. O que define aquele visual: corpo de
alta chave, quase branco no topo; faixas largas e macias, de larguras
DESIGUAIS e baixo contraste; um cinturão malva abaixo do equador, que é a
assinatura; terminador longuíssimo sem degrau; nenhum fio de contorno no
limbo; e anéis de gelo quase brancos e densos, em trechos mais claros que o
planeta.

**Marte também tem referência fechada**: o modelo "Mars" do mesmo autor
(`25b3f6f993de4f978de290b6e755ba87`). Ela é salmão quente indo a quase
branco no ponto forte, terminador longo e AZUL-ARDÓSIA, manchas escuras
largas e de contorno solto, e grão fino de cratera por toda a superfície.

O achado que resolveu Marte vale para qualquer superfície procedural:
**quantizar uma função lisa não produz manchas, produz CURVAS DE NÍVEL.**
Em torno de cada extremo da soma de senos nascem anéis concêntricos, e era
daí que vinha o aspecto de mapa topográfico e de rosquinha que sobreviveu a
todas as mudanças de paleta. Subir de cinco para dez degraus PIOROU, porque
só multiplicou os anéis. Marte hoje não é quantizado.

O segundo: **produto de dois senos é uma treliça regular.** Com amplitude
alta o grão deixou de ler como cratera e virou estampa de leopardo, com
tongas escuras repetidas na diagonal. A fase dele é empurrada pela escala
grande justamente para desalinhar a grade. Grão de verdade pediria ruído
simplex, que o caminho PHOTO_ONLY não compila — e isso tem preço, então
não entre nele sem medir.

Por isso Saturno tem seu próprio ramo (`saturno = uToonBands > 11.5`) e
Júpiter não o segue: piso de luz 0,30, degrau de luz em 10%, expoente 0,78
na rampa, piso de limbo 0,74, contorno em 0,22 e oito degraus de faixa. É
direção de arte, não acaso — não "unifique" isso com Júpiter.

Os três mundos de passagem usam `toon: { a, b, c, bands }` em
`createPlanet`. `bands` acima de zero dá o listrado de gigante gasoso; zero dá
manchas largas de mundo rochoso. Cores atuais em `TriScene.tsx`, no array
`worlds`.

O que a rampa já faz: três frequências de faixa mais uma ondulação em
longitude, dez degraus de tom com a borda acompanhando um pixel de tela
(`fwidth`), calota clara nos polos, mancha característica no gigante, e um
Fresnel de duas camadas (fio branco apertado na quina iluminada, faixa fria
larga descendo pelo lado escuro).

O anel de Saturno é vetorial: aros concêntricos em degrau, sem ruído, com a
grande falha aberta como vazio.

## Números de referência

Medidos num iPhone 13 emulado com a CPU quatro vezes mais lenta:

| Métrica | Valor |
| ------- | ----- |
| Custo médio por quadro | 33,7ms (mediana de três corridas) |
| Pior quadro da rolagem | 183 a 300ms, conforme a corrida |
| Maior travada da abertura | 1126ms |
| Cena visível | ~1870ms |
| Razão de pixels no celular | 1,75 |
| MSAA no celular | ligado (custa +0,4ms, medido) |
| Rolagem no toque | `touchMultiplier` 1,25, `syncTouchLerp` 0,06, `touchInertiaExponent` 1,5 |
| Céu do celular | 2k regravado do 4k, 29 kB |

**Não regrida isso sem justificativa visual proporcional, medida.**

## Ferramentas

```
node scripts/height-probe.mjs <url> <px> [device]   custo por quadro e altura
node scripts/load-probe.mjs <url> [device]          carga e maior travada
node scripts/section-heights.mjs <url>              alturas das seções
node scripts/shot.mjs <url> <larg> <alt> <frações> <prefixo>
node scripts/naked-shot.mjs <saída> <fração>       captura com o DOM escondido
```

Servir com `npm run build && npm run preview`. **O preview sobe em
`[::1]:4173`; `127.0.0.1` não responde.**

## Armadilhas já pagas — não repita nenhuma

**Validar só no local mente.** O `vite preview` não manda CSP nenhum. Um
bloqueio de `blob:` no `netlify.toml` impediu o worker do Draco de rodar e o
foguete caía no procedural — só em produção, por semanas. Valide contra
`https://astrosolucoes.netlify.app/` antes de dizer que algo funciona.

**`syncTouchLerp` não atrasa o dedo.** Com `syncTouch`, o Lenis força
`lerp: 1` enquanto o dedo está na tela e só usa `syncTouchLerp` no
`touchend` (`lenis.mjs:633`). Baixá-lo alonga o deslize de saída; não
reintroduz a queixa de "a cena fica atrás do dedo", que é governada por
`touchMultiplier` e pelo amortecimento da cena.

**A primeira corrida depois de subir o preview sai pior.** Medi 38,5 /
39,0 / 36,2 logo após reiniciar o servidor e 36,2 / 36,2 / 35,9 minutos
depois, com o mesmo build. Comparar um lado frio com o outro quente inventa
uma regressão de 2ms que não existe. Intercale as corridas dos dois lados,
ou descarte as primeiras.

**A cena não tem "pausa quando o canvas sai da tela" porque não há como ele
sair.** O canvas é fixo e ocupa a janela inteira, e `frame-ancestors 'none'`
impede que a página viva num iframe rolável. O que existe é o que pode
acontecer de verdade: aba escondida para o laço (`visibilitychange`),
contexto perdido para o laço, e o repouso do buraco negro desenha quadro sim,
quadro não. Um IntersectionObserver ali seria código morto.

**Texturas de Marte, Júpiter e Saturno não existem mais em `public/space`.**
Os três são ilustrados sem textura desde a direção de arte; os arquivos
ficaram 462 kB no repositório sem nunca serem pedidos. O carregador só monta
caminhos para `earth-*`, `milky-way` e `moon` — confira com
`grep -o "tier('[a-z-]*'\|pin('[a-z-]*'"` antes de acreditar num grep solto
por nome, porque "saturn" casa com comentário.

**Uma medição isolada não é medição.** A dispersão entre corridas chega a 7ms
na média por quadro. Eu subi a razão de pixels de 1,5 para 2 com base numa
corrida que deu 33ms; o valor real era 151ms, e o cliente sentiu como
travamento. Meça três vezes de cada lado antes de concluir.

**Janela do Playwright ocluída derruba o rAF para 1Hz.** Todas as faixas
saem com ~1000ms e valores idênticos. Rode uma captura por vez, sem outra
janela por cima.

**Editar código morto.** Cortei o gerador procedural de estrelas de 360 para
96 células ao longo de três rodadas sem efeito nenhum, porque ele está dentro
de `if (nebula > 0)` e a nebulosa foi desligada no celular. Antes de reportar
uma redução, confirme que o caminho editado executa.

**Fragmentar o shader por `#define` piora.** Separar ramos por planeta criou
dois programas em vez de um e a travada subiu ~150ms. Otimização de shader só
vale se o programa continuar único. A exceção que funcionou: a Terra já tem
programa próprio porque os outros são toon, então tirar a sombra volumétrica
de nuvem dela no celular encolheu sem criar variante.

**Posterizar fotografia não vira ilustração.** A primeira tentativa de cartoon
aplicava degraus sobre a foto da NASA; as fronteiras das faixas de cor andavam
com a rotação e o resultado foi Júpiter piscando. O que funcionou foi tirar a
textura inteira.

**MSAA no celular foi desligado por uma premissa que caiu.** O comentário
dizia que lá o bloom estava sempre ligado e um composer desenhava num alvo
próprio, deixando ao canvas só um quad sem bordas. Mas `wantsPostFx` é
`!weakDevice && !lightweight`: no celular o composer não existe e o laço cai
em `renderer.render` direto no framebuffer padrão, que é onde a flag atua.
Religado, custa +0,4ms sobre 33,2 — medido três vezes de cada lado. Antes de
desligar de novo, confira se a premissa voltou a valer.

**Bloom e nitidez não cabem juntos no celular.** Com razão de pixels 1,75 o
composer trabalha num alvo grande; devolver o bloom deu 182ms por quadro. O
brilho dos astros é feito dentro dos próprios shaders — ver o termo `spread`
em `blackhole.ts`, que substitui o que o bloom fazia.

**Backtick dentro de comentário GLSL quebra o build.** Os shaders são template
literals. Caí nisso três vezes.

**Cheque a cadeia do comando.** Uma vez usei `;` em vez de `&&` depois de
`npm test` e empurrei com dois testes falhando — a tabela de keyframes foi
para o ar fora de ordem.

## Coisas que degradam a cena depois da carga — todas já removidas

Esta foi a queixa mais longa do cliente: "abre bonito e fica feio". Quatro
causas distintas, todas corrigidas. Se ela voltar, procure aqui primeiro:

1. Rebaixamento adaptativo derrubando razão de pixels e bloom. Hoje só existe
   acima de 1024px.
2. Nebulosa procedural assada e sobreposta ao céu aos ~14s. Desligada no
   celular (`nebula = 0`).
3. Bloom entrando aos 90 quadros. Fora do celular.
4. ~~Troca de degrau da textura do céu, de 1k para 2k comprimido.~~
   **Revertido, e a reversão é medida.** O 2k realmente trazia blocagem, mas
   o defeito era o encode, não o degrau. Regravado do 4k com lanczos3 a q82
   ele mede razão de blocagem 1,57 contra 2,17 do anterior — menos blocado
   até que o próprio 4k — com 46% mais detalhe interior. O 1k que estava
   fixado era o pior dos três por texel; ele só não parecia blocado porque
   aparecia ampliado 9,9 vezes. O celular sobe para 2k.

## Onde mexer

Tudo em `src/components/scene/`:

| Arquivo | O que tem |
| ------- | --------- |
| `TriScene.tsx` | Composição, loop, luzes, fila de aquecimento, definição dos `worlds` |
| `keyframes.ts` | `KEYFRAMES` (desktop) e `mobileKeyframes()`; `takeoffSpan`, `rocketWindow`, `holePresence` |
| `planet.ts` | Shader de superfície, caminho TOON, nuvens, atmosfera, anel |
| `stars.ts` | Campo de pontos, paralaxe por profundidade, deriva, warp na rolagem |
| `space.ts` | Esfera do céu, `uSparkle` (controle real de quantidade de estrelas) |
| `galaxies.ts` | Cinco galáxias em sprite, 512px, com giro e respiração |
| `blackhole.ts` | Disco, anel de fótons, textura de ruído feita na CPU |

O formato de cada linha de keyframe:
`[progresso, dissolução, x, y, escala, opacidade, morph]`

A presença do buraco negro depende do `morph`, que é **amortecido**: trocar de
astro tarde demais faz ele entrar fraco. A troca acontece em 0,318, dentro da
explosão, onde o campo está disperso e a costura não aparece.

A amostragem é **Hermite cúbica monótona** (Fritsch–Carlson), não smoothstep
por trecho. A versão antiga zerava a derivada dos dois lados de toda linha, e
o movimento freava até parar em cada uma. Monótona é obrigatório e não é
gosto: a tabela tem máximos locais (escala 1,70 em 0,946) e mínimos chapados,
e Catmull-Rom puro faria a opacidade passar de 1 e ficar negativa.

O amortecimento é **separado por canal**: posição e escala em 3,8 porque
abaixar isso deixa a cena para trás do dedo, opacidade em 2,2, e forma em 2,0
**apenas quando `form > 1.6`** — a troca planeta para buraco negro tem só
495px e precisa da taxa cheia para o disco não entrar fraco.

## Frentes abertas para esta sessão

**Planetas.** A rampa está boa mas ainda é uma função de latitude. Caminhos
possíveis: turbulência nas bordas das faixas (as faixas de Júpiter não são
retas, elas se enrolam nas fronteiras), um segundo tom de sombra para o
terminador em vez do degrau único, especular seco e pequeno nos gigantes.

**Fundo.** Hoje o céu é a fotografia da Via Láctea com `uSparkle` em 0,3,
mais 55 pontos com paralaxe de 0,3 a 2,0 e deriva contínua, mais cinco
galáxias. Falta profundidade em camadas — hoje tudo está numa distância só.

**Movimento.** Existe: warp das estrelas conforme a velocidade da rolagem,
deriva contínua nos dois eixos, giro e respiração das galáxias, nuvens da
Terra a 2,1x o giro do chão. Não existe: paralaxe por inclinação do aparelho,
poeira próxima cruzando o quadro, variação de matiz lenta no céu.

## A tela de entrada

Vive em `index.html`, não no React e não em `src/index.css`. As duas
escolhas são cicatriz: a tentativa anterior morou na folha do Tailwind v4 e
o fundo nunca chegou a pintar, porque regra dentro de `@layer` perde para as
utilidades. **Tudo que pinta está em atributo `style` inline**, que não perde
para camada nenhuma; o bloco `<style>` no `<head>` só carrega os keyframes.

Ela espera DUAS coisas: um piso de 2,0s, para a abertura ler como sistema
subindo, e o primeiro quadro desenhado pela cena, que dispara
`astro:cena-pronta` em `TriScene.tsx` — o marco honesto, não "o script
carregou" e sim "há imagem". Teto de 6,5s para ninguém ficar preso, e a
rolagem trava enquanto ela está de pé (a cena lê `scrollY` a cada quadro;
rolar às cegas por baixo faz o astro saltar quando ela sai). Ao sair,
dispara um `resize` para o Lenis recontar.

**O roteiro dela é `public/entrada.js`, e NUNCA pode voltar a ser inline.**
O CSP de produção só libera inline por hash sha256 (o hash que está no
`netlify.toml` cobre o bloco de dados estruturados). Qualquer edição num
script inline muda o hash e o navegador passa a recusá-lo em silêncio: foi
assim que a tela ficou carregando para sempre no ar enquanto funcionava no
local, onde não há CSP. Por arquivo ela entra pelo `'self'`.

**Quem fecha a tela é o visitante, num botão**, e o botão aparece de
qualquer jeito — se a cena nunca sinalizar, o teto de 9s o traz. Se ninguém
clicar, entra sozinho em 12s. Não existe caminho em que alguém fique preso.

**Nada que precise de tempo certo aqui pode depender da thread principal.**
Esta é a lição cara desta tela. Depois do primeiro quadro, a fila de
aquecimento dos shaders prende a thread por mais de dois segundos, e nesse
intervalo nenhum temporizador roda. Medido: as linhas de boot por
`setInterval` caíam em 3610ms quando deviam cair em 762ms, e o `setTimeout`
do fim do piso disparava 2,1s atrasado — a tela durava 5,6s em vez de 3,5.

A solução é pôr tudo que conta tempo no compositor. As quatro linhas trocam
por `animation-delay` encadeado, e a saída é uma animação marcada com atraso
igual ao que falta do piso, em vez de um `setTimeout`. Conferido pela Web
Animations API, cujo `startTime` o compositor escreve: animação criada aos
1977ms com 1531ms de atraso, fade visível começando em 3508ms. Só a limpeza
(remover o nó, devolver a rolagem) continua em `setTimeout`, e pode chegar
atrasada sem custo — a esta altura a tela já está invisível.

**Para medi-la, não confie em sonda que rode na página nem em captura do
Playwright.** As duas esperam a thread: a captura chega a sair 3,7s depois
do pedido, com a tela já fora, e uma sonda com `setInterval` mede a própria
blocagem. Use `getAnimations()[i].startTime` para tempo, e
`p.route('**/assets/**.js', ...)` com atraso para ver a tela parada.

**Para medi-la, segure o bundle.** Uma captura do Playwright durante a
abertura só retorna depois que a thread principal para de compilar shaders,
e chega a sair 3,7s depois do pedido — com a tela já fora. Isso me fez
concluir que ela nem existia. `p.route('**/assets/**.js', ...)` com atraso
mostra o que o visitante vê.

## Regras invioláveis

- A supernova não pode passar do rodapé. Fica contida na seção final.
- O Sol explode dentro da Missão, na altura de "Seu negócio em novas órbitas".
- Nada de HUD: grades, porcentagem, velocidade e altitude foram removidas.
- O fundo não é preto chapado.
- O foguete não muda.
- `content-visibility` em `index.css` tem alturas calibradas por seção, só até
  480px. Mexeu no conteúdo de alguma seção, rode `scripts/section-heights.mjs`
  e refaça a tabela, senão a altura do documento oscila e a cena desloca.

## Entrega

Commits em português, assunto curto no imperativo, corpo explicando **por
que**, com os números medidos. Terminar com:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

Neste projeto "faça o push" significa merge em `main` e push. Rodar
`npm test && npm run lint` **com E lógico** antes de qualquer push.
