import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { CENTER, CENTERED_PX, EFFECTS, LEFT, RIGHT, SEAM_L, SEAM_R, SIDEBAR_PER_BOX, VISIBLE } from '../layout.mjs'

// hooks/shore.ts can't import (the shader language allows only 'claude-code/shader'), so it
// repeats the layout's numbers. This holds the copy to the source.
const source = readFileSync(new URL('../../hooks/shore.ts', import.meta.url), 'utf8')
const consts = Object.fromEntries([...source.matchAll(/^const ([A-Z][A-Z0-9_]*) = (-?\d+(?:\.\d+)?)\s*$/gm)].map(([, k, v]) => [k, Number(v)]))

test('shader constants match the layout', () => {
  const want = {
    L0: LEFT[0], L1: LEFT[1], SL0: SEAM_L[0], SL1: SEAM_L[1], C0: CENTER[0], C1: CENTER[1],
    SR0: SEAM_R[0], SR1: SEAM_R[1], R0: RIGHT[0], R1: RIGHT[1], V0: VISIBLE[0], V1: VISIBLE[1],
    FIRE_X: EFFECTS.fire[0], FIRE_Y: EFFECTS.fire[1], CRYSTAL_X: EFFECTS.crystal[0], CRYSTAL_Y: EFFECTS.crystal[1],
    HERO_X0: EFFECTS.heroBox[0], HERO_Y0: EFFECTS.heroBox[1], HERO_X1: EFFECTS.heroBox[2], HERO_Y1: EFFECTS.heroBox[3],
    SIGN_X0: EFFECTS.signBox[0], SIGN_Y0: EFFECTS.signBox[1], SIGN_X1: EFFECTS.signBox[2], SIGN_Y1: EFFECTS.signBox[3],
    SEA_TOP: EFFECTS.seaTop, SEA_BOTTOM: EFFECTS.seaBottom, SUN_X: EFFECTS.sunX, CENTERED_PX,
    DESK_X0: EFFECTS.deskBox?.[0], DESK_Y0: EFFECTS.deskBox?.[1], DESK_X1: EFFECTS.deskBox?.[2], DESK_Y1: EFFECTS.deskBox?.[3],
  }
  for (const [name, value] of Object.entries(want)) assert.equal(consts[name], value, `const ${name} in hooks/shore.ts`)
  assert.ok(Math.abs(consts.SIDEBAR_PER_BOX - SIDEBAR_PER_BOX) < 1e-6, `const SIDEBAR_PER_BOX in hooks/shore.ts: ${consts.SIDEBAR_PER_BOX}`)
})
