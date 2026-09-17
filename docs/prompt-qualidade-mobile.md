# Qualidade visual da cena 3D no celular — Astro Soluções

## Objetivo

O site institucional da Astro Soluções tem uma cena three.js de fundo dirigida
por scroll (foguete decola da Terra, desfile de planetas, Sol explode, buraco
negro, supernova). No desktop está aprovado. **No celular o cliente reprova, e
o celular é onde a maioria dos visitantes vai entrar.**

A palavra que o cliente usa é "maquete de escola". O alvo é o oposto: alguém
abre o site e sente que está visitando o espaço, que a empresa leva o mercado
para o futuro. Referências de acabamento que ele já citou: mercury.com e
oryzon.ai.

## Repositório

- Caminho: `C:\Users\eduar\Desktop\Eu\Documentos\Astro Soluções\Site`
- Branch `main`, commit de partida `b1735c7`, árvore limpa, 9/9 testes passando
- Stack: three.js r185, React 19, TypeScript, Vite 8 (rolldown), Tailwind v4,
  framer-motion 13, Lenis (scroll suave só no desktop), oxlint, `node --test`
- Comandos: `npm run build`, `npm test`, `npm run lint`, `npm run preview`
- O preview sobe em `[::1]:4173`. **`127.0.0.1` não responde** — use
  `http://localhost:4173/`

## Mapa da cena

Tudo em `src/components/scene/`:

| Arquivo | Papel |
| ------- | ----- |
| `TriScene.tsx` | Composição, loop por quadro, luzes, amostragem de keyframes, amortecimento, pós-processamento |
| `keyframes.ts` | Tabelas puras: `KEYFRAMES` (desktop) e `mobileKeyframes()`; `takeoffSpan`, `planetBreak`, `holePresence`, `novaPresence` |
| `rocket.ts` | Modelo GLB Starship comprimido com Draco mais fallback procedural |
| `planet.ts` | Planetas por foto com relevo derivado por Sobel, nuvens volumétricas, casca de atmosfera |
| `sun.ts` | Fotosfera, cromosfera, coroa, proeminências |
| `blackhole.ts`, `nova.ts`, `explosion.ts` | Os outros astros |
| `stars.ts`, `brightstars.ts`, `galaxies.ts`, `space.ts`, `meteors.ts`, `sunrays.ts`, `triangles.ts`, `trail.ts` | Fundo e partículas |
| `postfx.ts` | Bloom mais passe de filme (vinheta, grão, aberração) |

Formato de cada linha de keyframe:
`[progresso, dissolução, x, y, escala, opacidade, morph]`

## Estado atual no celular (valores exatos, verificados)

```
lightweight = window.innerWidth < 1024
weakDevice  = navigator.hardwareConcurrency <= 4
narrow      = window.innerWidth < 1024

setPixelRatio  Math.min(dpr, weakDevice ? 1.25 : lightweight ? 1.5 : 1.25)
estrelas       900        (desktop 3600)
estrelas fortes  3        (desktop 8)
meteoros         1        (desktop 3)
clarão do hero   escala 2.1, opacidade 0.4 * (1 - lift*1.6)
                 posição (-halfWidth*0.62, visibleHalfHeight*-0.18, -1)
foguete altura   Math.min(1.35, halfWidth * 1.7)
foguete x        0            (desktop 0.52 * halfWidth)
bloom            ligado a partir de 90 quadros, perfil "light"
segmentos        planetas 64-72, Terra 112, rastro 18
bake de nebulosa 1024x512
```

Em `mobileKeyframes()` o deslocamento horizontal é `const x = 0.0`, o Sol tem
teto `scale * 0.8`, o buraco negro vive de 0.34 a 0.52 e a supernova detona em
0.935 e apaga em 0.958.

## O que o cliente relata (palavras dele, celular)

1. Brilho inicial forte demais, feio. No PC está bom.
2. Estrelas em excesso no fundo.
3. Planetas, estrelas, nuvens e foguete sem qualidade, "apresentação de escola".
4. Foguete não aparece, está bugado e grande demais.
5. Foguete duro, sem movimentação.
6. Movimento faltando "dentro dos planetas".
7. Buraco negro bugando, sumindo, piscando.
8. Sol, buraco negro e supernova muito à direita, quer centralizado.
9. Quer efeito de movimento envolvendo as estrelas.
10. Quer mais cor e brilho, sem tirar o foco das informações.
11. Tudo isso sem perder velocidade de carregamento.

