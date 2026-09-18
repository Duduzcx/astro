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
| Custo médio por quadro | 36,6ms |
| Pior quadro da rolagem | 200ms |
| Maior travada da abertura | 1126ms |
| Cena visível | ~1870ms |
| Razão de pixels no celular | 1,75 |

**Não regrida isso sem justificativa visual proporcional, medida.**

## Ferramentas

```
node scripts/height-probe.mjs <url> <px> [device]   custo por quadro e altura
node scripts/load-probe.mjs <url> [device]          carga e maior travada
node scripts/section-heights.mjs <url>              alturas das seções
node scripts/shot.mjs <url> <larg> <alt> <frações> <prefixo>
```

Servir com `npm run build && npm run preview`. **O preview sobe em
`[::1]:4173`; `127.0.0.1` não responde.**

## Armadilhas já pagas — não repita nenhuma

**Validar só no local mente.** O `vite preview` não manda CSP nenhum. Um
bloqueio de `blob:` no `netlify.toml` impediu o worker do Draco de rodar e o
foguete caía no procedural — só em produção, por semanas. Valide contra
`https://astrosolucoes.netlify.app/` antes de dizer que algo funciona.

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
4. Troca de degrau da textura do céu, de 1k para 2k comprimido. O céu do
   celular fica no degrau leve e não sobe.

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
