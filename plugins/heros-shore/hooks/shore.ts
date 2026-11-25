// Hero's Shore, played on the GPU over the pixel-art scene: it pins the scene's three groups of
// art beside the app's panels, ripples the sea, scatters glints along the sun or moon path and
// under the pointer, and adds heat shimmer, firelight and the crystal's glow. Everything moves
// in whole scene cells at the picture's own scale, so the pixel art stays crisp.
//
// Layout (see art/layout.mjs, the source these numbers mirror): the scene is five column
// ranges, left group | seam | center group | seam | right group. The prompt box sits centered
// in the area the panels leave free, so its shift from the window's middle reveals a panel.
// The outer groups pin to the free area's edges, the center sits between them, and the seams'
// plain sky and sea repeat to fill the gaps. (Only the difference of a left and a right panel
// can be read from the box, so the shift is given to one side.)
//
// Performance: every scene lookup's position is computed from built-ins (composer, size), never
// from a buffer read; a buffer-dependent lookup costs the scene its full sharpness.
import { buffer, clamp, composer, dot, exp, floor, fract, max, min, mix, mod, picture, pointer, pointerCount, pow, scene, shader, sin, size, smoothstep, step, still, time, values, vec2, vec3, vec4 } from 'claude-code/shader'
import type { Buffer } from 'claude-code/shader'

const W = 480
const H = 270
const V0 = 24
const V1 = 456
const L0 = 24
const L1 = 98
const SL0 = 98
const SL1 = 190
const C0 = 190
const C1 = 290
const SR0 = 290
const SR1 = 382
const R0 = 382
const R1 = 456
const FIRE_X = 398
const FIRE_Y = 240
const CRYSTAL_X = 84
const CRYSTAL_Y = 84
const HERO_X0 = 190
const HERO_Y0 = 160
const HERO_X1 = 290
const HERO_Y1 = 232
const SIGN_X0 = 382
const SIGN_Y0 = 70
const SIGN_X1 = 456
const SIGN_Y1 = 270
const SEA_TOP = 151
const SEA_BOTTOM = 211
const SUN_X = 240

// Set by the mod: 1 while /shore-layout shows the layout view.
const debug = values({ debug: [0, 1] })

// Where scene cell q sits in the Svg's own picture, as 0..1 of the window ("xMidYMid slice").
const uvAt = (q: vec2) => {
  const sC = max(size.x / W, size.y / H)
  return vec2(((q.x - W / 2) * sC + size.x / 2) / size.x, (size.y / 2 - (q.y - H / 2) * sC) / size.y)
}

// Read once a frame instead of per pixel: how bright the sky is (1 by day, 0 by night).
const state: Buffer = buffer({ size: [1, 1], float: 16 }, () => {
  const sky = scene.sample(uvAt(vec2(240.5, 12.5)))
  return vec4(clamp(((sky.r + sky.g + sky.b) / 3) * 2.2, 0, 1), 0, 0, 1)
})