## Becos sem saída — não repita

Esta lista existe porque cada item abaixo já consumiu uma rodada inteira.

**O desvio horizontal dos astros não está na tabela de keyframes.** Já está
`x = 0.0`. O canvas é `fixed top-0 left-0 w-full`, `renderer.setSize(
window.innerWidth, stageHeight)` e `camera.aspect = window.innerWidth /
stageHeight`. Matematicamente o objeto está centrado. Uma medição anterior deu
`dx` entre -1 e -12px numa tela de 390px, ou seja, praticamente centrado e
levemente à esquerda, o oposto do relato. Duas hipóteses já foram testadas e
**descartadas**: divergência de pivô entre as camadas do Sol, e razão de
aspecto na troca de orientação. Antes de mexer em qualquer coisa, meça o
objeto **isolado**: renderize só `star.object` mais `explosion.object` num
`WebGLRenderTarget(96, 192)` escondendo o resto de `scene.children`, e leia com
`readRenderTargetPixels`. A leitura vem com a origem embaixo, então inverta o
`y`. Medir o centroide de luminância do canvas inteiro **não serve**: estrelas,
nebulosa e planetas entram na massa e o resultado mente. Foi exatamente esse
erro que produziu um diagnóstico falso antes.

**Comparar duas versões por fração de scroll mente** quando uma delas muda a
altura do documento: a fração percorre menos página e o custo médio cai
sozinho. Use distância em pixels (`scripts/height-probe.mjs` aceita).

**Medir piscada comparando bytes de PNG comprimido não significa nada.**
Decodifique pixels crus (sharp). Uma causa real de cintilação já encontrada e
corrigida: esfera do céu girando com o tempo mais sprites de estrela de 1px
igual a piscada de subpixel. A correção foi rotação só por scroll, piso de
2.5px no tamanho da estrela e histerese no limiar de visibilidade.

**Medir desempenho numa janela de 400px no desktop mente.** A razão de pixels é
1 e a CPU é a do computador. Use emulação de aparelho com
`Emulation.setCPUThrottlingRate {rate: 4}`.

**Janela do Playwright ocluída derruba o `requestAnimationFrame` para 1Hz** e a
medição vira ficção. Mantenha a janela visível.

**Servidor de preview velho serve build velho.** Mate quem escuta na 4173 antes
de cada rodada de captura.

**O rebaixamento automático já matou o bloom no celular uma vez**, usando o
limiar de 28ms do desktop. Hoje está em `delta > (lightweight ? 0.055 :
0.028)` e `slowFrames > (lightweight ? 80 : 30)`. Se o Sol, o buraco negro e a
supernova aparecerem sem brilho, **suspeite disto primeiro**, antes de mexer em
shader.

**Uma tentativa de recentrar o GLB do foguete com `model.position.z -=
placedCenter.z` puxou o modelo para perto da câmera** e o deixou gigante e
cortado no celular. A centragem calculada na carga já estava certa.

## Ferramentas de medição já no repositório

```
node scripts/mobile-perf.mjs <url> <fração>        iPhone 13, CPU 4x lenta
node scripts/height-probe.mjs <url> <px> [device]  custo e estabilidade de altura
node scripts/section-heights.mjs <url>             alturas por seção
node scripts/shot.mjs <url> <larg> <alt> <frações> <prefixo> [--perf]
```

Registro de medições em `docs/perf-mobile.md`. **Meça a linha de base antes de
tocar em qualquer linha.** A variância entre corridas é de 3ms na média: ganho
abaixo disso é ruído, não resultado.

## Regras invioláveis

**Não regrida o desempenho recém-conquistado.** Rolando a página inteira num
iPhone 13 com CPU 4x mais lenta, o quadro custa 37,0ms (era 54,6ms) e 64,8% dos
quadros passam de 24ms (era 98,2%). Qualquer mudança que suba isso precisa de
justificativa visual proporcional, medida.

