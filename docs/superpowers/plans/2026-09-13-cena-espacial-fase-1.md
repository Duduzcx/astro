# Cena espacial, fase 1: módulos, estrelas, foguete e decolagem

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dividir a cena em módulos sem mudar nada visual, e então colocar estrelas ao fundo e um foguete que decola do hero na primeira tela de scroll.

**Architecture:** A cena WebGL fixa (`TriScene`) continua sendo um único canvas com um loop por frame amostrando keyframes do progresso de scroll. O arquivo de 950 linhas vira uma pasta `src/components/scene/` com um módulo por elemento; cada módulo expõe `create() => { object, update(state, time, delta), dispose() }` e liga `object.visible` só dentro da sua janela de scroll. O hero deixa de mostrar o planeta: mostra o foguete na plataforma, que decola no primeiro scroll, e o planeta (ainda a casca de triângulos, o shader vem na fase 2) passa a aparecer nos Serviços pela borda direita.

**Tech Stack:** React 19, TypeScript 6, Vite 8, three.js 0.185 (chunk lazy), `node --test` para funções puras (Node 24 executa `.ts` direto).

**Spec:** `docs/superpowers/specs/2026-09-13-cena-espacial-design.md`

## Global Constraints

- Sem pós-processamento: um render target só, o da tela.
- Sem GSAP ou ScrollTrigger. Scroll entra pelo amostrador de keyframes.
- DPR: 1 no celular e em máquina fraca, 1,25 no desktop. Contagens de triângulos como hoje (2600 / 4000 / 5600).
- Meta de fluidez: celular 0% de frames acima de 24 ms na rolagem automatizada; desktop não piora.
- `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `npm run build` limpos ao fim de cada tarefa.
- Comentários em português, curtos, dizendo o porquê. Nada que soe gerado.
- Commits terminam com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Branch `feat/cena-espacial`. Ao fim, PR para `main` com preview do Netlify.

---

## Mapa de arquivos

| Arquivo | Estado | Responsabilidade |
|---|---|---|
| `src/components/TriScene.tsx` | reescrito | Só reexporta `TriScene` de `./scene/TriScene`, para o `lazy()` do `App.tsx` não mudar. |
| `src/components/scene/TriScene.tsx` | novo (movido) | Mount, renderer, palco, loop, resize, amortecimento. Compõe os módulos. |
| `src/components/scene/keyframes.ts` | novo (movido) | Tabelas, amostrador, `takeoffSpan`, `rocketWindow`. Sem `three`, sem DOM. |
| `src/components/scene/triangles.ts` | novo (movido) | Paleta, âncoras, `buildTriangles`, shaders, `makeMaterial`, `RING_NORMAL`. |
| `src/components/scene/stars.ts` | novo | Camada de estrelas em `Points`. |
| `src/components/scene/rocket.ts` | novo | Foguete estilizado, chama, fumaça, brilho da plataforma, gancho GLB. |
| `tests/keyframes.test.ts` | novo | Testes das funções puras. Fora de `src`, o `tsc -b` não o vê. |
| `package.json` | modificado | Script `test`. |
| `README.md` | modificado | Seção da cena atualizada. |

---

### Task 1: Dividir `TriScene.tsx` em `scene/` sem mudança visual

**Files:**
- Create: `src/components/scene/keyframes.ts`
- Create: `src/components/scene/triangles.ts`
- Create: `src/components/scene/TriScene.tsx`
- Modify: `src/components/TriScene.tsx` (vira reexport)
- Create: `tests/keyframes.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces (`keyframes.ts`):
  - `export type Keyframes = Array<[number, number, number, number, number, number, number]>`
  - `export type Sample = { mix: number; x: number; y: number; scale: number; opacity: number; form: number }`
  - `export const MOBILE_BREAKPOINT = 1024`, `export const OBJECT_RADIUS = 1.64`, `export const HERO_OPACITY = 0.95`, `export const FIELD_OPACITY = 0.1`
  - `export const KEYFRAMES: Keyframes`
  - `export function mobileKeyframes(halfWidth: number, halfHeight: number, maxScroll: number, stage: number): Keyframes`
  - `export function sampleKeyframes(table: Keyframes, progress: number): Sample`
- Produces (`triangles.ts`):
  - `export const RING_NORMAL: THREE.Vector3`
  - `export function buildTriangles(count: number, spread: THREE.Vector3, onSphere: boolean): THREE.BufferGeometry`
  - `export function makeMaterial(opacity: number): THREE.ShaderMaterial`
- Produces (`scene/TriScene.tsx`): `export function TriScene(): JSX.Element` — mesmo comportamento de hoje.

- [ ] **Step 1: Escrever o teste do amostrador (vai falhar por falta do módulo)**

Criar `tests/keyframes.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sampleKeyframes, KEYFRAMES, mobileKeyframes } from '../src/components/scene/keyframes.ts'

test('sampleKeyframes devolve a primeira linha em progresso 0 e a última em 1', () => {
  const first = sampleKeyframes(KEYFRAMES, 0)
  const last = sampleKeyframes(KEYFRAMES, 1)
  assert.equal(first.mix, KEYFRAMES[0][1])
  assert.equal(first.form, KEYFRAMES[0][6])
  const tail = KEYFRAMES[KEYFRAMES.length - 1]
  assert.equal(last.opacity, tail[5])
  assert.equal(last.form, tail[6])
})

test('sampleKeyframes interpola suave no meio de um trecho', () => {
  const table = [
    [0, 0, 0, 0, 1, 0, 0],
    [1, 1, 1, 1, 2, 1, 3],
  ] as const
  const mid = sampleKeyframes(table as unknown as Parameters<typeof sampleKeyframes>[0], 0.5)
  assert.equal(mid.mix, 0.5)
  assert.equal(mid.scale, 1.5)
  assert.equal(mid.form, 1.5)
  /* smoothstep: em 0,25 fica abaixo do linear. */
  const quarter = sampleKeyframes(table as unknown as Parameters<typeof sampleKeyframes>[0], 0.25)
  assert.ok(quarter.mix < 0.25)
})

test('sampleKeyframes prende o progresso em [0, 1]', () => {
  const below = sampleKeyframes(KEYFRAMES, -3)
  const above = sampleKeyframes(KEYFRAMES, 7)
  assert.equal(below.mix, KEYFRAMES[0][1])
  assert.equal(above.form, KEYFRAMES[KEYFRAMES.length - 1][6])
})

test('mobileKeyframes gera uma tabela ordenada por progresso', () => {
  const table = mobileKeyframes(0.71, 1.54, 24000, 844)
  for (let i = 1; i < table.length; i += 1) {
    assert.ok(table[i][0] >= table[i - 1][0], `linha ${i} fora de ordem`)
  }
  assert.equal(table[0][0], 0)
  assert.equal(table[table.length - 1][0], 1)
})
```

