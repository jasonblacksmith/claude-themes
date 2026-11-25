import { test } from 'node:test'
import assert from 'node:assert/strict'

import { CENTER, LEFT, RIGHT, SEAM_L, estimatePanels, freeColumns, placeGroups, sourceColumn } from '../layout.mjs'

// A prompt box 768 px wide (or narrower when there's no room), centered in the free area.
function box(windowPx, leftPx, rightPx) {
  const free = windowPx - leftPx - rightPx
  const width = Math.min(768, free - 48)
  const center = leftPx + free / 2
  return [center - width / 2, center + width / 2]
}

function layout(windowPx, heightPx, leftPx, rightPx) {
  const [bl, br] = box(windowPx, leftPx, rightPx)
  const f = freeColumns(bl, br, windowPx, heightPx)
  return { ...f, o: placeGroups(f.freeLeft, f.freeRight, f.pictureLeft, f.pictureRight) }
}

const span = (a, b) => Array.from({ length: b - a }, (_, i) => a + i)

test('identity with no panels', () => {
  for (const [w, h] of [[1920, 1080], [1440, 900]]) {
    const { o, pictureLeft, pictureRight } = layout(w, h, 0, 0)
    for (const x of span(Math.ceil(pictureLeft), Math.floor(pictureRight))) assert.equal(sourceColumn(x, o), x, `${w}x${h} column ${x}`)
  }
})

test('sidebar keeps the left group whole', () => {
  const { freeLeft, o } = layout(1440, 900, 300, 0)
  assert.equal(o.oL, Math.round(freeLeft) - 24)
  const start = Math.round(freeLeft)
  assert.deepEqual(span(start, start + 74).map(x => sourceColumn(x, o)), span(LEFT[0], LEFT[1]))
  const mapped = new Set(span(start, 456).map(x => sourceColumn(x, o)))
  for (const c of span(CENTER[0], CENTER[1])) assert.ok(mapped.has(c), `center column ${c}`)
  for (const c of span(RIGHT[0], RIGHT[1])) assert.ok(mapped.has(c), `right column ${c}`)
})

test('right pane moves the right group', () => {
  const { freeLeft, freeRight, o } = layout(1440, 900, 0, 576)
  assert.ok(o.oR < 0)
  assert.equal(sourceColumn(Math.round(freeRight) - 1, o), 455)
  const mapped = new Set(span(Math.round(freeLeft), Math.round(freeRight)).map(x => sourceColumn(x, o)))
  for (const c of [...span(LEFT[0], LEFT[1]), ...span(CENTER[0], CENTER[1]), ...span(RIGHT[0], RIGHT[1])]) assert.ok(mapped.has(c), `column ${c}`)
})

test('both panels: center wins', () => {
  const freeLeft = 150, freeRight = 320
  const o = placeGroups(freeLeft, freeRight, 24, 456)
  const shown = span(freeLeft, freeRight).map(x => sourceColumn(x, o))
  for (const c of span(CENTER[0], CENTER[1])) assert.equal(shown.filter(s => s === c).length, 1, `center column ${c}`)
  const mid = (CENTER[0] + CENTER[1]) / 2 + o.oC
  assert.ok(Math.abs(mid - (freeLeft + freeRight) / 2) <= 1)
})

test('seams repeat', () => {
  const { o } = layout(1440, 900, 300, 0)
  const from = LEFT[1] + o.oL, to = CENTER[0] + o.oC
  assert.ok(to > from)
  for (const x of span(from, to)) {
    const s = sourceColumn(x, o)
    assert.ok(s >= SEAM_L[0] && s < SEAM_L[1], `column ${x} maps into the left seam`)
    assert.equal(s, SEAM_L[0] + ((x - from) % 92))
  }
})

test('narrow window stays in the picture', () => {
  const { freeLeft, freeRight, pictureLeft, pictureRight, o } = layout(1024, 768, 300, 0)
  for (const x of span(Math.round(freeLeft), Math.round(freeRight))) {
    const s = sourceColumn(x, o)
    assert.ok(s >= Math.ceil(pictureLeft) && s < Math.floor(pictureRight), `column ${x} samples ${s}`)
  }
})

test('no prompt box', () => {
  assert.deepEqual(estimatePanels(0, 0, 1440), { leftPx: 0, rightPx: 0 })
  assert.deepEqual(estimatePanels(800, 700, 1440), { leftPx: 0, rightPx: 0 })
})

test('tiny free area', () => {
  const freeLeft = 210, freeRight = 270
  const o = placeGroups(freeLeft, freeRight, 24, 456)
  for (const v of Object.values(o)) assert.ok(Number.isInteger(v))
  const shown = span(freeLeft, freeRight).map(x => sourceColumn(x, o))
  const lostLeft = Math.min(...shown) - CENTER[0], lostRight = CENTER[1] - 1 - Math.max(...shown)
  assert.ok(Math.abs(lostLeft - lostRight) <= 1)
})

test('integers only', () => {
  for (const [w, h, l, r] of [[1440, 900, 300, 0], [1440, 900, 0, 576], [1333, 777, 211, 377]]) {
    const { o } = layout(w, h, l, r)
    for (const x of span(0, 480)) assert.ok(Number.isInteger(sourceColumn(x, o)))
  }
})
