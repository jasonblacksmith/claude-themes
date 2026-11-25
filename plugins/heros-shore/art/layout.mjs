// Hero's Shore layout: the single source of the scene's column ranges and of the math that
// pins its three art groups to the space the desktop app's panels leave free.
// art/gen.mjs places art by these numbers; hooks/shore.ts mirrors them (a shader can't
// import), and test/shader-sync.test.mjs checks the mirror.
//
// Ranges are half-open [start, end) scene columns of the 480x270 scene.

export const VISIBLE = [24, 456] // the columns a 16:10 window shows; groups live inside
export const LEFT = [24, 99]
export const SEAM_L = [99, 190]
export const CENTER = [190, 290]
export const SEAM_R = [290, 381]
export const RIGHT = [381, 456]

const W = 480
const H = 270
const MID = (CENTER[0] + CENTER[1]) / 2

const mod = (a, n) => ((a % n) + n) % n

// The panels' widths in px, from the prompt box, which sits centered in the free area.
// Only the difference of the two widths can be read, so the shift goes to one side.
export function estimatePanels(boxLeftPx, boxRightPx, windowPx) {
  if (!(boxRightPx > boxLeftPx)) return { leftPx: 0, rightPx: 0 }
  const shiftPx = (boxLeftPx + boxRightPx) / 2 - windowPx / 2
  const side = Math.min(Math.abs(2 * shiftPx), windowPx)
  return shiftPx > 0 ? { leftPx: side, rightPx: 0 } : { leftPx: 0, rightPx: shiftPx < 0 ? side : 0 }
}

// The free area in scene columns, and the columns the Svg's picture holds ("slice" crop).
export function freeColumns(boxLeftPx, boxRightPx, windowPx, windowHeightPx) {
  const sC = Math.max(windowPx / W, windowHeightPx / H)
  const pictureLeft = W / 2 - windowPx / (2 * sC)
  const pictureRight = W / 2 + windowPx / (2 * sC)
  const { leftPx, rightPx } = estimatePanels(boxLeftPx, boxRightPx, windowPx)
  return { freeLeft: pictureLeft + leftPx / sC, freeRight: pictureRight - rightPx / sC, pictureLeft, pictureRight }
}

// Whole-column offsets for each group. Outer groups pin by their visible edge (columns the
// picture lacks are lost, as on any narrow window); the center sits between them or, when
// they leave it too little room, in the middle of the free area, where it wins.
export function placeGroups(freeLeft, freeRight, pictureLeft = VISIBLE[0], pictureRight = VISIBLE[1]) {
  const leftEdge = Math.max(LEFT[0], Math.ceil(pictureLeft))
  const rightEdge = Math.min(RIGHT[1], Math.floor(pictureRight))
  const oL = Math.max(0, Math.round(freeLeft) - leftEdge)
  const oR = Math.min(0, Math.round(freeRight) - rightEdge)
  const lEnd = LEFT[1] + oL
  const rStart = RIGHT[0] + oR
  const oC = rStart - lEnd >= CENTER[1] - CENTER[0] ? Math.round((lEnd + rStart) / 2 - MID) : Math.round((freeLeft + freeRight) / 2 - MID)
  return { oL, oC, oR }
}

// The scene column to sample for display column x: the center first, then the outer groups
// (with their bleed), then the seams, repeated from the edge of the group before them.
export function sourceColumn(x, { oL, oC, oR }) {
  if (x >= CENTER[0] + oC && x < CENTER[1] + oC) return x - oC
  if (x < LEFT[1] + oL) return x - oL
  if (x >= RIGHT[0] + oR) return x - oR
  if (x < CENTER[0] + oC) return SEAM_L[0] + mod(x - (LEFT[1] + oL), SEAM_L[1] - SEAM_L[0])
  return SEAM_R[0] + mod(x - (CENTER[1] + oC), SEAM_R[1] - SEAM_R[0])
}
