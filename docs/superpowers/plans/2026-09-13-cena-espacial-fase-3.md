# Cena espacial, fase 3: buraco negro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar corpo ao buraco negro: horizonte preto, disco de acreção com doppler e estrias, arcos dobrados por cima e por baixo, e os detritos chegando em espiral.

**Architecture:** Módulo `blackhole.ts` com um grupo (esfera preta opaca + três anéis em `ShaderMaterial` aditivo) posicionado no mesmo centro e escala do campo. O disco fica no plano `RING_NORMAL` dos triângulos; os arcos ficam de pé atrás do horizonte. `holePresence(form)` pesa a forma; o disco só aparece com o campo agrupado (`mix` baixo). A espiral entra no vertex shader dos triângulos: o alvo do disco gira com `uMix`. O ruído simplex sai de `planet.ts` para `glsl.ts`, compartilhado.

**Tech Stack:** three.js 0.185, GLSL, `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-13-cena-espacial-design.md`

## Global Constraints

- Sem passe de lente, sem pós-processamento. Arco dobrado por geometria.
- Meta: 400px 0% de frames acima de 24ms, 1280px ≤ 2%.
- `npm test`, `tsc`, `oxlint`, `build` limpos. Commits com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## Mapa de arquivos

| Arquivo | Estado | Responsabilidade |
|---|---|---|
| `src/components/scene/glsl.ts` | novo | `SIMPLEX_NOISE` com `snoise` e `fbm`. |
| `src/components/scene/blackhole.ts` | novo | Horizonte, disco, arcos. `createBlackHole({ segments })`. |
| `src/components/scene/planet.ts` | modificado | Importa o ruído de `glsl.ts`. |
| `src/components/scene/triangles.ts` | modificado | Espiral de sucção no vertex shader. |
| `src/components/scene/keyframes.ts` | modificado | `holePresence(form)`. |
| `src/components/scene/TriScene.tsx` | modificado | Cria, atualiza, descarta. |
| `tests/keyframes.test.ts` | modificado | Teste de `holePresence`. |

---

### Task 1: ruído compartilhado, espiral, `holePresence`, módulo

- [ ] `glsl.ts` com o bloco de ruído que hoje está em `planet.ts`; `planet.ts` passa a importá-lo.
- [ ] Em `triangles.ts`, depois de `coreHole = rotateAxis(aHole, ...)`: `coreHole = rotateAxis(coreHole, discAxis, uMix * 2.4);`
- [ ] `keyframes.ts`: `export function holePresence(form: number) { return 1 - Math.min(Math.abs(form - 1), 1) }` com teste (1 → 1, 0 → 0, 2 → 0, 1,5 → 0,5).
- [ ] `blackhole.ts`: horizonte `SphereGeometry(0.4)` preto opaco, `renderOrder -3`; disco `RingGeometry(0.44, 1.7)` no plano `RING_NORMAL` (`quaternion.setFromUnitVectors(+Z, RING_NORMAL)`), shader com `radial = (1 − rn)^2.4`, borda interna branca-quente, doppler pela tangente em espaço de câmera (`1 + 0.7·t.z`), estrias por `snoise` num referencial girando `uTime·(0.35 + 0.8/r)`, anel de fótons em `r = 0.452`; arco de cima `RingGeometry(0.44, 1.15, …, 0, π)` de pé em `z −0.05` com ganho 0,6, arco de baixo `(0.44, 0.8, …, π, π)` com ganho 0,3. `update` liga `visible` com `opacity · presence · grouped`, onde `grouped = 1 − clamp((mix − 0.25)/0.6)`.
- [ ] `npm test` (8), `tsc`, `lint`.

### Task 2: ligar, conferir, medir

- [ ] `TriScene.tsx`: `createBlackHole({ segments: lightweight ? 72 : 112 })`, `update` com `{ x: centerX, y: centerY, scale, opacity, presence: holePresence(current.form), mix: current.mix }`, `dispose`.
- [ ] Preview: 1280×900 em 0,345 (sucção em andamento) e 0,36 (formado); 400×820 em 0,28 e 0,295. Esperado: horizonte preto no meio, disco laranja com um lado mais claro, arco por cima, triângulos chegando em curva.
- [ ] Medir fluidez nas duas larguras; commit `feat: buraco negro com horizonte, disco de acreção e arcos dobrados`.

### Task 3: README

- [ ] Seção da cena e medições. Commit `docs:`. Push. Merge no `main` só com aprovação.
