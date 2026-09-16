# Desempenho no celular — registro de medições

Medido com `node scripts/mobile-perf.mjs <url> <fração>`: iPhone 13 emulado
(390x844, DPR 3) com a CPU quatro vezes mais lenta, rolando a página a 22px
por quadro. `longPct` conta quadros acima de 24ms.

Servir o build antes de medir, e conferir em qual endereço o preview subiu:
aqui ele escuta em `[::1]:4173`, não em `127.0.0.1`.

    npm run build && npm run preview
    node scripts/mobile-perf.mjs http://localhost:4173/ 0.4

A janela do Playwright precisa ficar visível. Janela ocluída derruba o
requestAnimationFrame para 1Hz e a medição vira ficção.

## Linha de base — main d7e8e8b

| Corrida | Fração | Quadros | Longos | Média | Pior |
| ------- | ------ | ------- | ------ | ----- | ---- |
| 1 | 0.4 | 407 | 99,51% | 64,5ms | 1883ms |
| 2 | 0.4 | 407 | 99,51% | 58,2ms | 1633ms |
| 3 | 0.4 | 407 | 98,28% | 58,5ms | 1567ms |
| 4 | 1.0 | 1025 | 98,05% | 51,8ms | 1600ms |
| 5 | 1.0 | 1025 | 98,34% | 51,9ms | 1516ms |

Variância entre corridas fica em ±3ms na média, então diferença abaixo de
5ms não é ganho: é ruído. O `worstMs` de ~1,6s é o pico de carga inicial e
não se repete durante a rolagem.

## Passo 1 — content-visibility nas seções

Mesma distância percorrida nos dois lados (22550px), 1020 quadros:

| Versão | Média | Longos | Altura inicial | Deriva |
| ------ | ----- | ------ | -------------- | ------ |
| Base | 54,6ms | 98,2% | 23306 | 7px |
| `content-visibility`, estimativa única de 720px | 44,0ms | 83,2% | 18932 | 4732px |
| `contain: layout paint style`, sem pular pintura | 50,7ms | 96,9% | 23306 | 7px |
| `content-visibility` calibrado pela caixa de conteúdo | 41,0ms | 79,4% | 23306 | 6px |

Três coisas que a medição ensinou:

Comparar por fração mente. Com a estimativa errada a página abria 4374px mais
curta, a fração 1.0 percorria menos página e o custo médio caía sozinho. Por
isso a sonda aceita distância em pixels.

`contain` sozinho não paga. O ganho está em pular a renderização, não em
isolar o layout: 3,9ms contra 13,6ms, e 3,9ms é o tamanho do ruído.

A estimativa tem que ser a caixa de conteúdo. Medindo a caixa de borda, cada
seção ganhava o padding duas vezes e a página nascia 1856px mais alta.

Limite de 480px: a tabela calibrada a 390px erra 309px num iPhone 15 Pro Max
(tolerável) e 3856px num iPad Mini (não). Acima de 480px a regra não vale.

## Passo 2 — gradiente animado só em tela larga

| Versão | Média | Longos |
| ------ | ----- | ------ |
| Depois do passo 1 | 41,0ms | 79,4% |
| `text-spectrum-animated` travado acima de 1024px | 39,5ms | 70,1% |

A média cai 1,5ms, que é ruído. O número que conta é o outro: nove pontos a
menos de quadros acima de 24ms. Faz sentido para um repaint que acontecia a
cada quadro e não some quando a frase sai da tela.

## Passo 3 — GiantWord promovido e com curso menor

| Versão | Média | Longos |
| ------ | ----- | ------ |
| Depois do passo 2 | 39,5ms | 70,1% |
| `will-change` e curso de 6% no celular | 37,5ms | 65,7% |