- [ ] **Step 2: Adicionar o script e rodar para ver falhar**

Em `package.json`, dentro de `"scripts"`, adicionar `"test": "node --test"`.

Run: `npm test`
Expected: FAIL com `Cannot find module` apontando para `src/components/scene/keyframes.ts`.

- [ ] **Step 3: Criar `keyframes.ts` movendo o código, sem alterar valores**

Criar `src/components/scene/keyframes.ts` com, nesta ordem, copiados de `src/components/TriScene.tsx`:
- o tipo `Keyframes` (linha 97), agora `export type`;
- a constante `KEYFRAMES` (linhas 56–95) com o comentário, agora `export const`;
- `MOBILE_BREAKPOINT`, `OBJECT_RADIUS`, `HERO_OPACITY`, `FIELD_OPACITY` (linhas 99–116), todos `export`;
- `mobileKeyframes` (linhas 139–207), `export function`;
- `sampleKeyframes` (linhas 209–226), `export function`, com o tipo de retorno nomeado:

```ts
export type Sample = {
  mix: number
  x: number
  y: number
  scale: number
  opacity: number
  form: number
}

export function sampleKeyframes(table: Keyframes, progress: number): Sample {
  /* corpo idêntico ao atual */
}
```

Cabeçalho do arquivo:

```ts
/**
 * Tabelas de scroll da cena. Só números e funções puras: nada de three.js,
 * nada de DOM. É o que permite testar a amostragem sem navegador.
 */
```

`heroCopyBand` NÃO vem para cá: lê o DOM, fica no componente.

- [ ] **Step 4: Rodar os testes**

Run: `npm test`
Expected: 4 passing.

- [ ] **Step 5: Criar `triangles.ts` movendo o resto do núcleo**

Criar `src/components/scene/triangles.ts` com `import * as THREE from 'three'` e, copiados de `src/components/TriScene.tsx` sem alteração:
- as paletas `PALETTE`, `HOLE_*`, `STAR_*`, `NOVA_*` (linhas 11–38);
- `pickFrom`, `pickColor` (40–54);
- `VERTEX_SHADER`, `FRAGMENT_SHADER` (228–335);
- `RING_NORMAL`, `RING_TANGENT`, `RING_BITANGENT`, `RING_BANDS` (346–353), com `RING_NORMAL` exportado;
- `holeAnchor`, `starAnchor`, `novaAnchor`, `randomDirection` (355–443);
- `buildTriangles` (445–601) e `makeMaterial` (603–622), ambos `export`.

Cabeçalho:

```ts
/**
 * A matéria da cena: triângulos vazados em LineSegments, com uma âncora por
 * astro gravada em atributo para o shader interpolar entre elas.
 */
```

- [ ] **Step 6: Criar `scene/TriScene.tsx` com o componente**

Criar `src/components/scene/TriScene.tsx` com o comentário de cabeçalho (linhas 4–9), `heroCopyBand` (118–137) e o componente `TriScene` (624–946), copiados sem alteração, com estes imports no topo:

```ts
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  KEYFRAMES,
  MOBILE_BREAKPOINT,
  mobileKeyframes,
  sampleKeyframes,
} from './keyframes'
import { buildTriangles, makeMaterial } from './triangles'
```

Substituir o conteúdo de `src/components/TriScene.tsx` por:

```ts
/* A cena mora em scene/; este arquivo só mantém o caminho que o App importa. */
export { TriScene } from './scene/TriScene'
```

- [ ] **Step 7: Verificar tipos, lint, build e que nada mudou**

Run:
```bash
npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run build
```
Expected: sem erros; `✓ built`.

Run (confere que as tabelas são byte a byte as mesmas):
```bash
git show HEAD:src/components/TriScene.tsx | sed -n '63,95p' > /tmp/old.txt
grep -n "^const KEYFRAMES" -A 32 src/components/scene/keyframes.ts | sed 's/^[0-9]*[-:]//' | sed -n '1,33p' > /tmp/new.txt
diff <(grep -o '\[[0-9., -]*\]' /tmp/old.txt) <(grep -o '\[[0-9., -]*\]' /tmp/new.txt) && echo IGUAL
```
Expected: `IGUAL`.

- [ ] **Step 8: Commit**

```bash
git add package.json tests/keyframes.test.ts src/components/TriScene.tsx src/components/scene/
git commit -m "refactor: cena dividida em módulos, sem mudança visual

TriScene.tsx tinha 950 linhas com tabelas, shaders, geometria e loop no
mesmo arquivo. Agora scene/keyframes.ts guarda só números e funções puras
(testadas com node --test), scene/triangles.ts a matéria e os shaders, e
scene/TriScene.tsx o mount e o loop. O caminho antigo reexporta, então o
lazy() do App não muda.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Camada de estrelas

**Files:**
- Create: `src/components/scene/stars.ts`
- Modify: `src/components/scene/TriScene.tsx` (cria, atualiza, descarta; render sempre)

**Interfaces:**
- Produces (`stars.ts`):
  - `export type StarsState = { progress: number; opacity: number }`
  - `export function createStars(count: number, pixelRatio: number): { object: THREE.Points; update(state: StarsState, time: number): void; dispose(): void }`

- [ ] **Step 1: Escrever `stars.ts`**

```ts
import * as THREE from 'three'

/**
 * Estrelas ao fundo: pontos pequenos, longe da câmera, descendo devagar
 * conforme a página rola. É o que dá sensação de viagem entre as seções
 * depois que o foguete some. Um draw call, sempre visível.
 */
