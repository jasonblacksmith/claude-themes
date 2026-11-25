// Hero's Shore, played on the GPU over the pixel-art scene: rippling sea, glints along the
// sun or moon path and under the pointer, heat shimmer over the campfire, and soft glows.
// Effects move in whole scene pixels so the art stays crisp.
//
// It also keeps the scene clear of the left sidebar. The prompt box sits centered in the part
// of the window the sidebar leaves free, so when its center moves right of the window's
// center, the sidebar is open and that shift is half its width. The scene then shrinks and
// slides into the free area, resting on the ground line, with the sky carried on above it.
// (A pane open on the right moves the box left instead; that reads as no sidebar.)
import { buffer, clamp, composer, exp, floor, fract, length, max, min, mix, picture, pointer, pointerCount, pow, scene, shader, sin, size, smoothstep, step, still, time, vec2, vec3, vec4 } from 'claude-code/shader'
import type { Buffer } from 'claude-code/shader'

// The scene is a 480x270 grid; the Svg draws it "xMidYMid slice": scaled to cover, centered.
const W = 480
const H = 270

// Where scene cell q sits in the Svg's own picture, as 0..1 of the window.
const uvAt = (q: vec2) => {
  const sC = max(size.x / W, size.y / H)
  return vec2(((q.x - W / 2) * sC + size.x / 2) / size.x, (size.y / 2 - (q.y - H / 2) * sC) / size.y)
}

// Read once per frame instead of per pixel: the sky's top color, and how bright the sky is
// (1 by day, 0 by night). The sidebar's width is read straight from the prompt box in the
// picture pass instead: routing it through a buffer makes every scene lookup wait on that
// read, which cost the scene its full sharpness. So a sidebar toggle snaps rather than glides.
const state: Buffer = buffer({ size: [1, 1], float: 16 }, () => {
  const a = scene.sample(uvAt(vec2(232.5, 0.5)))
  const b = scene.sample(uvAt(vec2(248.5, 0.5)))
  const sky = scene.sample(uvAt(vec2(240.5, 12.5)))
  return vec4(min(a.rgb, b.rgb), clamp(((sky.r + sky.g + sky.b) / 3) * 2.2, 0, 1))
})

const shore = picture(p => {
  // The Svg's own layout: the part of the scene it shows.
  const sC = max(size.x / W, size.y / H)
  const x0 = W / 2 - size.x / (2 * sC)
  const x1 = W / 2 + size.x / (2 * sC)
  const y1 = H / 2 + size.y / (2 * sC)

  // Our layout: that same part, fitted to the area the sidebar leaves free, resting on the bottom.
  // the prompt box is centered in the free area: its center's shift right is half the sidebar
  const cover = composer.z > composer.x ? clamp(composer.x + composer.z - 1, 0, 0.5) : 0
  const skyTop = state.at(vec2(0, 0))
  const day = skyTop.a
  const freeLeft = cover * size.x
  const sF = min(sC, (size.x - freeLeft) / (x1 - x0))
  const sc = vec2(x0 + (p.point.x - freeLeft) / sF, y1 - p.point.y / sF)
  const cell = vec2(floor(sc.x) + 0.5, floor(sc.y) + 0.5)

  const t = time * (1 - still)
  const water = (c: vec4) => step(c.r + 0.06, c.b) * step(0.2, c.b)

  // above the scene's top (only while refitted) the sky's top color carries on upward
  let base = sc.y < 0 ? vec4(skyTop.rgb, 1) : scene.sample(uvAt(cell))
  let replaced = cover > 0.002 ? 1 : 0
  let add = vec3(0)
  let off = 0
  let mode = 0

  const pointerX = pointerCount > 0 ? x0 + (pointer(0).at.x - freeLeft) / sF : -1000

  const inHero = cell.x > 138 && cell.x < 236 && cell.y > 160 && cell.y < 232 ? 1 : 0
  const inSign = cell.x > 296 && cell.x < 380 && cell.y > 172 && cell.y < 232 ? 1 : 0
  const inLand = (cell.x < 150 && cell.y > 191) || (cell.x > 300 && cell.y > 202) ? 1 : 0
  const inSea = cell.y > 151 && cell.y < 210 && cell.x > 60 && cell.x < 386 ? 1 - max(max(inHero, inSign), inLand) : 0

  if (inSea > 0.5 && water(base) > 0.5) {
    // ripple: rows sway sideways by whole pixels, more toward the shore
    const depth = (cell.y - 150) / 60
    off = floor(sin(cell.y * 1.3 + t * 1.5 + sin(cell.x * 0.05 + t * 0.4) * 2) * (0.5 + depth * 1.6) + 0.5)
    mode = 1
    // glints: rare twinkling cells, crowded along the sun/moon path and under the pointer
    const h1 = fract(sin(cell.x * 12.9898 + cell.y * 78.233) * 43758.5453)
    const h2 = fract(sin(cell.x * 39.3468 + cell.y * 11.135) * 24634.6345)
    const path = exp(-pow((cell.x - 240) / (10 + depth * 46), 2))
    const lit = exp(-pow((cell.x - pointerX) / (8 + depth * 36), 2))
    const on = step(0.994 - (path * 0.6 + lit) * 0.07, h1)
    const twinkle = pow(max(0, sin(t * (1.2 + h2 * 2.4) + h2 * 40)), 6)
    add = vec3(add + mix(vec3(0.8, 0.84, 1), vec3(1, 0.92, 0.6), day) * on * twinkle * 1.1)
  } else if (cell.x > 364 && cell.x < 393 && cell.y > 200 && cell.y < 236) {
    // heat shimmer over the campfire
    off = floor(sin(cell.y * 0.9 - t * 7) * smoothstep(200, 236, cell.y) * 1.4 + 0.5)
    mode = 2
  }

  // one more look at the scene, shared by the ripple and the shimmer
  if (mode > 0.5) {
    const shifted = scene.sample(uvAt(vec2(cell.x + off, cell.y)))
    if (mode > 1.5 || water(shifted) > 0.5) {
      base = shifted
      replaced = 1
    }
  }

  // a flickering firelight and the crystal's slow breath, stronger by night
  const flick = 0.78 + 0.22 * sin(t * 9) * sin(t * 5.3 + 1)
  const fd = length(vec2(cell.x - 378, (cell.y - 240) * 1.3))
  add = vec3(add + vec3(1, 0.55, 0.2) * exp(-(fd * fd) / 520) * flick * mix(0.5, 0.16, day))
  const breath = 0.6 + 0.4 * sin(t * 1.3)
  const cd = length(vec2(cell.x - 112, cell.y - 84))
  add = vec3(add + vec3(0.35, 0.65, 1) * exp(-(cd * cd) / 1500) * breath * mix(0.32, 0.1, day))

  // premultiplied: a replaced pixel is opaque; elsewhere the light adds (alpha 0)
  return replaced > 0.5 ? vec4(base.rgb + add, 1) : vec4(add, 0)
})

export default shader({ fps: 30, passes: [state, shore] })
