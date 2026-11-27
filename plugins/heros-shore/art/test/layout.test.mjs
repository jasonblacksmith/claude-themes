import { test } from 'node:test'
import assert from 'node:assert/strict'

import { CENTER, LEFT, RIGHT, SEAM_L, SEAM_R, estimatePanels, freeColumns, placeGroups, sourceColumn } from '../layout.mjs'

// The prompt box as measured in the app: 646 px wide at most, centered in the free area.
// The sidebar measured 315 px beside it.
function box(windowPx, leftPx, rightPx) {
  const free = windowPx - leftPx - rightPx
  const width = Math.min(646, free - 48)
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
  const { freeLeft, o } = layout(1440, 900, 315, 0)
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
  const { o } = layout(1440, 900, 315, 0)
  const from = LEFT[1] + o.oL, to = CENTER[0] + o.oC
  assert.ok(to > from)
  for (const x of span(from, to)) {
    const s = sourceColumn(x, o)
    assert.ok(s >= SEAM_L[0] && s < SEAM_L[1], `column ${x} maps into the left seam`)
    assert.equal(s, SEAM_L[0] + ((x - from) % 92))
  }
})

test('narrow window stays in the picture', () => {
  const { freeLeft, freeRight, pictureLeft, pictureRight, o } = layout(1024, 768, 315, 0)
  for (const x of span(Math.round(freeLeft), Math.round(freeRight))) {
    const s = sourceColumn(x, o)
    assert.ok(s >= Math.ceil(pictureLeft) && s < Math.floor(pictureRight), `column ${x} samples ${s}`)
  }
})

test('no prompt box', () => {
  assert.deepEqual(estimatePanels(0, 0, 1440), { leftPx: 0, rightPx: 0, dividerPx: 0 })
  assert.deepEqual(estimatePanels(800, 700, 1440), { leftPx: 0, rightPx: 0, dividerPx: 0 })
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

const near = (a, b) => Math.abs(a - b) <= 2

test('both panels solved from the sidebar width', () => {
  const [bl, br] = box(2000, 315, 235)
  const { leftPx, rightPx } = estimatePanels(bl, br, 2000)
  assert.ok(near(leftPx, 315) && near(rightPx, 235), `got ${leftPx}, ${rightPx}`)
})

test('a sidebar alone stays a sidebar', () => {
  const [bl, br] = box(2000, 315, 0)
  const { leftPx, rightPx } = estimatePanels(bl, br, 2000)
  assert.ok(near(leftPx, 315) && rightPx === 0, `got ${leftPx}, ${rightPx}`)
})

test('a right pane alone stays a right pane', () => {
  const [bl, br] = box(2000, 0, 317)
  const { leftPx, rightPx } = estimatePanels(bl, br, 2000)
  assert.ok(leftPx === 0 && near(rightPx, 317), `got ${leftPx}, ${rightPx}`)
})

test('a box a few px off center is no panels', () => {
  assert.deepEqual(estimatePanels(677 + 4, 1323 + 4, 2000), { leftPx: 0, rightPx: 0, dividerPx: 0 })
})

test('beyond a pushed-in group the edge shows open sea', () => {
  const { pictureLeft, freeLeft, o } = layout(1440, 900, 315, 0)
  for (const x of span(Math.ceil(pictureLeft), Math.round(freeLeft))) {
    const s = sourceColumn(x, o)
    assert.ok(s >= SEAM_L[0] && s < SEAM_L[1], `column ${x} under the sidebar samples ${s}`)
  }
  const r = layout(1440, 900, 0, 576)
  for (const x of span(Math.round(r.freeRight), Math.floor(r.pictureRight))) {
    const s = sourceColumn(x, r.o)
    assert.ok(s >= SEAM_R[0] && s < SEAM_R[1], `column ${x} under the pane samples ${s}`)
  }
})

// Split view, as measured: sidebar 0–315, left conversation 315–1158, right 1158–2000, each
// with its 646 px box centered (413–1060 and 1255–1902).
test('split view, read from the left conversation', () => {
  const p = estimatePanels(413, 1060, 2000)
  assert.ok(near(p.leftPx, 315) && p.rightPx === 0 && near(p.dividerPx, 1158), `got ${JSON.stringify(p)}`)
})

test('split view, read from the right conversation', () => {
  const p = estimatePanels(1255, 1902, 2000)
  assert.ok(near(p.leftPx, 315) && p.rightPx === 0 && near(p.dividerPx, 1158), `got ${JSON.stringify(p)}`)
})

test('split view with no sidebar', () => {
  const p = estimatePanels(177, 823, 2000)
  assert.ok(p.leftPx === 0 && p.rightPx === 0 && near(p.dividerPx, 1000), `got ${JSON.stringify(p)}`)
})

test('panels alone are not split view', () => {
  for (const [l, r] of [[0, 0], [315, 0], [315, 235], [0, 317]]) {
    const [bl, br] = box(2000, l, r)
    assert.equal(estimatePanels(bl, br, 2000).dividerPx, 0, `panels ${l}, ${r}`)
  }
})

test('split view centers the hero group on the divider', () => {
  const f = freeColumns(413, 1060, 2000, 1110)
  const o = placeGroups(f.freeLeft, f.freeRight, f.pictureLeft, f.pictureRight, f.dividerCol)
  const sC = Math.max(2000 / 480, 1110 / 270)
  const dividerCol = f.pictureLeft + 1158 / sC
  assert.ok(Math.abs((CENTER[0] + CENTER[1]) / 2 + o.oC - dividerCol) <= 1, `center at ${(CENTER[0] + CENTER[1]) / 2 + o.oC}, divider ${dividerCol}`)
  assert.ok(o.oL > 0, 'left group pushed out from under the sidebar')
})

// Final review findings
test('a plain narrow window is not split view', () => {
  for (const w of [945, 960]) {
    const half = Math.min(646, w - 48) / 2
    assert.equal(estimatePanels(w / 2 - half, w / 2 + half, w).dividerPx, 0, `${w} px window`)
  }
  const [bl, br] = box(1440, 0, 235)
  assert.equal(estimatePanels(bl, br, 1440).dividerPx, 0, 'a 235 px pane on a 1440 px window')
})

test('near-square windows never sample past the picture', () => {
  for (const [l, r] of [[315, 0], [0, 400], [315, 235]]) {
    const { pictureLeft, pictureRight, o } = layout(960, 1040, l, r)
    for (const x of span(Math.ceil(pictureLeft), Math.floor(pictureRight))) {
      const s = sourceColumn(x, o)
      assert.ok(s >= Math.ceil(pictureLeft) && s < Math.floor(pictureRight), `panels ${l}/${r}: column ${x} samples ${s}`)
    }
  }
})
