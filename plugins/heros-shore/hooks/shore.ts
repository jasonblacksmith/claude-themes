// Hero's Shore, played on the GPU over the pixel-art scene: rippling sea, glints along the
// sun or moon path and under the pointer, heat shimmer over the campfire, and soft glows.
// Effects move in whole scene pixels so the art stays crisp.
import { clamp, exp, floor, fract, length, max, mix, picture, pointer, pointerCount, pow, scene, shader, sin, size, smoothstep, step, still, time, vec2, vec3, vec4 } from 'claude-code/shader'

// The scene is a 480x270 grid drawn with "xMidYMid slice": scaled to cover, centered.
const W = 480
const H = 270

const shore = picture(p => {
  const s = max(size.x / W, size.y / H)
  // this pixel in scene coordinates (y down, like the SVG), snapped to its scene cell
  const sc = vec2((p.point.x - size.x / 2) / s + W / 2, (size.y / 2 - p.point.y) / s + H / 2)
  const cell = vec2(floor(sc.x) + 0.5, floor(sc.y) + 0.5)
  const uvOf = (q: vec2) => vec2(((q.x - W / 2) * s + size.x / 2) / size.x, (size.y / 2 - (q.y - H / 2) * s) / size.y)
  const t = time * (1 - still)

  // sea pixels are blue-dominant in both modes; the hero, slime and crystal sit outside the sea box
  const water = (c: vec4) => step(c.r + 0.06, c.b) * step(0.2, c.b)
  const sky = scene.sample(uvOf(vec2(240, 12)))
  const day = clamp(((sky.r + sky.g + sky.b) / 3) * 2.2, 0, 1)

  let base = scene.sample(uvOf(cell))
  let replaced = 0
  let add = vec3(0)

  // where the pointer is, as a scene column (off-screen when there is none)
  const pointerX = pointerCount > 0 ? (pointer(0).at.x - size.x / 2) / s + W / 2 : -1000

  const inHero = cell.x > 138 && cell.x < 236 && cell.y > 160 && cell.y < 232 ? 1 : 0
  const inSign = cell.x > 296 && cell.x < 380 && cell.y > 172 && cell.y < 232 ? 1 : 0
  const inLand = (cell.x < 150 && cell.y > 191) || (cell.x > 300 && cell.y > 202) ? 1 : 0
  const inSea = cell.y > 151 && cell.y < 210 && cell.x > 60 && cell.x < 386 ? 1 - max(max(inHero, inSign), inLand) : 0

  if (inSea > 0.5 && water(base) > 0.5) {
    // ripple: rows sway sideways by whole pixels, more toward the shore
    const depth = (cell.y - 150) / 60
    const sway = sin(cell.y * 1.3 + t * 1.5 + sin(cell.x * 0.05 + t * 0.4) * 2) * (0.5 + depth * 1.6)
    const moved = scene.sample(uvOf(vec2(cell.x + floor(sway + 0.5), cell.y)))
    if (water(moved) > 0.5) {
      base = moved
      replaced = 1
    }
    // glints: rare twinkling cells, crowded along the sun/moon path and under the pointer
    const h1 = fract(sin(cell.x * 12.9898 + cell.y * 78.233) * 43758.5453)
    const h2 = fract(sin(cell.x * 39.3468 + cell.y * 11.135) * 24634.6345)
    const path = exp(-pow((cell.x - 240) / (10 + depth * 46), 2))
    const lit = exp(-pow((cell.x - pointerX) / (8 + depth * 36), 2))
    const crowd = path * 0.6 + lit
    const on = step(0.994 - crowd * 0.07, h1)
    const twinkle = pow(max(0, sin(t * (1.2 + h2 * 2.4) + h2 * 40)), 6)
    add = vec3(add + mix(vec3(0.8, 0.84, 1), vec3(1, 0.92, 0.6), day) * on * twinkle * 1.1)
  }

  // heat shimmer over the campfire
  if (cell.x > 364 && cell.x < 393 && cell.y > 200 && cell.y < 236) {
    const rise = smoothstep(200, 236, cell.y)
    const wob = floor(sin(cell.y * 0.9 - t * 7) * rise * 1.4 + 0.5)
    base = scene.sample(uvOf(vec2(cell.x + wob, cell.y)))
    replaced = 1
  }

  // a flickering firelight and the crystal's slow breath, stronger by night
  const flick = 0.78 + 0.22 * sin(t * 9) * sin(t * 5.3 + 1)
  const fd = length(vec2((cell.x - 378) * 1, (cell.y - 240) * 1.3))
  add = vec3(add + vec3(1, 0.55, 0.2) * exp(-(fd * fd) / 520) * flick * mix(0.5, 0.16, day))
  const breath = 0.6 + 0.4 * sin(t * 1.3)
  const cd = length(vec2(cell.x - 112, cell.y - 84))
  add = vec3(add + vec3(0.35, 0.65, 1) * exp(-(cd * cd) / 1500) * breath * mix(0.32, 0.1, day))

  // premultiplied: a replaced pixel is opaque; elsewhere the light adds (alpha 0)
  return replaced > 0.5 ? vec4(base.rgb + add, 1) : vec4(add, 0)
})

export default shader({ fps: 30, passes: [shore] })