export type StarsState = { progress: number; opacity: number }

/* Meia largura e meia altura do campo em mundo. Os pontos ficam entre z -1,5
   e -4, e a essa distância a tela mostra bem mais mundo do que em z 0: ±5,5
   em x cobre um monitor largo; o wrap vertical em 7 unidades fecha o ciclo
   sem borda visível. */
const SPREAD_X = 5.5
const SPREAD_Y = 3.5
const WRAP = SPREAD_Y * 2

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aTint;
  attribute float aSeed;
  uniform float uOffset;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vTint;
  varying float vTwinkle;

  void main() {
    vec3 p = position;
    /* Desce com o scroll e dá a volta: y sempre em [-3,5, 3,5]. */
    p.y = mod(p.y - uOffset + ${SPREAD_Y.toFixed(1)}, ${WRAP.toFixed(1)}) - ${SPREAD_Y.toFixed(1)};
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    /* Cintila devagar, cada uma no seu tempo. */
    vTwinkle = 0.7 + 0.3 * sin(uTime * (0.6 + aSeed * 0.9) + aSeed * 40.0);
    gl_PointSize = aSize * uPixelRatio * vTwinkle * (3.0 / -view.z);
    vTint = aTint;
  }
`

const FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying float vTint;
  varying float vTwinkle;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.12, d);
    /* Entre ivory e azul claro, sem branco puro: estrela não pode competir
       com o texto. */
    vec3 color = mix(vec3(0.96, 0.97, 0.98), vec3(0.55, 0.71, 0.96), vTint);
    gl_FragColor = vec4(color, alpha * uOpacity * vTwinkle);
  }
`

