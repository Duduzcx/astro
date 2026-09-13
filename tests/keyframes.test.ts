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
