# Cena espacial, fase 4: supernova e interface aquecendo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar luz à supernova — um halo que faz as vezes do bloom — e deixar a luz dela chegar na interface do contato e do rodapé.

**Architecture:** `nova.ts` é um único billboard aditivo atrás das cascas de triângulos: núcleo branco, coroa do ouro ao violeta, raios por ângulo torcidos por ruído, respirando no tempo. `novaPresence(form)` pesa a forma 3; o halo só aparece agrupado. A cena escreve `--nova` (0 a 1) no `:root` quando o valor muda mais que 0,02; o CSS do `#contato` e do rodapé usa `color-mix` com essa variável.

**Spec:** `docs/superpowers/specs/2026-09-13-cena-espacial-design.md`

## Global Constraints

- Sem bloom real, sem pós-processamento. Um plano, um shader.
- Meta: 400px ≤ 0,1% de frames acima de 24ms, 1280px ≤ 2%.
- `npm test`, `tsc`, `oxlint`, `build` limpos. Commits com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: `novaPresence`, `nova.ts`, ligação, CSS

- [ ] `keyframes.ts`: `export function novaPresence(form: number) { return Math.min(Math.max(form - 2, 0), 1) }` com teste (1 → 0, 2 → 0, 2,5 → 0,5, 3 → 1).
- [ ] `nova.ts`: `PlaneGeometry(2, 2)`, `ShaderMaterial` aditivo com `depthTest: false`, `renderOrder -1`. Fragment: `rn = d / (1 + 0.05·sin(0.8t))`, cor ouro → laranja → magenta → violeta por `rn`, `rays = (0.5 + 0.5·sin(18a + 4·snoise(cos a·2, sin a·2, 0.15t)))^5`, `corona = (1 − rn)^2.6 · (0.55 + 0.45·rays)`, `core = smoothstep(0.14, 0, d)` branco, `alpha = 1.2·core + 0.85·corona`. `update`: `strength = opacity · presence · grouped` (mesmo `grouped` do buraco negro), escala `3.2 × scale`, `uOpacity = 0.9 · strength`.
- [ ] `TriScene.tsx`: cria, atualiza com `presence: novaPresence(current.form)`, descarta; escreve `--nova = novaPresence(form) · opacity` no `:root` quando muda mais que 0,02, remove no cleanup.
- [ ] `index.css`: `:root { --nova: 0 }`; `#contato` com `radial-gradient` laranja no pé (`color-mix(in oklab, #ff9e57 calc(var(--nova) * 18%), transparent)`); `footer .bg-graphite` e `footer .to-graphite` com o grafite puxado 14% para `#ff9e57` × `--nova`.
- [ ] `npm test` (9), `tsc`, `lint`, `build`.

### Task 2: conferir, medir, commit

- [ ] Preview: 1280×900 em 0,955 e 0,985; 400×820 em 0,95 e 0,985. Esperado: halo dourado atrás das cascas, rodapé levemente quente, texto legível.
- [ ] Medir fluidez nas duas larguras. Commit `feat: halo da supernova e interface aquecendo`.

### Task 3: README

- [ ] Seção da cena e medições. Commit `docs:`. Push. Merge no `main` só com aprovação.
