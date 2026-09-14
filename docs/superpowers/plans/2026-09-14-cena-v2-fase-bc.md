# Cena v2, fases B e C: desfile de planetas, foguete em cruzeiro, explosão rápida, buraco negro longo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A viagem entre a Terra e o planeta-alvo passa por vários mundos com o foguete atravessando o campo; o alvo explode em metade do tempo; o buraco negro nasce pequeno, cresce engolindo os detritos e dura o dobro.

**Architecture:** `planet.ts` vira uma fábrica de mundos (`kind`: target, earth, gas, rock, ice; `ring`), com um `uKind` no shader escolhendo a superfície e `uRim` a força da atmosfera. O desfile é uma lista de mundos em `TriScene.tsx`, cada um com `x`, `z`, tamanho e janela de progresso; entram por cima e saem por baixo, com fade nas pontas, e tamanho/posição convertidos por perspectiva (`depthAt`). O foguete em cruzeiro é uma segunda instância de `createRocket` com `cruise: true` (sem plataforma nem fumaça, opacidade válida). Explosão e buraco negro são só linhas de keyframes.

**Spec:** `docs/superpowers/specs/2026-09-13-cena-espacial-design.md` (v2).

## Global Constraints

- Sem pós-processamento. Meta: 400px ≤ 1% de frames acima de 24ms; 1280px sem piorar o A/B.
- `npm test`, `tsc`, `oxlint`, `build` limpos. Commits com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Branch `feat/cena-v2`, merge no `main` só com aprovação.

---

### Task 1: fábrica de mundos, cruzeiro, keyframes, desfile

- [ ] `planet.ts`: `PlanetKind` com `gas | rock | ice`; `KIND_INDEX`, `KIND_RIM`; shader com faixas (gasoso: `fbm(q.y·5 + twist, …)`, mancha), crateras (rochoso: `snoise(q·9)` com borda clara), fendas (gelo: `|snoise(q·7)| < 0.03`); anel opcional (`RingGeometry(0.9, 1.46)`, faixas e uma divisão, `DoubleSide`, inclinado 1,25 rad).
- [ ] `rocket.ts`: opção `cruise` — sem `pad`/`smoke`, materiais `transparent`, opacidade aplicada, inclinação −0,12 rad.
- [ ] `keyframes.ts`: desktop, encontro 0,25–0,266, explosão até 0,28; buraco negro 0,32 (pequeno, mix 0,9) → 0,335 (0,55, mix 0,6) → 0,36 (0,85) → 0,40 (1,0) → 0,44 (0,75) → 0,47 disperso → 0,49 apagado. Celular: encontro 0,212–0,232, explosão até 0,244; buraco 0,268 (0,5) → 0,285 (0,85) → 0,315 (0,95) → 0,34 disperso.
- [ ] `TriScene.tsx`: `worlds` (gasoso com anel em x −0,95, z −2,6, 0,05–0,15; rochoso em x 0,92, z −0,9, 0,105–0,2; gelo em x −0,6, z −4,2, 0,165–0,255; celular × 0,82), `cruiser` em 0,045–0,26 (celular 0,035–0,215).
- [ ] `npm test`, `tsc`, `lint`, `build`.

### Task 2: conferir, medir, commit

- [ ] Preview a 1280×900 em 0,08, 0,15, 0,21, 0,272, 0,345, 0,42; a 400×820 em 0,07, 0,13, 0,17, 0,24, 0,28, 0,31. Esperado: mundos passando meio cortados nas bordas com o foguete pequeno entre eles; explosão curta; buraco negro pequeno crescendo e ficando pelos Cenários.
- [ ] Medir fluidez nas duas larguras. Commit `feat: desfile de planetas, foguete em cruzeiro, explosão rápida, buraco negro longo`.

### Task 3: README, push, aprovação

- [ ] README (narrativa v2, módulos, medições). Push. Mostrar ao usuário; merge só com aprovação.
