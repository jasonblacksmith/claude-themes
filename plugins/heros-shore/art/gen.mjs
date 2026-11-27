// Generates the Hero's Shore backdrop: a 32-bit-style coast at golden hour (light) or moonlight (dark).
// usage, from the plugin folder: node art/gen.mjs hooks/scene.ts [preview.html]
//
// The scene is laid out in five column ranges (art/layout.mjs): three groups of art with two
// seams of plain sky, sea and grass between them. Seams tile with their own width, so the
// shader (hooks/shore.ts) can repeat them while it pins the groups beside the app's panels.
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { CENTER, EFFECTS, LEFT, RIGHT, SEAM_L, SEAM_R, VISIBLE } from './layout.mjs'
import { Sprite, makeRandom, text, textWidth, bands, modeCss } from './pixel.mjs'

const W = 480, H = 270, HY = 150
const SEAM_W = SEAM_L[1] - SEAM_L[0]
const SEAM_SEEDS = { L: 9101, R: 9202 }
const lerp = (a, b, t) => a + (b - a) * t
const mod = (a, n) => ((a % n) + n) % n
const inSeam = x => (x >= SEAM_L[0] && x < SEAM_L[1]) || (x >= SEAM_R[0] && x < SEAM_R[1])

// ---------------------------------------------------------------- mode colors
const MODE = {
  // sky
  k0: ['#4f86d6', '#070b26'], k1: ['#5f96de', '#0b1130'], k2: ['#74a6e4', '#10183c'], k3: ['#8ab6ea', '#161f48'],
  k4: ['#a2c6ee', '#1d2754'], k5: ['#bcd4ee', '#262e5e'], k6: ['#d6e0ea', '#323466'], k7: ['#efe6d6', '#43396c'],
  k8: ['#fbe6c0', '#574070'], k9: ['#ffdca0', '#6c4872'],
  // painterly cloud strokes
  p1: ['#ffffff', '#3a3f80'], p2: ['#f6c6d6', '#4a3878'], p3: ['#cdbdf2', '#2e3474'], p4: ['#fff0c8', '#514a86'],
  p5: ['#9cc4f4', '#222a62'], p6: ['#f8b890', '#5a3c6e'],
  // sea
  q0: ['#a8dce4', '#5a4f8a'], q1: ['#74c4d6', '#3a427c'], q2: ['#46aacb', '#2a366c'], q3: ['#2c93bd', '#1f2d60'],
  q4: ['#2884b2', '#1a2856'], q5: ['#38aabd', '#22395f'],
  w1: ['#effbff', '#9aa6dc'], w2: ['#1d6f9e', '#121c46'], w3: ['#bfeef4', '#5866a8'],
  g1: ['#fff3b8', '#e6e2ff'],
  // distance
  h1: ['#7d98b4', '#2c2a5c'], h2: ['#9ab0c6', '#3a3670'],
  // water falling
  wf: ['#e2f5ff', '#8fa2dc'], wfs: ['#a8d8f0', '#5a6aa8'],
  win: ['#4a3a5a', '#ffd870'],
}
const GR = ['#1d4424', '#2b6230', '#43843a', '#73aa46', '#a6cf5a']
const FLOWERS = ['#b070e0', '#e070b0', '#f2d060', '#8a5ad8', '#ffffff']
const LEAF = ['#16461f', '#22682a', '#3a8a32', '#6ab83a', '#a8d84a']
const DAB_RAMP = t => (t < 0.4 ? ['.p5', '.p1', '.p3'] : t < 0.75 ? ['.p3', '.p1', '.p2'] : ['.p2', '.p4', '.p6'])

function bbox(sprite, dx = 0, dy = 0, keep = () => true) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  sprite.each((x, y) => {
    if (!keep(x + dx)) return
    x0 = Math.min(x0, x + dx); y0 = Math.min(y0, y + dy); x1 = Math.max(x1, x + dx + 1); y1 = Math.max(y1, y + dy + 1)
  })
  return [x0, y0, x1, y1]
}
const union = (...boxes) => [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))]
const circleBox = (cx, cy, r) => [cx - r, cy - r, cx + r, cy + r]

// ---------------------------------------------------------------- seam filler, periodic with the seam's width
// Every element is placed at a column in [0, w) and drawn at that column plus each multiple
// of w that falls inside [0, cols), wrapping across the edge, so column i matches column i + w.
export function filler(seed, cols, w = SEAM_W) {
  const r = makeRandom(seed)
  const pickR = arr => arr[Math.floor(r() * arr.length)]
  const sky = new Sprite(), sea = new Sprite(), foam = new Sprite(), land = new Sprite(), stars = []
  const put = (s, x, y, len, c) => {
    for (let k = 0; k < len; k++) for (let px = mod(x + k, w); px < cols; px += w) s.set(px, y, c)
  }
  for (let k = 0; k < 9; k++) {
    const cx = r() * w, cy = 6 + r() * (HY - 30), ramp = DAB_RAMP(cy / HY)
    const n = 16 + Math.floor(r() * 22), sx = 10 + r() * 18, sy = 2 + r() * 3
    for (let i = 0; i < n; i++) {
      const gx = (r() + r() + r() - 1.5) / 1.5, gy = (r() + r() + r() - 1.5) / 1.5
      put(sky, Math.round(cx + gx * sx), Math.round(cy + gy * sy), 2 + Math.floor(r() * 4), gy < -0.25 ? ramp[1] : gy > 0.35 ? ramp[2] : ramp[0])
    }
  }
  for (let i = 0; i < 45; i++) put(sky, Math.floor(r() * w), Math.floor(r() * (HY - 8)), 2, pickR(['.p1', '.p3', '.p2', '.p4']))
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(r() * w), y = Math.floor(r() * 110), cls = `t${1 + (i % 3)}`, fill = i % 4 ? '#e8e8ff' : '#ffe9a8'
    for (let px = x; px < cols; px += w) stars.push([px, y, cls, fill])
  }
  for (let i = 0; i < 18; i++) {
    const y = Math.floor(HY + 1 + Math.pow(r(), 0.8) * 60), x = Math.floor(r() * w)
    const len = 1 + Math.floor(((y - HY) / 64) * 6 + r() * 3)
    put(sea, x, y, len, r() < 0.55 ? '.w1' : r() < 0.5 ? '.w3' : '.w2')
  }
  for (let x = 0; x < cols; x++) {
    const u = mod(x, w) / w
    const y = Math.round(211 + Math.sin(u * Math.PI * 2 * 3) * 1.5 + Math.sin(u * Math.PI * 2 * 7) * 0.6)
    foam.set(x, y, '.w1')
    if (mod(x, w) % 3) foam.set(x, y + 1, '.w3')
    for (let y2 = 213; y2 < H; y2++) land.set(x, y2, GR[1])
  }
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(r() * w), y = 213 + Math.floor(r() * (H - 213)), v = r()
    put(land, x, y, 1 + Math.floor(r() * 3), v < 0.35 ? GR[0] : v < 0.75 ? GR[2] : v < 0.92 ? GR[3] : GR[4])
  }
  for (let i = 0; i < 16; i++) put(land, Math.floor(r() * w), 214 + Math.floor(r() * (H - 214)), 1 + Math.floor(r() * 2), pickR(FLOWERS))
  for (let i = 0; i < 10; i++) { const x = Math.floor(r() * w); put(land, x, 212, 1, GR[2]); if (r() < 0.5) put(land, x, 211, 1, GR[3]) }
  return { sky, sea, foam, land, stars }
}