**`content-visibility` está calibrado por seção** em `src/index.css`, limitado
a 480px de largura. As alturas são a caixa de conteúdo de cada seção. **Se você
mexer no conteúdo de alguma seção, recalibre** com
`scripts/section-heights.mjs`. Estimativa errada muda a altura do documento, e
a cena tira o progresso de `scrollHeight` (`measureScroll` em
`TriScene.tsx:536`), o que desloca a explosão do Sol e a supernova para outra
seção.

**A supernova não pode passar do rodapé.** Ela tem que ficar contida na seção
final, a de "A sua operação tem a resposta".

**O Sol explode dentro da Missão**, na altura do título "Seu negócio em novas
órbitas".

**Nada de HUD.** Grades, porcentagem, aproximação, velocidade e altitude foram
removidas a pedido do cliente. Não voltem.

**O fundo não é preto chapado.** Mantenha a cor que está.

## Ordem de ataque sugerida

Resolva **um problema por vez**, medindo antes e depois de cada um, e pare para
validar com o cliente antes de avançar. A lista está em ordem de impacto
percebido por quem abre o site no celular.

1. **Foguete sumido, grande demais e travado.** É o primeiro objeto que o
   visitante vê e hoje ele falha. Verifique se o GLB carrega mesmo (há um
   fallback procedural com desistência em 8s: se ele estiver entrando, o
   problema é carga, não geometria). Confirme o enquadramento contra
   `rocketHeight` e `rocketX`. Depois trabalhe a movimentação: hoje existem
   programa de rolagem, tremor de max-Q, balanço de vento e gimbal em
   `rocket.ts`, e ainda assim o cliente lê como duro. Provavelmente falta
   amplitude e falta deriva lateral entre planetas.

2. **Buraco negro piscando e sumindo.** Bug, não gosto. Suspeitos, nesta ordem:
   o rebaixamento automático desligando o bloom no meio da rolagem; a transição
   de morph entre 0.52 e 0.55, onde a escala salta de `scale*1.05` para
   `scale*1.5` e a opacidade cai para `FIELD_OPACITY`; e cintilação de subpixel
   no disco.

3. **Brilho inicial forte demais e excesso de estrelas.** Hoje são 900 estrelas
   e clarão em opacidade 0.4. O cliente ainda acha demais nos dois. Reduza
   medindo o resultado em captura, não no olho.

4. **Centralização de Sol, buraco negro e supernova.** Só depois de medir o
   objeto isolado, como descrito acima. Se a medição confirmar que já está
   centrado, o problema é outro (enquadramento vertical, corte, ou o clarão
   assimétrico puxando o olho) e a correção é lá, não no `x`.

5. **Qualidade de planetas, nuvens e estrelas.** Aqui está a acusação de
   maquete. Materiais, relevo, terminador, atmosfera. É o item mais caro em
   milissegundos, então venha por último, com o orçamento de quadro já
   conhecido.

6. **Movimento envolvendo as estrelas, mais cor e brilho.** O pedido é de
   atmosfera, não de saturação. O texto tem que continuar legível por cima:
   existe um véu (`.scene-scrim`) para isso, e ele não toca o canvas.

## Critérios de aceite

- Foguete visível, inteiro e proporcional numa tela de 390px, em captura.
- Buraco negro sem sumir nem piscar ao longo de 0.34 a 0.55, verificado quadro
  a quadro em pixels crus.
- Sol, buraco negro e supernova com desvio horizontal abaixo de 5% da largura
  da tela, medido com o objeto isolado.
- Custo por quadro no iPhone 13 emulado com CPU 4x lenta **não acima de 40ms**
  na página inteira.
- 9/9 testes, `oxlint` limpo, `npm run build` verde.
- Nenhuma regressão visual no desktop, confirmada por captura a 1440x900.

## Entrega

Commits em português, no estilo do repositório: assunto curto no imperativo,
corpo explicando **por que**, com os números medidos. Termine cada mensagem com:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

Trabalhe numa branch e só faça merge em `main` quando o cliente aprovar
visualmente. Neste projeto "faça o push" significa merge em `main` e push.