export function createStars(count: number, pixelRatio: number) {
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const tints = new Float32Array(count)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() * 2 - 1) * SPREAD_X
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * SPREAD_Y
    positions[i * 3 + 2] = -1.5 - Math.random() * 2.5
    /* Quase todas minúsculas, poucas maiores. */
    sizes[i] = 1.2 + Math.random() * Math.random() * 4.5
    tints[i] = Math.random()
    seeds[i] = Math.random()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 1))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOffset: { value: 0 },
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uOpacity: { value: 0.7 },
    },
  })
  const object = new THREE.Points(geometry, material)
  object.frustumCulled = false

  return {
    object,
    update(state: StarsState, time: number) {
      /* 3 unidades de mundo ao longo da página inteira: lento o bastante
         para não virar chuva. */
      material.uniforms.uOffset.value = state.progress * 3.0
      material.uniforms.uTime.value = time
      material.uniforms.uOpacity.value = state.opacity
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
```

- [ ] **Step 2: Ligar em `scene/TriScene.tsx`**

Importar: `import { createStars } from './stars'`.

Depois de `scene.add(ambientField)`:

```ts
    /* Estrelas ao fundo, a página inteira. */
    const stars = createStars(lightweight ? 1200 : 2400, renderer.getPixelRatio())
    scene.add(stars.object)
```

No `tick`, antes do bloco de render, depois de `ambientMaterial.uniforms.uOpacity.value = ...`:

```ts
      stars.update({ progress, opacity: narrow ? 0.6 : 0.7 }, time)
```

Trocar o bloco de render por este (as estrelas estão sempre lá, então não existe mais frame vazio para pular; o que sobra é a taxa reduzida onde o campo é só textura ou está apagado):

```ts
      /* As estrelas estão sempre na tela, então todo frame desenha. Onde o
         campo é só textura, ou está apagado, 30fps bastam: é metade do custo
         em mais da metade da página. */
      frameCount += 1
      const restful = current.opacity < 0.3 && (current.mix > 0.85 || current.opacity <= 0.015)
      if (!(restful && frameCount % 2)) {
        renderer.render(scene, camera)
      }
```

Remover a variável `painted` (declaração e usos). No `considerDowngrade`, depois de `ambientField.visible = false`, adicionar:

```ts
        stars.object.geometry.setDrawRange(0, Math.floor(stars.object.geometry.getAttribute('position').count / 2))
```

No cleanup, antes de `renderer.dispose()`: `stars.dispose()`.

- [ ] **Step 3: Verificar**

Run:
```bash
npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run build
```
Expected: limpo.

Conferência visual: `npx vite preview --port 4173 --host 127.0.0.1` em segundo plano, abrir `http://127.0.0.1:4173/` no Playwright em 1280×900, screenshot do hero e de uma seção do meio (rolar até `document.getElementById('resultados').offsetTop`). Esperado: pontos pequenos ao fundo nas duas, sem brancos estourados sobre texto. Repetir em 400×820.

- [ ] **Step 4: Commit**

```bash
git add src/components/scene/stars.ts src/components/scene/TriScene.tsx
git commit -m "feat: estrelas ao fundo da cena, descendo com o scroll

Um Points de 2.400 pontos (1.200 no celular), longe da câmera, que desce
3 unidades de mundo ao longo da página com wrap. É a sensação de viagem
entre seções. Como agora sempre há algo na tela, o pulo de frame vazio vira
taxa reduzida onde o campo é só textura.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Janela de decolagem e tabelas sem planeta no hero

**Files:**
- Modify: `src/components/scene/keyframes.ts`
- Modify: `tests/keyframes.test.ts`

**Interfaces:**
- Produces:
  - `export function takeoffSpan(screen: number): number` — fração da página que a decolagem ocupa.
  - `export type RocketWindow = { visible: boolean; lift: number; thrust: number }`
  - `export function rocketWindow(progress: number, takeoff: number): RocketWindow`
  - `KEYFRAMES` e `mobileKeyframes` com o hero apagado e o planeta nos Serviços.

- [ ] **Step 1: Testes da janela**

Acrescentar em `tests/keyframes.test.ts`:

```ts
import { rocketWindow, takeoffSpan } from '../src/components/scene/keyframes.ts'

test('takeoffSpan é ~uma tela de rolagem, com teto', () => {
  assert.equal(takeoffSpan(0.04), 0.036)
  assert.equal(takeoffSpan(0.5), 0.12)
})

test('rocketWindow: parado no topo, fora da tela no fim, empuxo no meio', () => {
  const start = rocketWindow(0, 0.04)
  assert.equal(start.visible, true)
  assert.equal(start.lift, 0)
  assert.equal(start.thrust, 0)

  const mid = rocketWindow(0.02, 0.04)
  assert.ok(mid.lift > 0 && mid.lift < 0.5, 'ease-in: metade do trecho, menos da metade da subida')
  assert.ok(mid.thrust > 0.9)

  const end = rocketWindow(0.04, 0.04)
  assert.equal(end.visible, false)
  assert.equal(end.lift, 1)
  assert.equal(end.thrust, 0)

  const after = rocketWindow(0.5, 0.04)
  assert.equal(after.visible, false)
})
```

Run: `npm test`
Expected: FAIL, `rocketWindow` não exportado.

- [ ] **Step 2: Implementar em `keyframes.ts`**

Acrescentar ao fim do arquivo:

```ts
/**
 * Quanto da página a decolagem ocupa: 90% de uma tela de rolagem, com teto
 * para página curta. `screen` é a altura do palco dividida pelo scroll
 * máximo, o mesmo número que a tabela do celular usa.
 */
export function takeoffSpan(screen: number) {
  return Math.min(screen * 0.9, 0.12)
}

export type RocketWindow = { visible: boolean; lift: number; thrust: number }

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

/**
 * Foguete em função do progresso. `lift` vai de 0 (na plataforma) a 1 (fora
 * da tela) com ease-in: começa devagar e acelera, como uma decolagem. O
 * empuxo sobe rápido no início e cai a zero quando o foguete some.
 */
export function rocketWindow(progress: number, takeoff: number): RocketWindow {
  const t = Math.min(Math.max(progress / takeoff, 0), 1)
  const lift = t * t
  const thrust = smooth(0, 0.12, t) * (1 - smooth(0.85, 1, t))
  return { visible: t < 1, lift, thrust: t >= 1 ? 0 : thrust }
}
```

Run: `npm test`
Expected: todos passando.

- [ ] **Step 3: Tabela de desktop sem planeta no hero**

Em `KEYFRAMES`, substituir as sete primeiras linhas (de `[0.0, 0.04, ...]` até `[0.31, 1.0, ...]`) por:

```ts
  /* Hero: campo apagado. Quem está na tela é o foguete e as estrelas. */
  [0.0, 0.05, 1.05, 0.0, 1.4, 0.0, 0],
  [0.035, 0.05, 1.05, 0.0, 1.4, 0.0, 0],
  /* Serviços: o planeta surge pela borda direita, grande e meio cortado. */
  [0.075, 0.05, 1.05, 0.0, 1.4, 0.45, 0],
  [0.23, 0.05, 1.05, 0.0, 1.4, 0.45, 0],
  /* Manifesto: o encontro, planeta inteiro no centro. */
  [0.26, 0.05, 0.0, 0.0, 1.12, 1.0, 0],
  [0.29, 0.05, 0.0, 0.0, 1.12, 1.0, 0],
  /* Explode: os triângulos voam enquanto o campo apaga atrás do vídeo. */
  [0.31, 1.0, 0.0, 0.0, 1.35, 0.0, 0],
```

Atualizar o comentário acima da tabela: trocar "hero à direita, serviços à esquerda, manifesto disperso" por "hero apagado (foguete), serviços com o planeta na borda direita, manifesto com o planeta no centro".

- [ ] **Step 4: Tabela do celular**

Em `mobileKeyframes`, depois de `const settle = ...`, acrescentar:

```ts
  const takeoff = takeoffSpan(screen)
  /* O planeta aparece uma tela depois da decolagem e fica pelos Serviços. */
  const arrive = Math.min(takeoff + screen * 0.6, 0.12)
```

Substituir as linhas do `return` de `[0.0, 0.03, ...]` até `[0.185, ..., 1]` por:

```ts
    /* Hero: campo apagado, foguete na plataforma. */
    [0.0, 0.05, x, 0.1, scale * 1.1, 0.0, 0],
    [takeoff, 0.05, x, 0.1, scale * 1.1, 0.0, 0],
    /* Serviços: planeta centralizado atrás dos cards, em meia luz. */
    [arrive, 0.05, x, 0.1, scale * 1.1, 0.5, 0],
    [0.15, 0.05, x, 0.1, scale * 1.1, 0.5, 0],
    /* Manifesto: o encontro. */
    [0.165, 0.05, x, 0.0, scale * 1.15, 0.85, 0],
    [0.185, 0.05, x, 0.0, scale * 1.15, 0.85, 0],
    /* Explode e some. */
    [0.2, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 0],
    /* Troca de astro com o campo quase invisível, ninguém vê a costura. */
    [0.205, 0.9, 0.0, 0.0, scale * 1.5, FIELD_OPACITY, 1],
```

As variáveis `hold` e `settle` deixam de ser usadas: remover as duas linhas e o comentário delas.

Run: `npm test && npx tsc --noEmit -p tsconfig.app.json && npm run lint`
Expected: limpo. O teste de ordenação garante que `arrive < 0.15`.

- [ ] **Step 5: Medir onde cada seção cai e ajustar**

Com o preview no ar, no Playwright a 1280×900 e depois a 400×820, rodar:

```js
() => {
  const max = document.documentElement.scrollHeight - window.innerHeight
  return ['servicos', 'manifesto', 'resultados', 'contato'].map((id) => {
    const el = document.getElementById(id)
    return [id, +(el.offsetTop / max).toFixed(3), +((el.offsetTop + el.offsetHeight) / max).toFixed(3)]
  })
}
```

Ajustar os progressos das linhas "Serviços" e "Manifesto" nas duas tabelas para caírem dentro das faixas medidas (Manifesto no celular pode não ser 0,165–0,185; usar o medido). Screenshot no meio dos Serviços e no meio do Manifesto nas duas larguras: planeta visível e texto legível.

- [ ] **Step 6: Commit**

```bash
git add src/components/scene/keyframes.ts tests/keyframes.test.ts
git commit -m "feat: hero sem planeta, planeta nos Serviços, janela de decolagem

O hero passa a ser do foguete: o campo fica apagado até o fim da primeira
tela de rolagem (takeoffSpan) e o planeta entra nos Serviços pela borda
direita, meio cortado, chegando inteiro ao centro no Manifesto. rocketWindow
dá lift com ease-in e empuxo que sobe rápido e some com o foguete.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Foguete estilizado, chama, fumaça e decolagem

**Files:**
- Create: `src/components/scene/rocket.ts`
- Modify: `src/components/scene/TriScene.tsx`

**Interfaces:**
- Consumes: `rocketWindow`, `takeoffSpan` de `keyframes.ts`.
- Produces (`rocket.ts`):
  - `export const ROCKET_MODEL_URL = ''`
  - `export type RocketState = { visible: boolean; lift: number; thrust: number; x: number; yPad: number; travel: number; opacity: number }`
  - `export function createRocket(opts: { height: number; lightweight: boolean }): { object: THREE.Group; update(state: RocketState, time: number, delta: number): void; dispose(): void }`

- [ ] **Step 1: Escrever `rocket.ts`**

```ts
import * as THREE from 'three'

/**
 * Foguete estilizado no visual da marca: silhueta escura quase opaca com as
 * arestas em linha, cobalto no corpo e ivory no nariz e nas aletas. Chama
 * por shader, fumaça simulada na CPU (200 pontos, custo desprezível) e um
 * brilho na plataforma que acende no empuxo.
 *
 * Gancho para modelo real: preencha ROCKET_MODEL_URL com um .glb (Draco em
 * /public/draco/). Carregado, o estilizado some. Vazio, nada é baixado.
 */
export const ROCKET_MODEL_URL = ''

export type RocketState = {
  visible: boolean
  /** 0 na plataforma, 1 fora da tela. */
  lift: number
  /** 0 a 1, empuxo do motor. */
  thrust: number
  /** Centro em mundo (x) e altura da plataforma (y). */
  x: number
  yPad: number
  /** Quanto o foguete sobe em mundo entre lift 0 e 1. */
  travel: number
  opacity: number
}

const ONYX = 0x0b1226
const COBALT = 0x4d84e0
const IVORY = 0xf5f7fb

const FLAME_VERTEX = /* glsl */ `
  uniform float uThrust;
  varying vec2 vUv;
  varying float vEdge;
  void main() {
    vUv = uv;
    vec3 p = position;
    /* Cresce para baixo com o empuxo; parado, sobra um bico curto. */
    p.y *= 0.25 + uThrust * 0.75;
    vec3 n = normalize(normalMatrix * normal);
    vEdge = abs(n.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const FLAME_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uThrust;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vEdge;
  void main() {
    /* uv.y = 1 na base (bocal), 0 na ponta. */
    float along = 1.0 - vUv.y;
    float flicker = 0.5 + 0.5 * sin(along * 22.0 - uTime * 26.0 + sin(vUv.x * 18.85) * 1.6);
    vec3 core = vec3(1.0, 0.97, 0.88);
    vec3 mid = vec3(1.0, 0.62, 0.24);
    vec3 tail = vec3(0.9, 0.25, 0.08);
    vec3 color = mix(core, mid, smoothstep(0.0, 0.35, along));
    color = mix(color, tail, smoothstep(0.35, 0.9, along));
    float alpha = pow(1.0 - along, 1.4) * (0.55 + 0.45 * flicker) * pow(vEdge, 0.6);
    gl_FragColor = vec4(color, alpha * uOpacity * (0.35 + 0.65 * uThrust));
  }
`

const GLOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const GLOW_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float alpha = pow(max(0.0, 1.0 - d), 2.2);
    gl_FragColor = vec4(uColor, alpha * uOpacity);
  }
`

const SMOKE_VERTEX = /* glsl */ `
  attribute float aAge;
  attribute float aSize;
  uniform float uPixelRatio;
  varying float vAge;
  void main() {
    vAge = aAge;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = aSize * (0.4 + aAge * 1.6) * uPixelRatio * (3.0 / -view.z);
  }
`

const SMOKE_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying float vAge;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float soft = smoothstep(1.0, 0.2, d);
    /* Nasce clara e esfria para o cinza-azul do fundo. */
    vec3 color = mix(vec3(0.95, 0.9, 0.85), vec3(0.45, 0.5, 0.62), vAge);
    float alpha = soft * (1.0 - vAge) * uOpacity * 0.55;
    gl_FragColor = vec4(color, alpha);
  }
`

/** Aleta: um trapézio fino extrudado, encostado no corpo. */
function finGeometry(height: number) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(0.16 * height, -0.1 * height)
  shape.lineTo(0.16 * height, -0.3 * height)
  shape.lineTo(0, -0.3 * height)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.018 * height, bevelEnabled: false })
  geometry.translate(0, 0, -0.009 * height)
  return geometry
}

export function createRocket({ height, lightweight }: { height: number; lightweight: boolean }) {
  const object = new THREE.Group()
  const h = height
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const track = <G extends THREE.BufferGeometry>(g: G) => (geometries.push(g), g)
  const trackM = <M extends THREE.Material>(m: M) => (materials.push(m), m)

  /* Silhueta: quase opaca, para o campo atrás não vazar pelo corpo. */
  const hull = trackM(new THREE.MeshBasicMaterial({ color: ONYX, transparent: true, opacity: 0.92 }))
  const edgeCobalt = trackM(new THREE.LineBasicMaterial({ color: COBALT, transparent: true, opacity: 0.9 }))
  const edgeIvory = trackM(new THREE.LineBasicMaterial({ color: IVORY, transparent: true, opacity: 0.85 }))

  const parts: Array<{ solid: THREE.BufferGeometry; wire: THREE.BufferGeometry; y: number; edge: THREE.LineBasicMaterial }> = [
    {
      solid: track(new THREE.CylinderGeometry(0.11 * h, 0.13 * h, 0.62 * h, 24)),
      wire: track(new THREE.CylinderGeometry(0.11 * h, 0.13 * h, 0.62 * h, 8)),
      y: 0,
      edge: edgeCobalt,
    },
    {
      solid: track(new THREE.ConeGeometry(0.11 * h, 0.3 * h, 24)),
      wire: track(new THREE.ConeGeometry(0.11 * h, 0.3 * h, 8)),
      y: 0.46 * h,
      edge: edgeIvory,
    },
    {
      solid: track(new THREE.CylinderGeometry(0.07 * h, 0.11 * h, 0.14 * h, 16)),
      wire: track(new THREE.CylinderGeometry(0.07 * h, 0.11 * h, 0.14 * h, 8)),
      y: -0.38 * h,
      edge: edgeCobalt,
    },
  ]
  for (const part of parts) {
    const mesh = new THREE.Mesh(part.solid, hull)
    mesh.position.y = part.y
    object.add(mesh)
    /* Arestas do modelo de 8 lados: linhas longitudinais, leitura de holograma. */
    const edges = new THREE.LineSegments(track(new THREE.EdgesGeometry(part.wire, 1)), part.edge)
    edges.position.y = part.y
    object.add(edges)
  }

  const fin = track(finGeometry(h))
  const finWire = track(new THREE.EdgesGeometry(fin, 1))
  for (let k = 0; k < 3; k += 1) {
    const pivot = new THREE.Group()
    pivot.rotation.y = (k / 3) * Math.PI * 2
    const mesh = new THREE.Mesh(fin, hull)
    mesh.position.set(0.12 * h, -0.02 * h, 0)
    const edges = new THREE.LineSegments(finWire, edgeIvory)
    edges.position.copy(mesh.position)
    pivot.add(mesh, edges)
    object.add(pivot)
  }

  /* Chama: cone de ponta para baixo, base no bocal. */
  const flameGeometry = track(new THREE.ConeGeometry(0.085 * h, 0.9 * h, 16, 1, true))
  flameGeometry.rotateX(Math.PI)
  flameGeometry.translate(0, -0.45 * h, 0)
  const flameMaterial = trackM(
    new THREE.ShaderMaterial({
      vertexShader: FLAME_VERTEX,
      fragmentShader: FLAME_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uThrust: { value: 0 }, uOpacity: { value: 1 } },
    }),
  )
  const flame = new THREE.Mesh(flameGeometry, flameMaterial)
  flame.position.y = -0.45 * h
  object.add(flame)

  /* Ponto de luz no bocal. */
  const glowGeometry = track(new THREE.PlaneGeometry(0.5 * h, 0.5 * h))
  const glowMaterial = trackM(
    new THREE.ShaderMaterial({
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#ffd9a0') } },
    }),
  )
  const glow = new THREE.Mesh(glowGeometry, glowMaterial)
  glow.position.y = -0.48 * h
  object.add(glow)

  /* Brilho da plataforma: fica no chão, não sobe com o foguete. */
  const padGeometry = track(new THREE.PlaneGeometry(2.2 * h, 0.7 * h))
  const padMaterial = trackM(
    new THREE.ShaderMaterial({
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#ff9e57') } },
    }),
  )
  const pad = new THREE.Mesh(padGeometry, padMaterial)

  /* Fumaça: simulada aqui, em mundo, para ficar para trás quando o foguete
     sobe. 200 partículas é pouco para a CPU e o bastante para a leitura. */
  const smokeCount = lightweight ? 120 : 200
  const smokePositions = new Float32Array(smokeCount * 3)
  const smokeAges = new Float32Array(smokeCount)
  const smokeSizes = new Float32Array(smokeCount)
  const velocities = new Float32Array(smokeCount * 3)
  const lives = new Float32Array(smokeCount)
  for (let i = 0; i < smokeCount; i += 1) {
    smokeAges[i] = 1
    lives[i] = 1
    smokeSizes[i] = 6 + Math.random() * 10
  }
  const smokeGeometry = new THREE.BufferGeometry()
  const smokePosAttr = new THREE.BufferAttribute(smokePositions, 3)
  const smokeAgeAttr = new THREE.BufferAttribute(smokeAges, 1)
  smokeGeometry.setAttribute('position', smokePosAttr)
  smokeGeometry.setAttribute('aAge', smokeAgeAttr)
  smokeGeometry.setAttribute('aSize', new THREE.BufferAttribute(smokeSizes, 1))
  track(smokeGeometry)
  const smokeMaterial = trackM(
    new THREE.ShaderMaterial({
      vertexShader: SMOKE_VERTEX,
      fragmentShader: SMOKE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: { uPixelRatio: { value: 1 }, uOpacity: { value: 1 } },
    }),
  )
  const smoke = new THREE.Points(smokeGeometry, smokeMaterial)
  smoke.frustumCulled = false

  /* O grupo raiz junta o que sobe e o que fica. */
  const root = new THREE.Group()
  root.add(object, pad, smoke)

  let spawnCursor = 0
  let spawnDebt = 0

  const spawn = (x: number, y: number) => {
    const i = spawnCursor
    spawnCursor = (spawnCursor + 1) % smokeCount
    smokePositions[i * 3] = x + (Math.random() - 0.5) * 0.06 * h
    smokePositions[i * 3 + 1] = y
    smokePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.1 * h
    velocities[i * 3] = (Math.random() - 0.5) * 0.9 * h
    velocities[i * 3 + 1] = -(1.4 + Math.random() * 1.2) * h
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3 * h
    lives[i] = 0.7 + Math.random() * 0.6
    smokeAges[i] = 0
  }

  let modelLoaded = false
  if (ROCKET_MODEL_URL) {
    Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/DRACOLoader.js'),
    ]).then(([{ GLTFLoader }, { DRACOLoader }]) => {
      const draco = new DRACOLoader()
      draco.setDecoderPath('/draco/')
      const loader = new GLTFLoader()
      loader.setDRACOLoader(draco)
      loader.load(ROCKET_MODEL_URL, (gltf) => {
        const model = gltf.scene
        const box = new THREE.Box3().setFromObject(model)
        const size = new THREE.Vector3()
        box.getSize(size)
        const factor = h / Math.max(size.y, 0.0001)
        model.scale.setScalar(factor)
        box.setFromObject(model)
        const center = new THREE.Vector3()
        box.getCenter(center)
        model.position.sub(center)
        /* Some o estilizado, ficam chama, brilho e fumaça. */
        for (const child of [...object.children]) {
          if (child !== flame && child !== glow) child.visible = false
        }
        object.add(model)
        modelLoaded = true
      })
    })
  }

  return {
    object: root,
    update(state: RocketState, time: number, delta: number) {
      root.visible = state.visible || smokeAges.some((age) => age < 1)
      if (!root.visible) return

      const y = state.yPad + state.lift * state.travel
      object.position.set(state.x, y, 0)
      object.visible = state.visible
      /* Balanço mínimo no ar: 1,5 grau, para o foguete não parecer colado. */
      object.rotation.z = state.lift > 0 ? Math.sin(time * 1.7) * 0.026 * state.lift : 0

      flameMaterial.uniforms.uTime.value = time
      flameMaterial.uniforms.uThrust.value = state.thrust
      flameMaterial.uniforms.uOpacity.value = state.opacity
      glowMaterial.uniforms.uOpacity.value = state.thrust * state.opacity * 0.9

      pad.position.set(state.x, state.yPad - 0.5 * h, -0.05)
      padMaterial.uniforms.uOpacity.value =
        state.thrust * Math.max(0, 1 - state.lift * 2.5) * state.opacity * 0.7

      /* Fumaça: nasce no bocal enquanto há empuxo e o foguete está baixo. */
      const rate = state.thrust * Math.max(0, 1 - state.lift * 1.6) * (lightweight ? 70 : 110)
      spawnDebt += rate * delta
      while (spawnDebt >= 1) {
        spawn(state.x, y - 0.45 * h)
        spawnDebt -= 1
      }
      for (let i = 0; i < smokeCount; i += 1) {
        if (smokeAges[i] >= 1) continue
        smokeAges[i] = Math.min(1, smokeAges[i] + delta / lives[i])
        /* Perde velocidade e abre para os lados conforme envelhece. */
        velocities[i * 3 + 1] *= 1 - delta * 1.8
        velocities[i * 3] *= 1 - delta * 0.6
        smokePositions[i * 3] += velocities[i * 3] * delta
        smokePositions[i * 3 + 1] += velocities[i * 3 + 1] * delta
        smokePositions[i * 3 + 2] += velocities[i * 3 + 2] * delta
        /* Chão: a fumaça se espalha na horizontal ao bater na plataforma. */
        const floor = state.yPad - 0.5 * h
        if (smokePositions[i * 3 + 1] < floor) {
          smokePositions[i * 3 + 1] = floor
          velocities[i * 3] += Math.sign(velocities[i * 3] || 1) * 0.6 * h * delta * 10
          velocities[i * 3 + 1] = 0
        }
      }
      smokePosAttr.needsUpdate = true
      smokeAgeAttr.needsUpdate = true
      smokeMaterial.uniforms.uOpacity.value = state.opacity

      if (modelLoaded) object.rotation.y = time * 0.15
    },
    setPixelRatio(ratio: number) {
      smokeMaterial.uniforms.uPixelRatio.value = ratio
    },
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
    },
  }
}
```

Nota sobre `smokeAges.some(...)` por frame: 200 leituras, nada. Se `lightweight` e o `considerDowngrade` disparar, o `TriScene` esconde a fumaça (`smoke` é `root.children[2]`).

- [ ] **Step 2: Ligar em `scene/TriScene.tsx`**

Imports: acrescentar `rocketWindow, takeoffSpan` ao import de `./keyframes` e `import { createRocket } from './rocket'`.

Depois de `scene.add(stars.object)`:

```ts
    /* Foguete: altura em mundo pela largura da tela, para caber no celular. */
    const rocketHeight = Math.min(1.0, halfWidth * 1.15)
    const rocket = createRocket({ height: rocketHeight, lightweight })
    rocket.setPixelRatio(renderer.getPixelRatio())
    scene.add(rocket.object)
```

Depois de `let mobileTable = ...`:

```ts
    let takeoff = takeoffSpan(stageHeight / maxScroll)
```

Dentro de `remeasure` e de `onResize` (depois de `mobileTable = ...`), acrescentar:

```ts
      takeoff = takeoffSpan(stageHeight / maxScroll)
```

No objeto `current`, acrescentar `lift: 0, thrust: 0`:

```ts
    const current = { mix: 0.04, x: 0.58, y: 0.02, scale: 1, opacity: 1, form: 0, lift: 0, thrust: 0 }
```

No `tick`, depois da amostragem `const target = sampleKeyframes(...)`, acrescentar:

```ts
      const launch = rocketWindow(progress, takeoff)
```

Depois do bloco de amortecimento de `current.form`, acrescentar:

```ts
      /* O foguete também amortece: o scroll por toque chega em saltos. */
      current.lift += (launch.lift - current.lift) * damping
      current.thrust += (launch.thrust - current.thrust) * damping
      /* Tremor de câmera proporcional ao empuxo, some com o foguete. */
      const shake = current.thrust * Math.max(0, 1 - current.lift * 1.5) * 0.012
      const shakeX = (Math.random() - 0.5) * 2 * shake
      const shakeY = (Math.random() - 0.5) * 2 * shake
```

Trocar a linha do `uCenter` por:

```ts
      sphereMaterial.uniforms.uCenter.value.set(
        current.x * halfWidth + pointer.x * 0.05 + shakeX,
        current.y + pointer.y * -0.04 + shakeY,
      )
```

Depois de `stars.update(...)`:

```ts
      /* Meia altura visível de verdade: com o palco maior que a base, o FOV
         muda e a régua não é mais halfHeight. */
      const visibleHalfHeight = halfWidth / camera.aspect
      rocket.update(
        {
          visible: launch.visible || current.lift < 0.999,
          lift: current.lift,
          thrust: current.thrust,
          x: (narrow ? 0 : 0.58 * halfWidth) + shakeX * 2,
          yPad: -visibleHalfHeight + rocketHeight * 0.5 + 0.12 + shakeY * 2,
          travel: visibleHalfHeight * 2 + rocketHeight,
          opacity: 1,
        },
        time,
        delta,
      )
```

No bloco `restful`, garantir taxa cheia durante a decolagem:

```ts
      const restful =
        current.thrust < 0.01 &&
        current.opacity < 0.3 &&
        (current.mix > 0.85 || current.opacity <= 0.015)
```

Em `considerDowngrade`, depois da linha das estrelas: `rocket.object.children[2].visible = false`.

No cleanup, antes de `renderer.dispose()`: `rocket.dispose()`.

- [ ] **Step 3: Verificar tipos, lint, build**

Run:
```bash
npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run build
```
Expected: limpo. Se `three/examples/jsm/loaders/GLTFLoader.js` der erro de tipo, o `@types/three` já cobre `examples/jsm`; conferir que o import termina em `.js`.

- [ ] **Step 4: Conferência visual e de decolagem**

Preview no ar. Playwright 1280×900: screenshot em scroll 0 (foguete na plataforma à direita, chama curta, sem fumaça), em 25% da primeira tela (`window.scrollTo(0, innerHeight * 0.25)`, esperar 600 ms: foguete subindo, chama longa, fumaça no chão, brilho na plataforma), em 100% da primeira tela (foguete fora, fumaça dissipando). Repetir em 400×820 com o foguete centralizado: o texto do hero continua legível sobre ele (o foguete fica abaixo do `#hero-copy`; se sobrepor, reduzir `rocketHeight` para `halfWidth * 0.95` no celular).

Ajustar `yPad` se a plataforma cortar no rodapé da dobra; ajustar `0.58 * halfWidth` se encostar nos botões do hero no desktop.

- [ ] **Step 5: Medir fluidez**

Com o preview no ar, no Playwright a 400×820 e a 1280×900, rodar o mesmo medidor das rodadas anteriores:

```js
() => new Promise((resolve) => {
  const max = document.documentElement.scrollHeight - window.innerHeight
  const step = 14
  const gaps = []
  let last = performance.now()
  let y = 0
  const tick = (now) => {
    gaps.push(now - last)
    last = now
    y += step
    window.scrollTo(0, y)
    if (y < max) requestAnimationFrame(tick)
    else {
      const sorted = [...gaps].sort((a, b) => a - b)
      resolve({
        avg: +(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(2),
        p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
        worst: +sorted[sorted.length - 1].toFixed(2),
        long: +((gaps.filter((g) => g > 24).length / gaps.length) * 100).toFixed(2),
      })
    }
  }
  requestAnimationFrame(tick)
})
```

Rodar duas vezes por largura (a primeira aquece mídia). Registrar a segunda. Meta: 400 px com `long` 0; 1280 px sem piorar o último valor registrado no README (12%). Se piorar no celular, reduzir `smokeCount` para 80 e a contagem de estrelas para 800 e medir de novo.

- [ ] **Step 6: Commit**

```bash
git add src/components/scene/rocket.ts src/components/scene/TriScene.tsx
git commit -m "feat: foguete na plataforma do hero, decola na primeira tela

Foguete estilizado no visual da marca: silhueta escura com arestas em linha,
cobalto e ivory. Chama por shader com o comprimento no empuxo, fumaça de 200
pontos simulada na CPU que fica para trás no chão, brilho na plataforma e
tremor de câmera que some com o foguete. Gancho ROCKET_MODEL_URL carrega um
GLB com Draco e esconde o estilizado; vazio, não baixa nada.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: README, PR e preview

**Files:**
- Modify: `README.md` (seção "Cena" e tabela de medições)

- [ ] **Step 1: Atualizar o README**

Na seção que começa com "`TriScene.tsx` desenha um canvas fixo" (linha ~90), trocar o primeiro parágrafo por:

```markdown
A cena mora em `src/components/scene/`: `TriScene.tsx` (mount, palco, loop), `keyframes.ts` (tabelas e funções puras, testadas com `npm test`), `triangles.ts` (a matéria e os shaders), `stars.ts` (estrelas ao fundo) e `rocket.ts` (foguete, chama, fumaça, gancho GLB em `ROCKET_MODEL_URL`). `src/components/TriScene.tsx` só reexporta.

O hero é do foguete: ele está na plataforma ao abrir e decola na primeira tela de rolagem (`takeoffSpan`, 90% de uma tela). O planeta entra nos Serviços pela borda direita e chega inteiro ao centro no Manifesto, onde explode. Dali a narrativa segue como antes:
```

Na tabela de medições de fluidez, acrescentar uma linha com os números do passo 5 da tarefa 4, com a data.

- [ ] **Step 2: Commit e PR**

```bash
git add README.md
git commit -m "docs: cena em módulos e o hero do foguete no README

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin feat/cena-espacial
gh pr create --title "feat: cena espacial, fase 1 — estrelas e foguete" --body "$(cat <<'EOF'
Fase 1 do spec `docs/superpowers/specs/2026-09-13-cena-espacial-design.md`.

- Cena dividida em `src/components/scene/` sem mudança visual; funções puras testadas com `npm test`.
- Estrelas ao fundo descendo com o scroll.
- Foguete estilizado no hero, decola na primeira tela: chama, fumaça, brilho da plataforma, tremor de câmera.
- Hero sem planeta; planeta nos Serviços e no Manifesto.

Medições de fluidez no README. Preview do Netlify neste PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Conferir o preview**

Abrir a URL de deploy preview do Netlify que o bot comenta no PR. Conferir hero, decolagem e Serviços no celular de verdade. Se o `gh` não estiver autenticado, abrir o PR pelo link que o `git push` imprime e copiar o corpo acima.

---

## Self-review

- Cobertura do spec, fase 1: módulos (T1), estrelas (T2), janela de decolagem e tabelas (T3), foguete com chama, fumaça, plataforma, tremor e gancho GLB (T4), medição e PR (T5). Planeta com shader, buraco negro e halo são fases 2 a 4, fora deste plano.
- Nomes usados entre tarefas: `takeoffSpan`, `rocketWindow`, `RocketWindow`, `createStars`, `StarsState`, `createRocket`, `RocketState`, `ROCKET_MODEL_URL`, `setPixelRatio` — iguais em definição e uso.
- `current.lift`/`current.thrust` são definidos na T4 e só usados lá.