export function buildScene() {
  const rnd = makeRandom(20261124)
  const pick = arr => arr[Math.floor(rnd() * arr.length)]
  const parts = []
  const part = (name, group, box) => parts.push({ name, group, box })

  // ---------------------------------------------------------------- sky
  const SKY_STOPS = [0, 18, 36, 54, 72, 90, 106, 120, 132, 142, HY]
  let sky = bands(0, 0, W, SKY_STOPS, ['k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9'])
  // the groups' own dabs (the seams carry their own, periodic, below)
  const dabs = new Sprite()
  const dab = (x, y, len, c) => { for (let k = 0; k < len; k++) if (!inSeam(x + k)) dabs.set(x + k, y, c) }
  for (let k = 0; k < 40; k++) {
    const cx = rnd() * W, cy = 6 + rnd() * (HY - 30)
    if (inSeam(cx) || (Math.hypot((cx - 240) / 60, (cy - 128) / 70) < 1 && rnd() < 0.85)) continue
    const ramp = DAB_RAMP(cy / HY)
    const n = 16 + Math.floor(rnd() * 22), sx = 8 + rnd() * 12, sy = 2 + rnd() * 3
    for (let i = 0; i < n; i++) {
      const gx = (rnd() + rnd() + rnd() - 1.5) / 1.5, gy = (rnd() + rnd() + rnd() - 1.5) / 1.5
      dab(Math.round(cx + gx * sx), Math.round(cy + gy * sy), 2 + Math.floor(rnd() * 4), gy < -0.25 ? ramp[1] : gy > 0.35 ? ramp[2] : ramp[0])
    }
  }
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * (HY - 8))
    if (Math.hypot((x - 240) / 70, (y - 128) / 60) < 1) continue
    dab(x, y, 2, pick(['.p1', '.p3', '.p2', '.p4']))
  }
  sky += dabs.svg()

  // stars and moon (dark only), the sun's bloom (light only)
  let stars = ''
  const star = (x, y, cls, fill) => { stars += `<rect class="${cls}" x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>` }
  for (let i = 0; i < 50; i++) {
    const x = Math.floor(rnd() * W), y = Math.floor(rnd() * 110)
    if (!inSeam(x)) star(x, y, `t${1 + (i % 3)}`, i % 4 ? '#e8e8ff' : '#ffe9a8')
  }
  const moon = new Sprite()
  moon.ell(0, 0, 13, 13, '#f2ecd2')
  for (const [x, y, r] of [[-4, -3, 3], [4, 4, 2.5], [5, -5, 1.6], [-3, 6, 1.5]]) moon.ell(x, y, r, r, '#d6cfa8')
  moon.ell(-5, -7, 2, 1.5, '#fffbe8')
  const SUN = EFFECTS.sunX, MOON = [270, 134]
  const sunBloom = `<g class="d"><circle cx="${SUN}" cy="${HY}" r="48" fill="#fff2c8" opacity=".25"/><circle cx="${SUN}" cy="${HY}" r="34" fill="#fff6d8" opacity=".35"/><circle cx="${SUN}" cy="${HY}" r="18" fill="#fffbea" opacity=".6"/></g>`
  const moonGroup = `<g class="n"><circle cx="${MOON[0]}" cy="${MOON[1]}" r="20" fill="#8a7cc8" opacity=".08"/><circle cx="${MOON[0]}" cy="${MOON[1]}" r="16" fill="#a89ad8" opacity=".1"/><g transform="translate(${MOON[0]} ${MOON[1]})">${moon.svg()}</g></g>`
  part('sun', 'center', circleBox(SUN, HY, 48))
  part('moon', 'center', circleBox(MOON[0], MOON[1], 20))

  // ---------------------------------------------------------------- sea
  const SEA_STOPS = [HY, 156, 164, 174, 186, 198, 214]
  let sea = bands(0, HY, W, SEA_STOPS, ['q0', 'q1', 'q2', 'q3', 'q4', 'q5'])
  const waves = new Sprite()
  for (let i = 0; i < 60; i++) {
    const y = Math.floor(HY + 1 + Math.pow(rnd(), 0.8) * 62), x = Math.floor(rnd() * W)
    const len = 1 + Math.floor(((y - HY) / 64) * 6 + rnd() * 3), c = rnd() < 0.55 ? '.w1' : rnd() < 0.5 ? '.w3' : '.w2'
    for (let k = 0; k < len; k++) if (!inSeam(x + k)) waves.set(x + k, y, c)
  }
  sea += waves.svg()
  // glitter path under the sun / moon, in three twinkling sets, kept inside the center
  for (let set = 1; set <= 3; set++) {
    const g = new Sprite()
    for (let i = 0; i < 40; i++) {
      const y = Math.floor(HY + 1 + rnd() * 58)
      const spread = Math.min(44, 6 + (y - HY) * 0.9)
      const x = Math.floor(SUN + (rnd() * 2 - 1) * spread)
      g.rect(x, y, Math.min(1 + Math.floor((y - HY) / 14), CENTER[1] - 1 - x), 1, '.g1')
    }
    sea += `<g class="s${set}">${g.svg()}</g>`
  }
  // foam along the center's beach
  const foam = new Sprite()
  for (let x = CENTER[0]; x < CENTER[1]; x++) {
    const y = Math.round(211 + Math.sin(x / 7) * 1.5 + Math.sin(x / 3.1) * 0.6)
    foam.set(x, y, '.w1')
    if (x % 3) foam.set(x, y + 1, '.w3')
  }

  // ---------------------------------------------------------------- horizon
  const far = new Sprite()
  far.poly([[28, 150], [40, 141], [54, 139], [62, 133], [70, 137], [84, 140], [96, 150]], '.h1')
  far.rect(56, 122, 4, 12, '.h1'); far.poly([[55, 122], [61, 122], [58, 115]], '.h1'); far.rect(64, 128, 3, 8, '.h1'); far.poly([[63, 128], [68, 128], [65.5, 123]], '.h1')
  part('horizon-left', 'left', bbox(far))
  const farC = new Sprite()
  farC.poly([[196, 150], [202, 146], [210, 147], [216, 150]], '.h2')
  farC.poly([[272, 150], [278, 146], [286, 150]], '.h2')
  part('horizon-center', 'center', bbox(farC))
  const ship = new Sprite()
  ship.poly([[0, 6], [10, 6], [8, 8], [2, 8]], '.h1'); ship.line(5, -2, 5, 6, '.h1'); ship.poly([[5.5, -1], [9, 4], [5.5, 4]], '.h2'); ship.poly([[4.5, 0], [1.5, 4], [4.5, 4]], '.h2')
  const SHIP = [250, 141], SAIL = 24
  part('ship', 'center', union(bbox(ship, SHIP[0], SHIP[1]), bbox(ship, SHIP[0] + SAIL, SHIP[1])))

  // ---------------------------------------------------------------- land (the seams carry their own grass)
  const land = new Sprite()
  land.poly([[0, 196], [50, 193], [98, 211], [98, 270], [0, 270]], GR[1])
  land.rect(CENTER[0], 213, CENTER[1] - CENTER[0], H - 213, GR[1])
  land.poly([[RIGHT[0], 212], [430, 198], [480, 192], [480, 270], [RIGHT[0], 270]], GR[1])
  const landPixels = []
  land.each((x, y) => landPixels.push([x, y]))
  const grass = (x, y, c) => { if (!inSeam(x) && land.has(x, y)) land.set(x, y, c) }
  for (let i = 0; i < 220; i++) {
    const [x, y] = landPixels[Math.floor(rnd() * landPixels.length)]
    const v = rnd(), c = v < 0.35 ? GR[0] : v < 0.75 ? GR[2] : v < 0.92 ? GR[3] : GR[4]
    for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) grass(x + k, y, c)
    if (rnd() < 0.4) grass(x, y - 1, c)
  }
  for (let i = 0; i < 80; i++) {
    const [x, y] = landPixels[Math.floor(rnd() * landPixels.length)]
    const c = pick(FLOWERS)
    grass(x, y, c); if (rnd() < 0.5) grass(x + 1, y, c)
  }
  land.each((x, y) => { if (!inSeam(x) && !land.has(x, y - 1) && y < 230 && rnd() < 0.08) { land.set(x, y - 1, GR[2]); if (rnd() < 0.5) land.set(x, y - 2, GR[3]) } })

  // the sand path to the sea
  const sand = new Sprite()
  sand.poly([[214, 213], [266, 213], [288, 270], [192, 270]], '#d6b072')
  const SAND = ['#e8c890', '#c4985a', '#b0844c', '#f2dcaa']
  const sandPx = []; sand.each((x, y) => sandPx.push([x, y]))
  for (let i = 0; i < 70; i++) {
    const [x, y] = sandPx[Math.floor(rnd() * sandPx.length)]
    sand.rect(x, y, 1 + Math.floor(rnd() * 2), 1, pick(SAND))
  }
  sand.each((x, y) => { if (x >= CENTER[1]) sand.del(x, y) })

  // a stone ledge the hero stands on
  const ledge = new Sprite()
  const STN = ['#8c8270', '#6c6252', '#a89e88', '#4e4638']
  for (let row = 0; row < 3; row++) {
    const y = 226 + row * 5
    for (let x = 198 - row * 2; x < 282 + row * 2;) {
      const w = Math.min(8 + Math.floor(rnd() * 6), 282 + row * 2 - x + 1)
      ledge.rect(x, y, w - 1, 4, STN[0])
      ledge.rect(x, y, w - 1, 1, STN[2])
      ledge.rect(x + w - 2, y + 1, 1, 3, STN[1])
      if (rnd() < 0.4) ledge.rect(x + 2, y + 2, 2, 1, STN[1])
      if (rnd() < 0.3) ledge.rect(x + 1, y + 3, 3, 1, GR[2])
      x += w
    }
  }
  ledge.outline(STN[3])
  part('ledge', 'center', bbox(ledge))

  // ---------------------------------------------------------------- left: palm, signs
  const palm = new Sprite()
  const BARK = ['#4a3220', '#6a4a2a', '#8a6438', '#a8804a']
  const P0 = [32, 236], PC = [14, 120], P1 = [64, 24]
  const bez = (t, a, c, b) => [lerp(lerp(a[0], c[0], t), lerp(c[0], b[0], t), t), lerp(lerp(a[1], c[1], t), lerp(c[1], b[1], t), t)]
  for (let i = 0; i <= 260; i++) {
    const t = i / 260, [x, y] = bez(t, P0, PC, P1)
    const w = lerp(10, 6, t), ring = Math.floor(t * 36) % 3 === 0
    for (let o = -w / 2; o <= w / 2; o++) {
      const f = (o + w / 2) / w
      palm.set(x + o, y, f < 0.2 ? BARK[3] : f > 0.75 ? BARK[0] : ring ? BARK[1] : BARK[2])
    }
  }
  function frond(sx, sy, ang, len, droop) {
    const pts = []
    for (let i = 0; i <= len; i++) {
      const t = i / len, a = ang + droop * t * t, prev = pts[i - 1] || [sx, sy]
      pts.push([prev[0] + Math.cos(a), prev[1] + Math.sin(a)])
    }
    pts.forEach(([x, y], i) => {
      const t = i / len, a = ang + droop * t * t
      palm.set(x, y, LEAF[1])
      const leaflet = Math.max(2, Math.round((1 - t) * 8 + 3))
      if (i % 2 === 0) for (const side of [-1, 1]) {
        const la = a + side * 1.1 + 0.35 * side
        for (let s = 1; s <= leaflet; s++) palm.set(x + Math.cos(la) * s, y + Math.sin(la) * s + s * 0.25, s === leaflet ? LEAF[0] : side < 0 ? (s < 3 ? LEAF[4] : LEAF[3]) : LEAF[2])
      }
    })
  }
  // long fronds sweep left, off the edge; the ones to the right stay short, inside the group
  for (const [ang, len, droop] of [[-2.95, 62, -0.8], [-2.45, 54, -1.0], [-1.9, 42, -1.1], [-1.3, 26, 0.9], [-0.7, 18, 1.1], [-0.15, 16, 1.0], [0.45, 14, 0.8], [2.5, 48, 0.9]])
    frond(P1[0], P1[1], ang, len, droop)
  for (const [x, y] of [[61, 28], [66, 29], [63, 31]]) { palm.ell(x, y, 2.6, 2.6, '#4a2e14'); palm.set(x - 1, y - 1, '#7a5228') }
  part('palm', 'left', bbox(palm, 0, 0, x => x >= VISIBLE[0]))
  part('palm-fronds', 'left', bbox(palm, 0, 0, x => x < VISIBLE[0]))

  const signs = new Sprite()
  const WOOD = { base: '#6a4426', dark: '#4e301a', edge: '#2e1a0e', text: '#f6e8c6' }
  const boards = [['ESCAPE', 'heart'], ['LEVEL UP', 'star'], ['QUEST ON', 'sword']]
  boards.forEach(([label, icon], i) => {
    const y = 80 + i * 14, x = 26
    signs.rect(x, y, 44, 11, WOOD.base)
    for (let gx = x + 3; gx < x + 42; gx += 7) signs.rect(gx, y + 3 + (gx % 3), 4, 1, WOOD.dark)
    signs.rect(x, y + 10, 44, 1, WOOD.dark)
    if (icon === 'heart') signs.grid(['.#.#.', '#####', '#####', '.###.', '..#..'], x + 3, y + 3, { '#': '#e8404a' })
    if (icon === 'star') signs.grid(['..#..', '.###.', '#####', '.###.', '#.#.#'], x + 3, y + 3, { '#': '#ffd23f' })
    if (icon === 'sword') signs.grid(['....#', '...#.', '#.#..', '.#...', '#.#..'], x + 3, y + 3, { '#': '#cfe8ff' })
    text(signs, label, x + 10, y + 3, WOOD.text)
    signs.line(x + 8, y - 1, x + 8, y - (i === 0 ? 6 : 3), '#9a9aa8'); signs.line(x + 36, y - 1, x + 36, y - (i === 0 ? 6 : 3), '#9a9aa8')
  })
  signs.outline(WOOD.edge, c => c === WOOD.base || c === WOOD.dark)
  part('signs', 'left', bbox(signs))

  // ---------------------------------------------------------------- left: crystal portal
  const crystal = new Sprite()
  const CRY = ['#13235e', '#1f3c9a', '#2f60d8', '#5f9cff', '#a8d4ff', '#effaff']
  crystal.poly([[0, -46], [12, -26], [12, 18], [0, 40], [-12, 18], [-12, -26]], CRY[2])
  crystal.poly([[0, -46], [12, -26], [12, 18], [0, 40], [3, 18], [3, -26]], CRY[1])
  crystal.poly([[0, -46], [-12, -26], [-12, 18], [0, 40], [-6, 18], [-6, -26]], CRY[3])
  crystal.poly([[0, -46], [3, -26], [3, 18], [0, 40], [-2, 18], [-2, -26]], CRY[4])
  crystal.line(-5, -30, -5, 10, CRY[5]); crystal.line(-4, -36, -4, -32, CRY[5])
  crystal.recolor((x, y, c) => (c === CRY[1] && (x + y) % 7 === 0 ? CRY[0] : null))
  crystal.outline('#0c1440')
  const VINE = ['#1e5a28', '#3a8a34', '#7ac04a']
  for (const [x0, len] of [[-10, 30], [5, 40], [-8, 50]]) {
    for (let i = 0; i < len; i++) {
      const x = x0 + Math.round(Math.sin(i / 4 + x0) * 1.2), y = -34 + i, dy = x0 > 0 ? 6 : 0
      crystal.set(x, y + dy, VINE[1])
      if (i % 4 === 0) { crystal.set(x - 1, y + dy, VINE[2]); crystal.set(x + 1, y + 1 + dy, VINE[0]) }
    }
  }
  for (let x = -12; x <= 12; x++) crystal.set(x, -27 + Math.round(Math.abs(x) * -0.3 + Math.sin(x) * 1.2) + 2, VINE[1])
  let particles = ''
  for (let i = 0; i < 12; i++) {
    const x = Math.round((rnd() * 2 - 1) * 9), y = 42 + Math.floor(rnd() * 8)
    particles += `<rect class="fallp f${1 + (i % 3)}" x="${x}" y="${y}" width="${rnd() < 0.3 ? 2 : 1}" height="${rnd() < 0.3 ? 2 : 1}" fill="${pick(['#8fd0ff', '#d8f2ff', '#5aa8ff'])}"/>`
  }
  const CX = EFFECTS.crystal
  part('crystal', 'left', union(bbox(crystal, CX[0], CX[1]), [CX[0] - 10, CX[1] + 42, CX[0] + 11, CX[1] + 52]))

  // ---------------------------------------------------------------- left: computer and toys (drawn at x 0, placed at +25)
  const PC_DX = 25
  const pc = new Sprite()
  const BEIGE = ['#efe6c8', '#d8cca6', '#b4a67e', '#8a7c58']
  pc.rect(2, 178, 58, 44, BEIGE[1]); pc.rect(2, 178, 58, 2, BEIGE[0]); pc.rect(2, 178, 2, 44, BEIGE[0]); pc.rect(56, 180, 4, 42, BEIGE[2])
  pc.rect(7, 183, 47, 33, BEIGE[3])
  pc.rect(8, 184, 45, 31, '#0e2418')
  pc.rect(14, 222, 34, 5, BEIGE[2])
  pc.rect(0, 226, 64, 20, BEIGE[1]); pc.rect(0, 226, 64, 2, BEIGE[0]); pc.rect(60, 228, 4, 18, BEIGE[2])
  pc.rect(30, 233, 22, 3, BEIGE[3]); pc.rect(31, 234, 20, 1, '#3a3428'); pc.rect(8, 233, 4, 3, '#6ad06a')
  pc.rect(4, 246, 58, 12, BEIGE[1]); pc.rect(4, 246, 58, 1, BEIGE[0])
  for (let r = 0; r < 3; r++) for (let k = 0; k < 13; k++) pc.rect(7 + k * 4 + (r % 2), 248 + r * 3, 3, 2, r === 2 && k > 3 && k < 9 ? BEIGE[0] : BEIGE[2])
  pc.outline('#3a3226')
  const TERM = '#7dff9a'
  for (const [i, line] of ['> ADVENTURE', '> BUILD', '> SHIP IT', '>'].entries()) text(pc, line, 10, 187 + i * 7, TERM)
  const cursor = `<rect class="cur" x="14" y="${187 + 21 + 4}" width="3" height="1" fill="${TERM}"/>`
  part('computer', 'left', bbox(pc, PC_DX))

  const gamepad = new Sprite()
  gamepad.ell(16, 262, 8, 6, '#c9c5c0'); gamepad.ell(42, 262, 8, 6, '#c9c5c0'); gamepad.rect(16, 256, 26, 12, '#c9c5c0'); gamepad.rect(16, 256, 26, 1, '#e4e0dc')
  gamepad.rect(12, 261, 7, 2, '#3a3838'); gamepad.rect(14, 259, 3, 6, '#3a3838')
  gamepad.ell(41, 260, 1.6, 1.6, '#d8404a'); gamepad.ell(45, 263, 1.6, 1.6, '#4a70d8'); gamepad.rect(25, 263, 3, 1, '#7a7676'); gamepad.rect(30, 263, 3, 1, '#7a7676')
  gamepad.outline('#2e2a2a')
  const d20 = new Sprite()
  d20.poly([[60, 244], [67, 240], [74, 244], [74, 253], [67, 257], [60, 253]], '#6a3aa8')
  d20.poly([[60, 244], [67, 240], [67, 248]], '#9a6ae0'); d20.poly([[67, 248], [74, 253], [67, 257], [60, 253]], '#4a2480')
  text(d20, '20', 63, 247, '#ffffff')
  d20.outline('#24123e', c => c !== '#ffffff')
  const chest = new Sprite()
  const CH = ['#7a4a1e', '#a0662c', '#5a3412']
  chest.rect(80, 250, 26, 14, CH[1]); chest.rect(80, 250, 26, 2, CH[0]); chest.rect(80, 256, 26, 1, CH[2])
  chest.poly([[80, 250], [84, 241], [102, 241], [106, 250]], '#ffe680')
  chest.poly([[82, 242], [86, 236], [102, 236], [104, 242]], CH[0])
  for (const x of [83, 101]) { chest.rect(x, 250, 3, 14, '#f2c230'); chest.rect(x, 250, 1, 14, '#ffe680') }
  chest.rect(91, 254, 4, 4, '#f2c230'); chest.set(92, 256, '#3a2410')
  chest.outline('#2a180a', c => c !== '#ffe680')
  const PAD = [20, 0], DIE = [10, -78], BOX = [-10, 0]
  part('toys', 'left', union(bbox(gamepad, ...PAD), bbox(d20, ...DIE), bbox(chest, ...BOX)))

  // ---------------------------------------------------------------- hero (seen from behind) and his crystal sword
  const hero = new Sprite()
  hero.grid([
    '......H....H...H.....',
    '.....HhH..HhH.HhH..H.',
    '..H..HhhHHhhhHhhHHhH.',
    '..HhHhhhhhhhhhhhhhhH.',
    '.HhhhhlhhhhhlhhhhhhH.',
    'HhhhhllhhhhllhhhlhhhH',
    '.HhhhhhhhhhhhhhhllhH.',
    'HhhhhhhhhlhhhhhhhhhhH',
    '.HhhhhhhhhhhhhhhhhhH.',
    '..HhhhhhhhhhhhhhhhH..',
    '...HHhhhhhhhhhhhHH...',
    '....sHhhHhhHhhHHs....',
    '....pPPPPPPPPPPPp....',
    '...pPPPQQPPPPPPPPp...',
    '..aBbbbbbbbbbbbbbBa..',
    '.aaBbbbcbbbbbcbbbBaa.',
    '.aaBbbbbcbbbcbbbbBaa.',
    '.ssBbbbbbcbcbbbbbBss.',
    '.ssBbbbbbbcbbbbbbB.ss',
    '..BbbbbbbcbcbbbbbB...',
    '..BbbbbbcbbbcbbbbB...',
    '..LLLLLLLLLLLLLLLL...',
    '..BbbbbbbbbbbbbbbB...',
    '..BBbbbbbbbbbbbbBB...',
    '...TTTTt...tTTTT.....',
    '...TTTTt...tTTTT.....',
    '...TTTTt...tTTTT.....',
    '...KkkK.....KkkK.....',
    '..KKkkK.....KkkKK....',
    '.KKKKKK.....KKKKKK...',
  ], 0, 0, {
    H: '#5e2c10', h: '#a4561c', l: '#e09a46', s: '#e8b888', p: '#6a2478', P: '#a03cb0', Q: '#d07ad8',
    a: '#e8b888', B: '#24408e', b: '#3c66c8', c: '#5a3418', L: '#4a2a12', T: '#3a3450', t: '#2a2440',
    K: '#4a2a14', k: '#7a4a24',
  })
  hero.outline('#1a1028')
  const sword = new Sprite()
  const dir = [0.62, -0.78], perp = [0.78, 0.62], hand = [19, 18]
  for (let t = 4; t <= 44; t++) {
    const half = t > 40 ? 0 : t > 37 ? 1 : 2
    for (let o = -half; o <= half; o++)
      sword.set(hand[0] + dir[0] * t + perp[0] * o, hand[1] + dir[1] * t + perp[1] * o, o < 0 ? '#e9fbff' : o === 0 ? '#9edcff' : o === 1 ? '#5aa4f2' : '#3a78d8')
  }
  for (let o = -5; o <= 5; o++) sword.set(hand[0] + dir[0] * 3 + perp[0] * o, hand[1] + dir[1] * 3 + perp[1] * o, o === 0 ? '#5ad0ff' : '#f2c230')
  for (let t = -2; t <= 2; t++) sword.set(hand[0] + dir[0] * t, hand[1] + dir[1] * t, '#5a3418')
  sword.set(hand[0] + dir[0] * -3, hand[1] + dir[1] * -3, '#f2c230')
  sword.outline('#0e1a4a')
  const scarfA = new Sprite(), scarfB = new Sprite()
  scarfA.poly([[5, 12], [-2, 13], [-9, 16], [-14, 15], [-10, 19], [-4, 18], [3, 16]], '#a03cb0')
  scarfA.line(-12, 16, -4, 16, '#d07ad8'); scarfA.outline('#1a1028')
  scarfB.poly([[5, 12], [-2, 12], [-8, 13], [-15, 11], [-12, 16], [-4, 17], [3, 16]], '#a03cb0')
  scarfB.line(-12, 13, -3, 14, '#d07ad8'); scarfB.outline('#1a1028')
  const HERO = [206, 196]
  part('hero', 'center', union(bbox(hero, ...HERO), bbox(sword, ...HERO), bbox(scarfA, ...HERO), bbox(scarfB, ...HERO)))

  // ---------------------------------------------------------------- the slime (round and friendly)
  const slime = new Sprite()
  slime.ell(13, 13, 13.5, 11.5, null, (x, y, dx, dy) => {
    if (y > 21) return
    const v = -dx * 0.45 - dy * 0.65
    slime.set(x, y, v > 0.62 ? '#c8ecff' : v > 0.3 ? '#7cc4ff' : v > -0.15 ? '#4a98f0' : v > -0.5 ? '#2f6ed8' : '#2050b0')
  })
  slime.ell(7.5, 6, 2.6, 1.8, '#ffffff'); slime.set(11, 4, '#ffffff')
  for (const ex of [8, 16]) { slime.rect(ex, 9, 3, 5, '#ffffff'); slime.rect(ex + 1, 10, 2, 4, '#10183a'); slime.set(ex + 1, 10, '#ffffff') }
  slime.rect(9, 16, 10, 1, '#141e50'); slime.rect(10, 17, 8, 1, '#141e50'); slime.rect(11, 17, 6, 1, '#e8608a'); slime.rect(11, 18, 6, 1, '#141e50')
  slime.set(8, 15, '#141e50'); slime.set(19, 15, '#141e50')
  slime.rect(5, 14, 2, 1, '#ff9ac0'); slime.rect(21, 14, 2, 1, '#ff9ac0')
  slime.outline('#132058')
  const SLIME = [254, 205]
  part('slime', 'center', bbox(slime, ...SLIME))

  // ---------------------------------------------------------------- the floating castle, in the center's sky
  const fc = new Sprite()
  const FS = ['#b8a078', '#e8d8b0', '#fff0d0', '#8a7454']
  const FR = ['#a8401e', '#e0703a', '#ff9a5a']
  fc.poly([[0, 60], [72, 60], [64, 70], [54, 78], [46, 96], [40, 112], [34, 92], [24, 80], [8, 70]], '#7a6a58')
  fc.recolor((x, y, c) => (c !== '#7a6a58' ? null : x > 44 ? '#5a4a3a' : x < 16 ? '#9a8a70' : null))
  for (let x = 0; x <= 72; x++) { fc.set(x, 59, LEAF[2]); fc.set(x, 60, LEAF[1]); if (x % 7 === 2) { const l = 2 + (x * 7) % 9; fc.line(x, 61, x, 61 + l, LEAF[x % 2 ? 1 : 2]) } }
  for (const [x, y, w, h] of [[10, 38, 52, 22], [4, 26, 10, 34], [58, 26, 10, 34], [20, 18, 9, 22], [43, 18, 9, 22], [30, 6, 12, 40]]) {
    fc.rect(x, y, w, h, FS[1]); fc.rect(x + w - 3, y, 3, h, FS[0]); fc.rect(x, y, 1, h, FS[2])
  }
  for (let x = 10; x < 62; x += 4) fc.rect(x, 36, 2, 2, FS[1])
  for (const [x, y, w] of [[4, 26, 10], [58, 26, 10], [20, 18, 9], [43, 18, 9], [30, 6, 12]]) {
    const hgt = w + 6
    fc.poly([[x - 1, y], [x + w + 1, y], [x + w / 2, y - hgt]], FR[1])
    fc.poly([[x + w / 2, y], [x + w + 1, y], [x + w / 2, y - hgt]], FR[0])
    fc.line(x + w / 2 - 2, y - 2, x + w / 2 - 1, y - hgt + 4, FR[2])
    fc.line(x + w / 2, y - hgt, x + w / 2, y - hgt - 5, '#4a3a2a'); fc.rect(x + w / 2 + 1, y - hgt - 5, 4, 2, '#8a4ad0')
  }
  for (const [x, y] of [[8, 34], [8, 44], [62, 34], [62, 44], [24, 26], [47, 26], [35, 14], [35, 26], [20, 46], [52, 46]]) fc.rect(x, y, 2, 3, '.win')
  fc.ell(36, 54, 4, 3, '#3a2a30'); fc.rect(32, 54, 8, 6, '#3a2a30')
  fc.outline('#2e2030')
  const fcFalls = [[18, 66, 118], [38, 92, 148], [56, 68, 96]].map(([x, y0, y1]) =>
    `<rect class="wf" x="${x}" y="${y0}" width="3" height="${(y1 - y0) * 0.6}"/><rect class="wf" x="${x}" y="${y0 + (y1 - y0) * 0.6}" width="3" height="${(y1 - y0) * 0.4}" opacity=".45"/>`
    + `<line class="fall" x1="${x + 1.5}" x2="${x + 1.5}" y1="${y0}" y2="${y1}" stroke="#ffffff" stroke-opacity=".8" stroke-dasharray="3 5"/>`).join('')
  const rockSprite = (w, h) => { const r = new Sprite(); r.poly([[0, 0], [w, 0], [w / 2, h]], '#7a6a58'); r.rect(0, -1, w + 1, 1, LEAF[2]); r.outline('#2e2030'); return r }
  const FC = [204, 16], ROCK1 = [194, 72], ROCK2 = [276, 58]
  const r1 = rockSprite(8, 7), r2 = rockSprite(8, 7)
  part('floating-castle', 'center', union(bbox(fc, ...FC), [FC[0] + 18, FC[1] + 66, FC[0] + 59, FC[1] + 148], bbox(r1, ...ROCK1), bbox(r2, ...ROCK2)))

  // ---------------------------------------------------------------- right: cliff, fortress, falls, ledge with the guide
  const cliff = new Sprite()
  const RK = ['#5a4836', '#7c6448', '#9c8260', '#bca27c']
  cliff.poly([[388, 44], [414, 36], [480, 32], [480, 204], [440, 200], [406, 196], [390, 176], [384, 140], [392, 104], [384, 76]], RK[1])
  cliff.recolor((x, y) => {
    const r = (y - 36 + (x > 440 ? 5 : 0)) % 16
    return r === 0 ? RK[3] : r === 1 ? RK[2] : r === 15 ? RK[0] : null
  })
  cliff.recolor((x, y) => (cliff.has(x - 1, y) ? null : RK[3]))
  for (let i = 0; i < 20; i++) {
    const x = Math.round(388 + rnd() * 92), y = Math.round(46 + rnd() * 150)
    if (!cliff.has(x, y)) continue
    const len = 3 + Math.floor(rnd() * 6)
    for (let j = 0; j < len; j++) if (cliff.has(x, y + j)) { cliff.set(x, y + j, RK[0]); if (cliff.has(x + 1, y + j)) cliff.set(x + 1, y + j, RK[2]) }
  }
  for (let i = 0; i < 12; i++) {
    const x = 392 + rnd() * 86, y = 44 + rnd() * 150
    if (!cliff.has(Math.round(x), Math.round(y))) continue
    const r = 3 + rnd() * 4
    for (const [ox, oy, k] of [[0, 0, 1], [-r * 0.9, r * 0.3, 0.7], [r * 0.9, r * 0.35, 0.65]]) cliff.ell(x + ox, y + oy, r * 1.1 * k, r * 0.85 * k, null, (px, py, dx, dy) => cliff.set(px, py, dy < -0.35 && dx < 0.35 ? LEAF[3] : dy > 0.45 || dx > 0.6 ? LEAF[1] : LEAF[2]))
  }
  for (let x = 388; x < 480; x++) { cliff.set(x, 37 + Math.round(Math.sin(x / 5) * 1.5), LEAF[2]); cliff.set(x, 38 + Math.round(Math.sin(x / 5) * 1.5), LEAF[1]) }
  // a shelf halfway up, where the mushroom guide stands by the sign (y 82 here is y 100 on screen)
  cliff.rect(384, 82, 70, 3, RK[3]); cliff.rect(384, 85, 70, 1, RK[0])
  cliff.each((x, y) => { if (x < RIGHT[0] + 1) cliff.del(x, y) })
  cliff.outline('#2a1e14')
  const fort = new Sprite()
  const SS = ['#a88848', '#d8b878', '#f0d8a0', '#7a5e2e']
  const RR = ['#8a2a1a', '#c84a2a', '#e8704a']
  for (const [x, y, w, h] of [[398, 14, 12, 26], [438, 8, 14, 32], [410, 20, 30, 20], [420, 2, 12, 22]]) {
    fort.rect(x, y, w, h, SS[1]); fort.rect(x + w - 3, y, 3, h, SS[0]); fort.rect(x, y, 2, h, SS[2])
    for (let bx = x; bx < x + w; bx += 4) fort.rect(bx, y - 2, 2, 2, SS[1])
  }
  for (const [x, w, y] of [[398, 12, 14], [438, 14, 0], [420, 12, 2]]) {
    fort.poly([[x - 2, y], [x + w + 2, y], [x + w / 2, y - 14]], RR[1])
    fort.poly([[x + w / 2, y], [x + w + 2, y], [x + w / 2, y - 14]], RR[0])
    fort.line(x + w / 2, y - 14, x + w / 2, y - 19, '#4a3a2a'); fort.rect(x + w / 2 + 1, y - 19, 4, 2, '#8a4ad0')
  }
  fort.rect(421, 24, 8, 10, '#6a2a9a'); fort.rect(424, 27, 2, 3, '#f2c230'); fort.rect(423, 34, 1, 1, '#6a2a9a'); fort.rect(428, 34, 1, 1, '#6a2a9a')
  fort.ell(425, 39, 4, 3, '#2a1e18'); fort.rect(421, 38, 8, 3, '#2a1e18')
  for (const [x, y] of [[402, 22], [402, 30], [443, 18], [447, 28], [414, 28], [434, 28], [425, 8]]) fort.rect(x, y, 2, 3, '.win')
  fort.outline('#2a1e14')
  const CLIFF_DY = 18
  part('cliff', 'right', bbox(cliff, 0, CLIFF_DY, x => x < VISIBLE[1]))
  part('cliff-bleed', 'right', bbox(cliff, 0, CLIFF_DY, x => x >= VISIBLE[1]))
  part('fortress', 'right', bbox(fort, 0, CLIFF_DY))
  const falls = [[408, 60, 196, 4], [426, 84, 200, 6], [446, 52, 196, 4], [392, 120, 194, 4]].map(([x, y0, y1, w]) =>
    `<rect class="wf" x="${x}" y="${y0}" width="${w}" height="${y1 - y0}"/><rect class="wfs" x="${x + w - 1}" y="${y0}" width="1" height="${y1 - y0}"/>`
    + `<line class="fall" x1="${x + 1.5}" x2="${x + 1.5}" y1="${y0}" y2="${y1}" stroke="#ffffff" stroke-opacity=".85" stroke-dasharray="4 6"/>`
    + `<rect class="w1" x="${x - 3}" y="${y1 - 2}" width="${w + 6}" height="2" opacity=".8"/>`).join('')
  part('falls', 'right', [389, 52 + CLIFF_DY, 456, 200 + CLIFF_DY])

  const shroom = new Sprite()
  shroom.ell(11, 8, 11, 7.5, null, (x, y, dx, dy) => {
    if (y > 9) return
    const v = -dx * 0.4 - dy * 0.7
    shroom.set(x, y, v > 0.55 ? '#c49af0' : v > 0.1 ? '#8a5ad0' : '#5e34a0')
  })
  for (const [x, y, r] of [[6, 4, 2], [14, 3, 1.6], [18, 7, 1.4], [3, 8, 1.2], [11, 8, 1.3]]) shroom.ell(x, y, r, r, '#f6ecd4')
  shroom.rect(4, 10, 14, 1, '#d8c49a')
  shroom.ell(11, 15, 6, 5.5, null, (x, y, dx) => { if (y >= 10) shroom.set(x, y, dx > 0.4 ? '#c8ad84' : '#f0dcb0') })
  shroom.rect(8, 13, 1, 2, '#2a1a30'); shroom.rect(13, 13, 1, 2, '#2a1a30'); shroom.rect(10, 16, 2, 1, '#9a5a4a')
  shroom.set(7, 15, '#ff9ab0'); shroom.set(14, 15, '#ff9ab0')
  shroom.line(16, 16, 21, 13, '#f0dcb0'); shroom.set(22, 12, '#f0dcb0')
  shroom.rect(1, 13, 4, 6, '#7a4a24'); shroom.rect(1, 13, 4, 1, '#9a6a34')
  shroom.rect(7, 20, 3, 2, '#6a4a2a'); shroom.rect(12, 20, 3, 2, '#6a4a2a')
  shroom.outline('#2a1a3a')
  const SHROOM = [386, 79]
  part('mushroom', 'right', bbox(shroom, ...SHROOM))

  const sign = new Sprite()
  const SW = { base: '#c89c5c', dark: '#a07a40', edge: '#4a2e14', ink: '#3a2410' }
  sign.rect(429, 97, 3, 4, '#7a5228'); sign.rect(429, 97, 1, 4, '#9a6a34')
  sign.rect(411, 74, 40, 24, SW.base)
  for (let y = 78; y < 98; y += 5) sign.rect(412, y, 38, 1, SW.dark)
  text(sign, 'PRINCESS', 415, 77, SW.ink)
  text(sign, 'IN THAT', 417, 84, SW.ink)
  text(sign, 'CASTLE!^', 415, 91, SW.ink)
  sign.outline(SW.edge)
  part('princess-sign', 'right', bbox(sign))

  // ---------------------------------------------------------------- right: campfire, guitars, amp, books
  const FIRE_DX = EFFECTS.fire[0] - 378, FIRE_DY = 246 - 248
  const fireRing = new Sprite()
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, x = 378 + Math.cos(a) * 13, y = 248 + Math.sin(a) * 4.5
    fireRing.rect(Math.round(x) - 2, Math.round(y) - 1, 4, 3, i % 2 ? '#8a8478' : '#a8a294')
    fireRing.set(Math.round(x) - 1, Math.round(y) - 1, '#c4beb0')
  }
  fireRing.line(369, 248, 387, 244, '#6a4020', 2); fireRing.line(369, 244, 387, 248, '#5a3418', 2)
  fireRing.outline('#2a2620')
  function flame(seedShift) {
    const f = new Sprite()
    const r = makeRandom(seedShift)
    f.poly([[370, 246], [386, 246], [384, 238], [380 + r() * 3, 228 + r() * 3], [378, 236], [375 - r() * 2, 230 + r() * 3], [372, 238]], '#e04a14')
    f.poly([[372, 246], [384, 246], [382, 240], [379, 233 + r() * 3], [376, 240]], '#ff9a2a')
    f.poly([[375, 246], [381, 246], [380, 242], [378, 238 + r() * 2], [376, 242]], '#fff1a0')
    return f
  }
  const flameSprites = [1, 2, 3].map(n => flame(n * 77))
  const flames = flameSprites.map((f, i) => `<g class="fl${i + 1}">${f.svg()}</g>`).join('')
  part('campfire', 'right', union(bbox(fireRing, FIRE_DX, FIRE_DY), ...flameSprites.map(f => bbox(f, FIRE_DX, FIRE_DY))))

  // Guitars are drawn upright in local coordinates (origin at the bottom of the body, y up is
  // negative), then sheared into a lean as they're placed, which keeps the pixels square.
  const FRETBOARD = '#3a2214', FRET = '#cfc6b2', INLAY = '#f4f0e6', STRING = '#e6e6ee'
  const CHROME = '#d4d8e0', CHROME_D = '#8a90a0', GUARD = '#f2efe6'
  function neck(g, top, bottom) {
    g.rect(-2, top, 4, bottom - top, FRETBOARD)
    let gap = 5, n = 0
    for (let y = bottom - 3; y > top + 2; y -= gap, n++) {
      g.rect(-2, y, 4, 1, FRET)
      if ([2, 4, 6, 8].includes(n)) g.set(-1, y + Math.ceil(gap / 2), INLAY)
      if (n === 11) { g.set(-2, y + 2, INLAY); g.set(1, y + 2, INLAY) }
      if (n % 3 === 2 && gap > 3) gap--
    }
    g.rect(-2, top, 4, 1, '#f0e8d0')
  }
  function shade(g, base, light, dark) {
    g.recolor((x, y, c) => (c !== base ? null : !g.has(x - 1, y) || !g.has(x, y - 1) ? light : !g.has(x + 1, y) || !g.has(x, y + 1) ? dark : null))
  }
  function strat() {
    const g = new Sprite(), B = ['#1e3a98', '#2f58c8', '#6a90f0']
    g.ell(0, -12, 13, 12, B[1]); g.ell(-1, -28, 10.5, 9, B[1])
    g.ell(-7, -38, 3.5, 7, B[1]); g.ell(6, -35, 3, 5, B[1])
    for (let y = -46; y < -37; y++) for (let x = -3; x <= 2; x++) g.del(x, y)
    shade(g, B[1], B[2], B[0])
    g.poly([[-10, -33], [-3, -37], [4, -37], [5, -9], [-5, -5], [-12, -13]], GUARD)
    for (const y of [-32, -25, -18]) { g.rect(-3, y, 6, 2, '#ffffff'); g.rect(-3, y + 1, 6, 1, '#d8d4c8') }
    g.rect(-4, -11, 8, 2, CHROME); g.rect(-4, -10, 8, 1, CHROME_D)
    for (const [x, y] of [[7, -13], [8, -18], [6, -22]]) g.ell(x, y, 1.4, 1.4, CHROME)
    g.rect(9, -7, 2, 3, CHROME_D)
    g.rect(-1, -37, 1, 26, STRING); g.rect(0, -37, 1, 26, STRING)
    neck(g, -86, -37)
    g.poly([[-2, -86], [2, -86], [3, -89], [1, -99], [-4, -100], [-4, -93]], '#e8cc96')
    g.rect(-1, -98, 1, 11, '#c8a868')
    for (let y = -98; y <= -88; y += 2) g.set(-5, y, CHROME)
    return g
  }
  function flyingV() {
    const g = new Sprite(), P = ['#4a2490', '#6a3ac8', '#9a6ae8']
    g.poly([[-5, -47], [5, -47], [22, -2], [13, 1], [0, -24], [-13, 1], [-22, -2]], P[1])
    shade(g, P[1], P[2], P[0])
    g.poly([[-5, -46], [5, -46], [7, -32], [0, -24], [-7, -32]], GUARD)
    for (const y of [-44, -36]) {
      g.rect(-4, y, 8, 4, '#1c1c22')
      for (let x = -3; x <= 2; x++) { g.set(x, y + 1, CHROME_D); g.set(x, y + 2, CHROME_D) }
    }
    g.rect(-4, -30, 8, 2, CHROME); g.rect(-3, -27, 6, 1, CHROME_D)
    for (const [x, y] of [[12, -9], [15, -5], [10, -4]]) g.ell(x, y, 1.4, 1.4, '#e8c040')
    g.rect(-1, -47, 1, 18, STRING); g.rect(0, -47, 1, 18, STRING)
    neck(g, -94, -47)
    g.poly([[-2, -94], [2, -94], [6, -104], [0, -100], [-6, -104]], P[1])
    for (const [x, y] of [[-4, -98], [-5, -100], [-6, -102]]) { g.set(x - 1, y, CHROME); g.set(-x, y, CHROME) }
    return g
  }
  const guitars = new Sprite()
  const place = (src, bx, by, lean) => src.each((x, y, c) => guitars.set(bx + x + Math.round(-y * lean), by + y, c))
  place(flyingV(), 406, 236, 0.08)
  guitars.outline('#1e0e3a')
  place(strat(), 436, 234, 0.13)
  guitars.outline('#0e1a4a')
  part('guitars', 'right', bbox(guitars))

  const amp = new Sprite()
  amp.rect(429, 228, 26, 26, '#262428'); amp.rect(429, 228, 26, 3, '#3e3a40'); amp.rect(432, 233, 20, 18, '#141216')
  for (let y = 234; y < 250; y += 2) amp.rect(433, y, 18, 1, '#1e1c22')
  amp.grid(['...####', '...#..#', '...#..#', '.###.##', '####.##', '.##....'], 437, 236, { '#': '#5ad0ff' })
  amp.rect(433, 229, 2, 1, '#f2c230'); amp.rect(437, 229, 2, 1, '#f2c230')
  amp.outline('#0a080c')
  part('amp', 'right', bbox(amp))

  const books = new Sprite()
  for (const [title, color, x, y] of [['QUESTS', '#22307a', 412, 250], ['XP & POTIONS', '#22663a', 393, 257], ['CODE MAGIC', '#2a4aa8', 401, 264]]) {
    const w = textWidth(title) + 14
    books.rect(x, y, w, 7, color); books.rect(x, y + 6, w, 1, '#10101a'); books.rect(x + w - 3, y + 1, 2, 5, '#efe6c8'); books.rect(x, y, w, 1, '#ffffff')
    books.rect(x + 2, y + 1, 1, 5, '#f2c230')
    text(books, title, x + 5, y + 1, '#f2c230')
  }
  books.outline('#140c1e')
  part('books', 'right', bbox(books))

  // ---------------------------------------------------------------- the seams' filler
  const seamSvg = seam => {
    const x0 = seam === 'L' ? SEAM_L[0] : SEAM_R[0]
    const f = filler(SEAM_SEEDS[seam], SEAM_W)
    const starSvg = f.stars.map(([x, y, cls, fill]) => `<rect class="${cls}" x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`).join('')
    return {
      sky: `<g transform="translate(${x0} 0)">${f.sky.svg()}</g>`,
      stars: `<g transform="translate(${x0} 0)">${starSvg}</g>`,
      sea: `<g transform="translate(${x0} 0)">${f.sea.svg()}</g>`,
      foam: `<g transform="translate(${x0} 0)">${f.foam.svg()}</g>`,
      land: `<g transform="translate(${x0} 0)">${f.land.svg()}</g>`,
    }
  }
  const sL = seamSvg('L'), sR = seamSvg('R')

  // ---------------------------------------------------------------- assemble
  const style = (`
.n,.nv{display:none}
@media (prefers-color-scheme: dark){.d{display:none}.n{display:inline}.nv{display:inline}}
${modeCss(MODE)}
.gw{opacity:.35}
@media (prefers-color-scheme: dark){.gw{opacity:1}}
@keyframes bob{0%{transform:translateY(0)}25%{transform:translateY(-1px)}50%{transform:translateY(-2px)}75%{transform:translateY(-1px)}}
.bob{animation:bob 7s steps(1,end) infinite}.bob2{animation:bob 10s steps(1,end) infinite}.bob3{animation:bob 5s steps(1,end) infinite}
@keyframes hop{0%{transform:translateY(0) scale(1,1)}60%{transform:translateY(0) scale(1.1,.88)}70%{transform:translateY(-6px) scale(.92,1.08)}80%{transform:translateY(-3px) scale(1,1)}90%{transform:translateY(0) scale(1.08,.92)}100%{transform:translateY(0) scale(1,1)}}
.hop{transform-box:fill-box;transform-origin:50% 100%;animation:hop 3.2s steps(1,end) infinite}
@keyframes tw{0%,100%{opacity:1}50%{opacity:.15}}
.t1{animation:tw 6s ease-in-out infinite}.t2{animation:tw 8s ease-in-out 2s infinite}.t3{animation:tw 11s ease-in-out 4s infinite}
.s1{animation:tw 3s ease-in-out infinite}.s2{animation:tw 3s ease-in-out 1s infinite}.s3{animation:tw 3s ease-in-out 2s infinite}
@keyframes fall{to{stroke-dashoffset:-20}}
.fall{animation:fall 2s linear infinite}
@keyframes lap{0%{transform:translate(0,0)}50%{transform:translate(-2px,1px)}}
.foam{animation:lap 5s steps(1,end) infinite}
@keyframes sail{from{transform:translateX(0)}to{transform:translateX(${SAIL}px)}}
.sail{animation:sail 240s linear infinite alternate}
@keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}
.pulse{animation:pulse 5s ease-in-out infinite}.pulse2{animation:pulse 2.6s ease-in-out infinite}
@keyframes drip{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(22px);opacity:0}}
.fallp{animation:drip 6s linear infinite}.f2{animation-delay:2s}.f3{animation-delay:4s}
@keyframes three{0%{opacity:1}33.3%{opacity:0}100%{opacity:0}}
.fl1,.fl2,.fl3{opacity:0;animation:three 1.2s steps(1,end) infinite}.fl1{opacity:1}.fl2{animation-delay:.4s}.fl3{animation-delay:.8s}
@keyframes scarf{0%{opacity:1}50%{opacity:0}}
.sfA{animation:scarf 1.6s steps(1,end) infinite}.sfB{opacity:0;animation:scarf 1.6s steps(1,end) .8s infinite}
@keyframes blink{0%{opacity:1}50%{opacity:0}}
.cur{animation:blink 2s steps(1,end) infinite}
`).replace(/\n/g, '')

  // glows stay inside their group's columns
  const glow = (cx, cy, r, color, cls = 'pulse') =>
    `<g class="gw"><g class="${cls}">${[1, 0.82, 0.64, 0.48, 0.32].map(k => `<circle cx="${cx}" cy="${cy}" r="${Math.round(r * k)}" fill="${color}" opacity=".08"/>`).join('')}</g></g>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges"><style>${style}</style>`
    + sky + sL.sky + sR.sky
    + `<g class="n">${stars}${sL.stars}${sR.stars}</g>` + sunBloom + moonGroup
    + sea + sL.sea + sR.sea + `<g class="foam">${foam.svg()}${sL.foam}${sR.foam}</g>`
    + far.svg() + farC.svg() + `<g transform="translate(${SHIP[0]} ${SHIP[1]})"><g class="sail">${ship.svg()}</g></g>`
    // floating castle and its rocks
    + `<g transform="translate(${FC[0]} ${FC[1]})"><g class="bob2">${fcFalls}${fc.svg()}</g></g>`
    + `<g transform="translate(${ROCK1[0]} ${ROCK1[1]})"><g class="bob3">${r1.svg()}</g></g><g transform="translate(${ROCK2[0]} ${ROCK2[1]})"><g class="bob">${r2.svg()}</g></g>`
    // right cliff
    + `<g transform="translate(0 ${CLIFF_DY})">${falls}${cliff.svg()}${fort.svg()}</g>`
    // land
    + land.svg() + sL.land + sR.land + sand.svg() + ledge.svg()
    // left: palm, signs, crystal, computer, toys
    + palm.svg() + signs.svg()
    + `<g transform="translate(${CX[0]} ${CX[1]})"><g class="bob3">${crystal.svg()}${particles}</g></g>`
    + `<g transform="translate(${PC_DX} 0)">${pc.svg()}${cursor}</g>`
    + `<g transform="translate(${PAD[0]} ${PAD[1]})">${gamepad.svg()}</g><g transform="translate(${DIE[0]} ${DIE[1]})">${d20.svg()}</g><g transform="translate(${BOX[0]} ${BOX[1]})">${chest.svg()}</g>`
    // right props
    + `<g transform="translate(${FIRE_DX} ${FIRE_DY})">${fireRing.svg()}${flames}</g>` + guitars.svg() + amp.svg() + books.svg() + sign.svg()
    + `<g transform="translate(${SHROOM[0]} ${SHROOM[1]})">${shroom.svg()}</g>`
    // the heroes
    + `<g class="mid"><g transform="translate(${HERO[0]} ${HERO[1]})"><g class="sfA">${scarfA.svg()}</g><g class="sfB">${scarfB.svg()}</g>${hero.svg()}${sword.svg()}</g>`
    + `<ellipse cx="${SLIME[0] + 14}" cy="226" rx="12" ry="2" fill="#000" opacity=".2"/><g transform="translate(${SLIME[0]} ${SLIME[1]})"><g class="hop">${slime.svg()}</g></g></g>`
    // night: dim the world, then let the lights glow through
    + `<rect class="nv" x="0" y="0" width="${W}" height="${H}" fill="#0a1040" opacity=".3"/>`
    + glow(CX[0], CX[1], 13, '#5aa8ff') + glow(EFFECTS.fire[0], EFFECTS.fire[1], 14, '#ff9a40', 'pulse2') + glow(PC_DX + 31, 200, 24, '#6aff8a')
    + glow(BOX[0] + 93, 244, 12, '#ffd860') + glow(443, 242, 10, '#5ad0ff') + glow(HERO[0] + 35, 182, 14, '#7ad0ff')
    + `</svg>`

  // A seam rendered alone for `width` columns, one string per column (top to bottom), for tests.
  const seamColumns = (seam, width) => {
    const f = filler(SEAM_SEEDS[seam], width)
    const starAt = new Map(f.stars.map(([x, y, cls]) => [`${x},${y}`, cls]))
    return Array.from({ length: width }, (_, x) => {
      let col = ''
      for (let y = 0; y < H; y++) col += `${f.sky.get(x, y) ?? ''}|${f.sea.get(x, y) ?? ''}|${f.foam.get(x, y) ?? ''}|${f.land.get(x, y) ?? ''}|${starAt.get(`${x},${y}`) ?? ''};`
      return col
    })
  }

  return { svg, parts, seamColumns }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { svg } = buildScene()
  console.log('scene chars:', svg.length)
  if (svg.length > 131072) throw new Error('too big: ' + svg.length)
  writeFileSync(process.argv[2], `// Generated by art/gen.mjs: the Hero's Shore backdrop, all pixel art drawn as SVG paths.\nexport const SCENE = ${JSON.stringify(svg)}\n`)
  if (process.argv[3]) writeFileSync(process.argv[3], `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000}div{position:fixed;inset:0}div svg{width:100%;height:100%;display:block}</style><div>${svg}</div>`)
}
