import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildScene } from '../gen.mjs'
import { CENTER, EFFECTS, LEFT, RIGHT, SEAM_L, SEAM_R, VISIBLE } from '../layout.mjs'

const scene = buildScene()
const GROUPS = { left: LEFT, center: CENTER, right: RIGHT }
const BLEED = new Set(['palm-fronds', 'cliff-bleed'])
const part = name => scene.parts.find(p => p.name === name)
const inside = (box, [a, b]) => box[0] >= a && box[2] <= b

test('every part sits in its group', () => {
  for (const p of scene.parts) {
    if (BLEED.has(p.name)) {
      assert.ok(p.box[2] <= VISIBLE[0] || p.box[0] >= VISIBLE[1], `${p.name} bleeds only outside the visible columns: ${p.box}`)
      continue
    }
    assert.ok(inside(p.box, GROUPS[p.group]), `${p.name} ${p.box} inside ${p.group} ${GROUPS[p.group]}`)
  }
})

test('groups cover the listed art', () => {
  const want = {
    left: ['palm', 'signs', 'crystal', 'computer', 'toys'],
    center: ['hero', 'slime', 'ledge', 'sun', 'moon', 'floating-castle'],
    right: ['cliff', 'fortress', 'campfire', 'guitars', 'amp', 'books'],
  }
  for (const [group, names] of Object.entries(want)) for (const name of names) assert.equal(part(name)?.group, group, name)
  assert.ok(part('mushroom'), 'mushroom placed')
  assert.ok(part('princess-sign'), 'princess sign placed')
})

test('seams tile', () => {
  for (const [seam, [a, b]] of [['L', SEAM_L], ['R', SEAM_R]]) {
    const w = b - a
    const cols = scene.seamColumns(seam, 2 * w)
    assert.equal(cols.length, 2 * w)
    for (let i = 0; i < w; i++) assert.equal(cols[i], cols[i + w], `seam ${seam} column ${i}`)
  }
})

test('seams hold only filler', () => {
  for (const p of scene.parts) {
    if (BLEED.has(p.name)) continue
    for (const [a, b] of [SEAM_L, SEAM_R]) assert.ok(p.box[2] <= a || p.box[0] >= b, `${p.name} ${p.box} overlaps seam ${a}-${b}`)
  }
})

test('under the size limit', () => {
  assert.ok(scene.svg.length < 131072, `${scene.svg.length} characters`)
})

test('portrait keeps the hero centered', () => {
  const rule = scene.svg.match(/@media \(max-aspect-ratio: 1\/1\)\{\.mid\{transform:translateX\((-?\d+)px\)\}\}/)
  const shift = rule ? Number(rule[1]) : 0
  const [x0, , x1] = EFFECTS.heroBox
  assert.ok(x0 + shift >= CENTER[0] && x1 + shift <= CENTER[1], `hero box shifted by ${shift}`)
})

test('effect anchors match the art', () => {
  const within = ([x, y], box) => x >= box[0] && x < box[2] && y >= box[1] && y < box[3]
  assert.ok(within(EFFECTS.fire, part('campfire').box), 'fire anchor in the campfire')
  assert.ok(within(EFFECTS.crystal, part('crystal').box), 'crystal anchor in the crystal')
  for (const name of ['hero', 'slime']) {
    const b = part(name).box, h = EFFECTS.heroBox
    assert.ok(b[0] >= h[0] && b[1] >= h[1] && b[2] <= h[2] && b[3] <= h[3], `${name} ${b} inside hero box ${h}`)
  }
})

test('the left group never ripples', () => {
  const inside = (b, h) => b[0] >= h[0] && b[1] >= h[1] && b[2] <= h[2] && b[3] <= h[3]
  assert.ok(EFFECTS.deskBox, 'EFFECTS.deskBox exists')
  for (const name of ['computer', 'toys']) assert.ok(inside(part(name).box, EFFECTS.deskBox), `${name} ${part(name).box} inside the desk box ${EFFECTS.deskBox}`)
})

test('the sun and moon path stays free to ripple', () => {
  const [x0, y0, x1, y1] = EFFECTS.heroBox
  const blocked = (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1
  for (let y = EFFECTS.seaTop + 1; y < 175; y++) assert.ok(!blocked(EFFECTS.sunX, y), `sun path row ${y} is masked`)
})