const shore = picture(p => {
  const sC = max(size.x / W, size.y / H)
  const pictureLeft = W / 2 - size.x / (2 * sC)
  const pictureRight = W / 2 + size.x / (2 * sC)
  const pictureBottom = H / 2 + size.y / (2 * sC)
  // scene cell to picture uv, as one multiply-add per lane (the same mapping as uvAt)
  const ku = vec2(sC / size.x, -sC / size.y)
  const bu = vec2(0.5 - (W / 2) * ku.x, 0.5 - (H / 2) * ku.y)
  const toUv = (q: vec2) => vec2(q * ku + bu)

  // the panels, from the prompt box (window points)
  const boxL = composer.x * size.x
  const boxR = composer.z * size.x
  const shift = boxR > boxL ? (boxL + boxR) / 2 - size.x / 2 : 0
  const leftPx = shift > 0 ? min(2 * shift, size.x) : 0
  const rightPx = shift < 0 ? min(-2 * shift, size.x) : 0
  const freeLeft = pictureLeft + leftPx / sC
  const freeRight = pictureRight - rightPx / sC

  // whole-cell offsets: outer groups pin by their visible edges (V0..V1 at 16:10); the center
  // sits between them or, when they leave it too little room, in the free middle, where it wins
  const leftEdge = max(max(L0, V0), -floor(-pictureLeft))
  const rightEdge = min(min(R1, V1), floor(pictureRight))
  const oL = max(0, floor(freeLeft + 0.5) - leftEdge)
  const oR = min(0, floor(freeRight + 0.5) - rightEdge)
  const lEnd = L1 + oL
  const rStart = R0 + oR
  const mid = (C0 + C1) / 2
  const oC = rStart - lEnd >= C1 - C0 ? floor((lEnd + rStart) / 2 - mid + 0.5) : floor((freeLeft + freeRight) / 2 - mid + 0.5)
  const moved = oL > 0.5 || oR < -0.5 || oC > 0.5 || oC < -0.5 ? 1 : 0

  // this pixel's display cell, and the scene column it shows
  const x = floor(pictureLeft + p.point.x / sC)
  const y = floor(pictureBottom - p.point.y / sC)
  let src = x
  if (x >= C0 + oC && x < C1 + oC) {
    src = x - oC
  } else if (x < L1 + oL) {
    src = x - oL
  } else if (x >= R0 + oR) {
    src = x - oR
  } else if (x < C0 + oC) {
    src = SL0 + mod(x - lEnd, SL1 - SL0)
  } else {
    src = SR0 + mod(x - (C1 + oC), SR1 - SR0)
  }
  const cell = vec2(src + 0.5, y + 0.5)

  const t = time * (1 - still)
  const day = state.at(vec2(0, 0)).x
  const water = (c: vec4) => step(c.r + 0.06, c.b) * step(0.2, c.b)

  let base = scene.sample(toUv(cell))
  let replaced = moved
  let add = vec3(0)
  let off = 0
  let mode = 0

  const pointerX = pointerCount > 0 ? floor(pictureLeft + pointer(0).at.x / sC) : -1000
  const inHero = src >= HERO_X0 && src < HERO_X1 && y >= HERO_Y0 && y < HERO_Y1 ? 1 : 0
  const inSign = src >= SIGN_X0 && src < SIGN_X1 && y >= SIGN_Y0 && y < SIGN_Y1 ? 1 : 0
  const inSea = y > SEA_TOP && y < SEA_BOTTOM ? 1 - max(inHero, inSign) : 0

  if (inSea > 0.5 && water(base) > 0.5) {
    // ripple: rows sway sideways by whole cells, more toward the shore
    const depth = (y - 150) / 60
    off = floor(sin(y * 1.3 + t * 1.5 + sin(src * 0.05 + t * 0.4) * 2) * (0.5 + depth * 1.6) + 0.5)
    mode = 1
    // glints: rare twinkling cells, crowded along the sun/moon path and under the pointer
    const h1 = fract(sin(src * 12.9898 + y * 78.233) * 43758.5453)
    const h2 = fract(sin(src * 39.3468 + y * 11.135) * 24634.6345)
    const path = exp(-pow((x - (SUN_X + oC)) / (10 + depth * 46), 2))
    const lit = exp(-pow((x - pointerX) / (8 + depth * 36), 2))
    const on = step(0.994 - (path * 0.6 + lit) * 0.07, h1)
    const twinkle = pow(max(0, sin(t * (1.2 + h2 * 2.4) + h2 * 40)), 6)
    add = vec3(add + mix(vec3(0.8, 0.84, 1), vec3(1, 0.92, 0.6), day) * on * twinkle * 1.1)
  } else if (src > FIRE_X - 14 && src < FIRE_X + 15 && y > FIRE_Y - 42 && y < FIRE_Y - 4) {
    // heat shimmer over the campfire
    off = floor(sin(y * 0.9 - t * 7) * smoothstep(FIRE_Y - 42, FIRE_Y - 4, y) * 1.4 + 0.5)
    mode = 2
  }

  // one more look at the scene, shared by the ripple and the shimmer
  if (mode > 0.5) {
    const shifted = scene.sample(toUv(vec2(src + off + 0.5, y + 0.5)))
    if (mode > 1.5 || water(shifted) > 0.5) {
      base = shifted
      replaced = 1
    }
  }

  // firelight and the crystal's slow breath, where their art now sits on screen; a squared
  // falloff (cheaper than exp, about the same shape) that ends at the glow's radius
  const flick = 0.78 + 0.22 * sin(t * 9) * sin(t * 5.3 + 1)
  const fv = vec2(x - (FIRE_X + oR), (y - FIRE_Y - 6) * 1.3)
  const fall = max(0, 1 - dot(fv, fv) / 2100)
  add = vec3(add + vec3(1, 0.55, 0.2) * (fall * fall) * flick * mix(0.5, 0.16, day))
  const breath = 0.6 + 0.4 * sin(t * 1.3)
  const cv = vec2(x - (CRYSTAL_X + oL), y - CRYSTAL_Y)
  const cfall = max(0, 1 - dot(cv, cv) / 6000)
  add = vec3(add + vec3(0.35, 0.65, 1) * (cfall * cfall) * breath * mix(0.32, 0.1, day))

  // /shore-layout: the free area's edges (cyan), the prompt box's edges (magenta), and tints
  // over the cells each group is placed in (left red, center green, right blue)
  if (debug.debug > 0.5) {
    let tint = vec4(0)
    if (x >= C0 + oC && x < C1 + oC) {
      tint = vec4(0.2, 1, 0.3, 0.25)
    } else if (x >= leftEdge + oL && x < L1 + oL) {
      tint = vec4(1, 0.25, 0.25, 0.25)
    } else if (x >= R0 + oR && x < rightEdge + oR) {
      tint = vec4(0.3, 0.45, 1, 0.25)
    }
    if (x === floor(freeLeft) || x === floor(freeRight) - 1) {
      tint = vec4(0, 1, 1, 1)
    }
    if (x === floor(pictureLeft + boxL / sC) || x === floor(pictureLeft + boxR / sC)) {
      tint = vec4(1, 0, 1, 1)
    }
    return vec4(mix(base.rgb + add, tint.rgb, tint.a), 1)
  }

  // premultiplied: a replaced pixel is opaque; elsewhere the light adds (alpha 0)
  return replaced > 0.5 ? vec4(base.rgb + add, 1) : vec4(add, 0)
})

export default shader({ fps: 30, passes: [state, shore] })
