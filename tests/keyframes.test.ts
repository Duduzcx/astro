import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sampleKeyframes,
  KEYFRAMES,
  mobileKeyframes,
  rocketWindow,
  takeoffSpan,
  planetBreak,
  holePresence,
  novaPresence,
} from '../src/components/scene/keyframes.ts'

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
  ] as unknown as Parameters<typeof sampleKeyframes>[0]
  const mid = sampleKeyframes(table, 0.5)
  assert.equal(mid.mix, 0.5)
  assert.equal(mid.scale, 1.5)
  assert.equal(mid.form, 1.5)
  /* smoothstep: em 0,25 fica abaixo do linear. */
  const quarter = sampleKeyframes(table, 0.25)
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

test('takeoffSpan é uma fração da tela de rolagem, com teto', () => {
  /* Dois terços de tela: a decolagem acontece em menos rolagem do que uma
     tela inteira, senão o foguete sobe devagar demais para quem rola. */
  assert.ok(Math.abs(takeoffSpan(0.04) - 0.0248) < 1e-9)
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

test('planetBreak: inteiro agrupado, em pedaços disperso, some noutro astro', () => {
  assert.equal(planetBreak(0.05, 0), 0)
  assert.equal(planetBreak(1, 0), 1)
  assert.equal(planetBreak(0.05, 1), 1)
  const a = planetBreak(0.3, 0)
  const b = planetBreak(0.5, 0)
  assert.ok(a > 0 && b > a && b < 1, 'cresce com a dispersão')
})

test('holePresence: cheio em 1, zero nos vizinhos, meio no caminho', () => {
  assert.equal(holePresence(1), 1)
  assert.equal(holePresence(0), 0)
  assert.equal(holePresence(2), 0)
  assert.equal(holePresence(1.5), 0.5)
})

test('novaPresence: zero até a estrela, cheio na supernova', () => {
  assert.equal(novaPresence(1), 0)
  assert.equal(novaPresence(2), 0)
  assert.equal(novaPresence(2.5), 0.5)
  assert.equal(novaPresence(3), 1)
})
