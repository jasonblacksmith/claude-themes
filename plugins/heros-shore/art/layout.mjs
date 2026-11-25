// Hero's Shore layout: the single source of the scene's column ranges and of the math that
// pins its three art groups to the space the desktop app's panels leave free.
// art/gen.mjs places art by these numbers; hooks/shore.ts mirrors them (a shader can't
// import), and test/shader-sync.test.mjs checks the mirror.
//
// Ranges are half-open [start, end) scene columns of the 480x270 scene.

export const VISIBLE = [24, 456] // the columns a 16:10 window shows; groups live inside
export const LEFT = [24, 98]
export const SEAM_L = [98, 190]
export const CENTER = [190, 290]
export const SEAM_R = [290, 382]
export const RIGHT = [382, 456]

// Where the shader's effects attach, in scene cells. gen.mjs draws the art at these anchors.
export const EFFECTS = {
  fire: [398, 240], // the campfire's flames
  crystal: [84, 84], // the floating crystal's heart
  heroBox: [190, 160, 290, 232], // hero, sword, scarf and slime: never rippled
  signBox: [382, 70, 456, 270], // the right group's foreground (sign, mushroom, guitars): never rippled
  deskBox: [24, 150, 98, 270], // the left group's foreground (computer, d20, toys): never rippled
  seaTop: 151,
  seaBottom: 211,
  sunX: 240, // the glitter path's center
}

const W = 480
const H = 270
const MID = (CENTER[0] + CENTER[1]) / 2

const mod = (a, n) => ((a % n) + n) % n

// The sidebar's width as a share of the prompt box's, measured in the desktop app (2026-11-24:
// sidebar 315 px beside a 646 px box). Both are drawn at fixed sizes, so the share holds at any
// zoom, and the box tells the shader how wide the sidebar must be.
export const SIDEBAR_PER_BOX = 315 / 646
// A box this close to the window's middle is centered: no panels.
export const CENTERED_PX = 8

// The panels' widths in px, from the prompt box, which sits centered in the free area. The box's
// shift from the middle gives d = left − right. A shift close to a whole sidebar is the sidebar
// alone; a smaller rightward shift is the sidebar plus a narrower right pane; a leftward shift is
// read as a right pane alone (a sidebar with a wider right pane can't be told from it).
//
// Split view (two conversations side by side) is read first. The two panes share the space
// right of the sidebar S equally and the box is centered in its own pane, so its center is
// S + (W − S)/4 in the left pane or S + 3(W − S)/4 in the right. Solving each for S, a split is
// one where S comes out as no sidebar or as the sidebar's width. Both panes solve to the same S,
// so it doesn't matter which conversation the backdrop follows. dividerPx is then the line
// between the panes (0 when not split).
export const SPLIT_TOLERANCE_PX = 12

export function estimatePanels(boxLeftPx, boxRightPx, windowPx) {
  const none = { leftPx: 0, rightPx: 0, dividerPx: 0 }
  if (!(boxRightPx > boxLeftPx)) return none
  const sidebar = SIDEBAR_PER_BOX * (boxRightPx - boxLeftPx)
  const center = (boxLeftPx + boxRightPx) / 2
  for (const s of [(4 * center - windowPx) / 3, 4 * center - 3 * windowPx]) {
    const sidebarPx = Math.abs(s) <= SPLIT_TOLERANCE_PX ? 0 : Math.abs(s - sidebar) <= SPLIT_TOLERANCE_PX ? s : -1
    if (sidebarPx >= 0) return { leftPx: sidebarPx, rightPx: 0, dividerPx: sidebarPx + (windowPx - sidebarPx) / 2 }
  }
  const d = boxLeftPx + boxRightPx - windowPx
  if (Math.abs(d) <= CENTERED_PX) return none
  if (d >= 0.85 * sidebar) return { leftPx: Math.min(d, windowPx), rightPx: 0, dividerPx: 0 }
  if (d > 0) return { leftPx: sidebar, rightPx: sidebar - d, dividerPx: 0 }
  return { leftPx: 0, rightPx: Math.min(-d, windowPx), dividerPx: 0 }
}

// The free area in scene columns, and the columns the Svg's picture holds ("slice" crop).
export function freeColumns(boxLeftPx, boxRightPx, windowPx, windowHeightPx) {
  const sC = Math.max(windowPx / W, windowHeightPx / H)
  const pictureLeft = W / 2 - windowPx / (2 * sC)
  const pictureRight = W / 2 + windowPx / (2 * sC)
  const { leftPx, rightPx, dividerPx } = estimatePanels(boxLeftPx, boxRightPx, windowPx)
  const dividerCol = dividerPx > 0 ? pictureLeft + dividerPx / sC : 0
  return { freeLeft: pictureLeft + leftPx / sC, freeRight: pictureRight - rightPx / sC, pictureLeft, pictureRight, dividerCol }
}

// Whole-column offsets for each group. Outer groups pin by their visible edge (columns the
// picture lacks are lost, as on any narrow window); the center sits between them or, when
// they leave it too little room, in the middle of the free area, where it wins. In split view
// (dividerCol > 0) it centers on the divider between the two conversations instead.
export function placeGroups(freeLeft, freeRight, pictureLeft = VISIBLE[0], pictureRight = VISIBLE[1], dividerCol = 0) {
  const leftEdge = Math.max(LEFT[0], Math.ceil(pictureLeft))
  const rightEdge = Math.min(RIGHT[1], Math.floor(pictureRight))
  const oL = Math.max(0, Math.round(freeLeft) - leftEdge)
  const oR = Math.min(0, Math.round(freeRight) - rightEdge)
  const lEnd = LEFT[1] + oL
  const rStart = RIGHT[0] + oR
  const oC = dividerCol > 0 ? Math.round(dividerCol - MID)
    : rStart - lEnd >= CENTER[1] - CENTER[0] ? Math.round((lEnd + rStart) / 2 - MID) : Math.round((freeLeft + freeRight) / 2 - MID)
  return { oL, oC, oR, leftEdge, rightEdge }
}

// The scene column to sample for display column x: the center first, then the outer groups
// (with their bleed while they sit at the window's edge; open sea beyond them once a panel
// pushes them in), then the seams, repeated from the edge of the group before them.
export function sourceColumn(x, { oL, oC, oR, leftEdge = LEFT[0], rightEdge = RIGHT[1] }) {
  if (x >= CENTER[0] + oC && x < CENTER[1] + oC) return x - oC
  if (x < LEFT[1] + oL) return oL > 0 && x < leftEdge + oL ? SEAM_L[0] + mod(x - (LEFT[1] + oL), SEAM_L[1] - SEAM_L[0]) : x - oL
  if (x >= RIGHT[0] + oR) return oR < 0 && x >= rightEdge + oR ? SEAM_R[0] + mod(x - (CENTER[1] + oC), SEAM_R[1] - SEAM_R[0]) : x - oR
  if (x < CENTER[0] + oC) return SEAM_L[0] + mod(x - (LEFT[1] + oL), SEAM_L[1] - SEAM_L[0])
  return SEAM_R[0] + mod(x - (CENTER[1] + oC), SEAM_R[1] - SEAM_R[0])
}
