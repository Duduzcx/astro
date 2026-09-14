# Cena v2, fase A: a Terra no hero, foguete novo, satélites

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o hero contar "a humanidade saindo da Terra": um horizonte curvo da Terra no pé da tela, satélites em órbita, e um foguete com qualidade de produto decolando dele.

**Architecture:** A Terra é o mesmo módulo `planet.ts` com `kind: 'earth'` (paleta própria, luzes de cidade na noite, atmosfera mais forte) e `spin` lento, posicionada longe da câmera (`z = -9.9`) com tamanho e posição aparentes convertidos por perspectiva — perto, uma esfera desse tamanho atravessaria a lente. O foguete é refeito em `LatheGeometry` com `MeshStandardMaterial` e a cena ganha uma luz direcional e uma hemisférica. Satélites são `Points` filhos do grupo da Terra.

**Spec:** `docs/superpowers/specs/2026-09-13-cena-espacial-design.md` (v2: narrativa "saindo da Terra rumo à tecnologia"; fases A, B, C).

## Global Constraints

- Sem pós-processamento. Uma direcional, uma hemisférica.
- Meta de fluidez: 400px ≤ 1% de frames acima de 24ms, 1280px sem piorar o A/B da fase 4.
- `npm test`, `tsc`, `oxlint`, `build` limpos. Commits com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Branch `feat/cena-v2`, merge no `main` só com aprovação.

---

### Task 1: planeta com `kind`, foguete torneado, satélites, luzes

- [ ] `planet.ts`: `createPlanet({ segments, kind?: 'target' | 'earth', spin? })`; `PlanetState.z?`; uniform `uEarth` na superfície (paleta Terra, luzes de cidade `smoothstep(0.5, 0.8, snoise(q·26))·land·(1−day)`) e na atmosfera (`rim × 1.5`).
- [ ] `rocket.ts`: corpo em `LatheGeometry` (ogiva de 14 passos, corpo reto, cintura, bocal em sino), materiais `MeshStandardMaterial` ivory/cobalto/aço, três janelas, quatro aletas em asa extrudadas com bisel, chama em duas camadas. API igual.
- [ ] `satellites.ts`: `createSatellites(count, orbitRadius, pixelRatio)` com `update(opacity, time)`.
- [ ] `TriScene.tsx`: `DirectionalLight(0xffffff, 2.4)` em (−2, 1.6, 3) e `HemisphereLight(0x8db4f5, 0x1a2340, 0.7)`; Terra com `EARTH_DEPTH = 9.9`, `depthScale = (3.3 + 9.9) / 3.3`, raio aparente 2,4 (desktop, ou 1,1 × meia largura) e 2,0 (celular), `reveal` 0,62 / 0,42; recua e some com `lift`; plataforma do foguete na curva do horizonte.
- [ ] `npm test`, `tsc`, `lint`, `build`.

### Task 2: conferir, medir, commit

- [ ] Preview a 1280×900 e 400×820 em 0, 25% e 100% da primeira tela. Esperado: horizonte curvo com continentes e atmosfera, luzes de cidade no lado direito, satélites piscando, foguete sólido e iluminado, sombra do lado direito.
- [ ] Medir fluidez nas duas larguras. Commit `feat: Terra no hero, foguete torneado com luz, satélites`.

### Task 3: README, push, aprovação

- [ ] README (cena, medições). Push. Mostrar ao usuário; merge só com aprovação.
