# Cena espacial, fase 2: planeta com shader e explosão

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar um planeta de verdade dentro da casca de triângulos — superfície procedural, terminador, atmosfera — que se despedaça no fim do Manifesto.

**Architecture:** Um módulo `planet.ts` com duas esferas (superfície e atmosfera) em `ShaderMaterial`, posicionadas no mesmo centro e escala do campo de triângulos. A explosão não ganha janela própria: `planetBreak(mix, form)` lê o estado do campo, então o planeta se despedaça exatamente quando os triângulos dispersam e some quando a forma vira outro astro. A superfície grava profundidade e desenha antes dos triângulos, escondendo a metade de trás da casca: sobra a crosta da frente.

**Tech Stack:** three.js 0.185, GLSL (simplex 3D de Ashima), `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-13-cena-espacial-design.md`

## Global Constraints

- Sem pós-processamento; sem GSAP.
- DPR e contagens como hoje. Esfera com 64 segmentos no desktop, 40 no celular.
- Meta de fluidez: celular sem piorar a fase 1 (0,06%), desktop sem piorar (2,4%).
- `npm test`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `npm run build` limpos.
- Comentários curtos em português. Commits com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Branch `feat/cena-espacial`, merge no `main` só com aprovação.

---

## Mapa de arquivos

| Arquivo | Estado | Responsabilidade |
|---|---|---|
| `src/components/scene/planet.ts` | novo | Superfície, atmosfera, quebra. `createPlanet({ segments })`. |
| `src/components/scene/keyframes.ts` | modificado | `planetBreak(mix, form)`. |
| `src/components/scene/TriScene.tsx` | modificado | Cria, atualiza, descarta o planeta; centro compartilhado com o campo. |
| `tests/keyframes.test.ts` | modificado | Teste de `planetBreak`. |
| `README.md` | modificado | Cena e medições. |

---

### Task 1: `planetBreak` e o módulo do planeta

**Files:**
- Modify: `src/components/scene/keyframes.ts`
- Modify: `tests/keyframes.test.ts`
- Create: `src/components/scene/planet.ts`

**Interfaces:**
- Produces: `export function planetBreak(mix: number, form: number): number` — 0 inteiro, 1 sumido.
- Produces: `export type PlanetState = { x: number; y: number; scale: number; opacity: number; break: number }`
- Produces: `export function createPlanet(opts: { segments: number }): { object: THREE.Group; update(state: PlanetState, time: number): void; dispose(): void }`

- [ ] **Step 1: Teste de `planetBreak`** — acrescentar a `tests/keyframes.test.ts` (import junto dos outros):

```ts
test('planetBreak: inteiro agrupado, em pedaços disperso, some noutro astro', () => {
  assert.equal(planetBreak(0.05, 0), 0)
  assert.equal(planetBreak(1, 0), 1)
  assert.equal(planetBreak(0.05, 1), 1)
  const a = planetBreak(0.3, 0)
  const b = planetBreak(0.5, 0)
  assert.ok(a > 0 && b > a && b < 1, 'cresce com a dispersão')
})
```

Run: `npm test` — Expected: FAIL, `planetBreak` não exportado.

- [ ] **Step 2: Implementar** ao fim de `keyframes.ts` (usa o `smooth` já definido):

```ts
export function planetBreak(mix: number, form: number) {
  const scatter = smooth(0.1, 0.75, mix)
  const gone = Math.min(Math.max(form, 0), 1)
  return Math.min(1, scatter + gone)
}
```

Run: `npm test` — Expected: 7 passando.

- [ ] **Step 3: Escrever `planet.ts`** — o arquivo completo está em `src/components/scene/planet.ts` nesta branch (superfície: fbm 5 oitavas para continentes, oceano cobalto, gelo ivory, calotas por `|y|`, nuvens animadas, terminador `smoothstep(-0.22, 0.38, dot(n, uLight))` com luz fixa em espaço de câmera, especular no oceano, fresnel azul; quebra: deslocamento por normal × ruído × `uBreak²` × 1,4, cor esquentando com `sin(uBreak·π)`, alfa `1 − smoothstep(0.35, 1, uBreak)`; atmosfera: esfera 0,72 `BackSide` aditiva, `rim = (1 − |n·v|)³`, incha 60% e clareia no pico da quebra). `surface.renderOrder = -2`, `depthWrite: true`; `atmosphere.renderOrder = -1`.

- [ ] **Step 4: Verificar** — `npx tsc --noEmit -p tsconfig.app.json && npm run lint`.

---

### Task 2: Ligar na cena

**Files:**
- Modify: `src/components/scene/TriScene.tsx`

- [ ] **Step 1:** importar `planetBreak` e `createPlanet`; depois do foguete, `const planet = createPlanet({ segments: lightweight ? 40 : 64 })` e `scene.add(planet.object)`.
- [ ] **Step 2:** extrair `centerX`/`centerY` (o que hoje vai para `uCenter`) e chamar, depois de `stars.update`:

```ts
planet.update(
  { x: centerX, y: centerY, scale: current.scale, opacity: Math.min(1, current.opacity * 1.4), break: planetBreak(current.mix, current.form) },
  time,
)
```

- [ ] **Step 3:** `planet.dispose()` no cleanup.
- [ ] **Step 4:** build; preview; screenshots a 1280×900 em 0,15 (Serviços), 0,26 (Manifesto), 0,29 (meio da explosão) e a 400×820 em 0,12, 0,22, 0,25. Esperado: esfera com continentes e borda azul dentro da casca; texto legível; explosão laranja com flash.
- [ ] **Step 5:** medir fluidez nas duas larguras (mesmo medidor da fase 1, `bringToFront` antes). Meta: 400px ≤ 0,1%, 1280px ≤ 3%.
- [ ] **Step 6:** commit `feat: planeta com superfície, atmosfera e explosão`.

---

### Task 3: README

- [ ] Atualizar a seção da cena (planeta com shader, `planetBreak`) e a linha de medições. Commit `docs:`. Merge no `main` só com aprovação.
