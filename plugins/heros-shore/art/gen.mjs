// Generates the Hero's Shore backdrop: a 32-bit-style coast at golden hour (light) or moonlight (dark).
// usage, from the plugin folder: node art/gen.mjs hooks/scene.ts [preview.html]
import { writeFileSync } from 'node:fs'
import { Sprite, makeRandom, text, textWidth, bands, dither, modeCss } from './pixel.mjs'

const W = 480, H = 270, HY = 150
const rnd = makeRandom(20261124)
const pick = arr => arr[Math.floor(rnd() * arr.length)]
const lerp = (a, b, t) => a + (b - a) * t

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

// ---------------------------------------------------------------- sky
const SKY_STOPS = [0, 18, 36, 54, 72, 90, 106, 120, 132, 142, HY]
let sky = bands(0, 0, W, SKY_STOPS, ['k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9'])

// impressionist dabs: dense at the edges and top, clear around the bright center
const dabs = new Sprite()
for (let k = 0; k < 52; k++) {
  const cx = rnd() * W, cy = 6 + rnd() * (HY - 30)
  const d = Math.hypot((cx - 240) / 160, (cy - 128) / 80)
  if (d < 1 && rnd() < 0.85) continue
  const t = cy / HY
  const ramp = t < 0.4 ? ['.p5', '.p1', '.p3'] : t < 0.75 ? ['.p3', '.p1', '.p2'] : ['.p2', '.p4', '.p6']
  const n = 16 + Math.floor(rnd() * 22), sx = 10 + rnd() * 18, sy = 2 + rnd() * 3
  for (let i = 0; i < n; i++) {
    const gx = (rnd() + rnd() + rnd() - 1.5) / 1.5, gy = (rnd() + rnd() + rnd() - 1.5) / 1.5
    const x = Math.round(cx + gx * sx), y = Math.round(cy + gy * sy)
    dabs.rect(x, y, 2 + Math.floor(rnd() * 4), 1, gy < -0.25 ? ramp[1] : gy > 0.35 ? ramp[2] : ramp[0])
  }
}
for (let i = 0; i < 260; i++) {
  const x = Math.floor(rnd() * W), y = Math.floor(rnd() * (HY - 8))
  if (Math.hypot((x - 240) / 170, (y - 128) / 85) < 1) continue
  dabs.rect(x, y, 2, 1, pick(['.p1', '.p3', '.p2', '.p4']))
}
sky += dabs.svg()

// stars and moon (dark only), the sun's bloom (light only)
let stars = ''
for (let i = 0; i < 70; i++) {
  const x = Math.floor(rnd() * W), y = Math.floor(rnd() * 110)
  stars += `<rect class="t${1 + (i % 3)}" x="${x}" y="${y}" width="1" height="1" fill="${i % 4 ? '#e8e8ff' : '#ffe9a8'}"/>`
}
const moon = new Sprite()
moon.ell(0, 0, 13, 13, '#f2ecd2')
for (const [x, y, r] of [[-4, -3, 3], [4, 4, 2.5], [5, -5, 1.6], [-3, 6, 1.5]]) moon.ell(x, y, r, r, '#d6cfa8')
moon.ell(-5, -7, 2, 1.5, '#fffbe8')
const sunBloom = `<g class="d"><circle cx="240" cy="${HY}" r="90" fill="#fff2c8" opacity=".25"/><circle cx="240" cy="${HY}" r="55" fill="#fff6d8" opacity=".35"/><circle cx="240" cy="${HY}" r="26" fill="#fffbea" opacity=".6"/></g>`
const moonGroup = `<g class="n"><circle cx="240" cy="96" r="44" fill="#8a7cc8" opacity=".06"/><circle cx="240" cy="96" r="34" fill="#8a7cc8" opacity=".07"/><circle cx="240" cy="96" r="24" fill="#a89ad8" opacity=".09"/><g transform="translate(240 96)">${moon.svg()}</g></g>`

// ---------------------------------------------------------------- sea
const SEA_STOPS = [HY, 156, 164, 174, 186, 198, 214]
let sea = bands(0, HY, W, SEA_STOPS, ['q0', 'q1', 'q2', 'q3', 'q4', 'q5'])
const waves = new Sprite()
for (let i = 0; i < 90; i++) {
  const y = Math.floor(HY + 1 + Math.pow(rnd(), 0.8) * 62)
  const x = Math.floor(rnd() * W)
  const depth = (y - HY) / 64
  const len = 1 + Math.floor(depth * 6 + rnd() * 3)
  waves.rect(x, y, len, 1, rnd() < 0.55 ? '.w1' : rnd() < 0.5 ? '.w3' : '.w2')
}
sea += waves.svg()
// glitter path under the sun / moon, in three twinkling sets
for (let set = 1; set <= 3; set++) {
  const g = new Sprite()
  for (let i = 0; i < 45; i++) {
    const y = Math.floor(HY + 1 + rnd() * 58)
    const spread = 6 + (y - HY) * 0.9
    const x = Math.floor(240 + (rnd() * 2 - 1) * spread)
    g.rect(x, y, 1 + Math.floor((y - HY) / 14), 1, '.g1')
  }
  sea += `<g class="s${set}">${g.svg()}</g>`
}
// foam along the shore
const foam = new Sprite()
for (let x = 120; x < 380; x++) {
  const y = Math.round(211 + Math.sin(x / 7) * 1.5 + Math.sin(x / 3.1) * 0.6)
  foam.set(x, y, '.w1')
  if (x % 3) foam.set(x, y + 1, '.w3')
}
sea += `<g class="foam">${foam.svg()}</g>`

// ---------------------------------------------------------------- horizon
const far = new Sprite()
far.poly([[70, 150], [82, 141], [96, 139], [104, 133], [112, 137], [126, 140], [140, 150]], '.h1')
far.rect(100, 122, 4, 12, '.h1'); far.poly([[99, 122], [105, 122], [102, 115]], '.h1'); far.rect(108, 128, 3, 8, '.h1'); far.poly([[107, 128], [112, 128], [109.5, 123]], '.h1')
far.poly([[150, 150], [158, 145], [166, 146], [172, 150]], '.h2')
far.poly([[322, 150], [328, 143], [336, 144], [340, 140], [348, 146], [356, 150]], '.h1')
far.poly([[364, 150], [370, 146], [378, 150]], '.h2')
const ship = new Sprite()
ship.poly([[0, 6], [10, 6], [8, 8], [2, 8]], '.h1'); ship.line(5, -2, 5, 6, '.h1'); ship.poly([[5.5, -1], [9, 4], [5.5, 4]], '.h2'); ship.poly([[4.5, 0], [1.5, 4], [4.5, 4]], '.h2')

// ---------------------------------------------------------------- land
const GR = ['#1d4424', '#2b6230', '#43843a', '#73aa46', '#a6cf5a']
const land = new Sprite()
land.poly([[0, 196], [50, 193], [100, 200], [150, 208], [178, 214], [196, 226], [182, 270], [0, 270]], GR[1])
land.poly([[480, 192], [430, 198], [372, 204], [326, 210], [300, 214], [284, 226], [300, 270], [480, 270]], GR[1])
// grass texture strokes and flowers
const FLOWERS = ['#b070e0', '#e070b0', '#f2d060', '#8a5ad8', '#ffffff']
land.recolor(() => null)
const landPixels = []
land.each((x, y) => landPixels.push([x, y]))
for (let i = 0; i < 320; i++) {
  const [x, y] = landPixels[Math.floor(rnd() * landPixels.length)]
  const r = rnd()
  const c = r < 0.35 ? GR[0] : r < 0.75 ? GR[2] : r < 0.92 ? GR[3] : GR[4]
  land.rect(x, y, 1 + Math.floor(rnd() * 3), 1, c)
  if (rnd() < 0.4 && land.has(x, y - 1)) land.set(x, y - 1, c)
}
for (let i = 0; i < 110; i++) {
  const [x, y] = landPixels[Math.floor(rnd() * landPixels.length)]
  const c = pick(FLOWERS)
  land.set(x, y, c); if (rnd() < 0.5) land.set(x + 1, y, c)
}
// tufts poking above the grass line
land.each((x, y, c) => { if (!land.has(x, y - 1) && y < 230 && rnd() < 0.08) { land.set(x, y - 1, GR[2]); if (rnd() < 0.5) land.set(x, y - 2, GR[3]) } })

// the sand path to the sea
const sand = new Sprite()
sand.poly([[196, 212], [292, 212], [318, 270], [164, 270]], '#d6b072')
const SAND = ['#e8c890', '#c4985a', '#b0844c', '#f2dcaa']
const sandPx = []; sand.each((x, y) => sandPx.push([x, y]))
for (let i = 0; i < 520; i++) {
  const [x, y] = sandPx[Math.floor(rnd() * sandPx.length)]
  sand.rect(x, y, 1 + Math.floor(rnd() * 2), 1, pick(SAND))
}

// a stone ledge the hero stands on
const ledge = new Sprite()
const STN = ['#8c8270', '#6c6252', '#a89e88', '#4e4638']
for (let row = 0; row < 3; row++) {
  const y = 226 + row * 5
  for (let x = 128 - row * 4; x < 246 + row * 3;) {
    const w = 8 + Math.floor(rnd() * 6)
    ledge.rect(x, y, w - 1, 4, STN[0])
    ledge.rect(x, y, w - 1, 1, STN[2])
    ledge.rect(x + w - 2, y + 1, 1, 3, STN[1])
    if (rnd() < 0.4) ledge.rect(x + 2, y + 2, 2, 1, STN[1])
    if (rnd() < 0.3) ledge.rect(x + 1, y + 3, 3, 1, GR[2])
    x += w
  }
}
ledge.outline(STN[3])

// ---------------------------------------------------------------- left: palm, signs
const palm = new Sprite()
const BARK = ['#4a3220', '#6a4a2a', '#8a6438', '#a8804a']
const P0 = [26, 236], PC = [6, 120], P1 = [62, 24]
const bez = (t, a, c, b) => [lerp(lerp(a[0], c[0], t), lerp(c[0], b[0], t), t), lerp(lerp(a[1], c[1], t), lerp(c[1], b[1], t), t)]
for (let i = 0; i <= 260; i++) {
  const t = i / 260, [x, y] = bez(t, P0, PC, P1)
  const w = lerp(10, 6, t), ring = Math.floor(t * 36) % 3 === 0
  for (let o = -w / 2; o <= w / 2; o++) {
    const f = (o + w / 2) / w
    const c = f < 0.2 ? BARK[3] : f > 0.75 ? BARK[0] : ring ? BARK[1] : BARK[2]
    palm.set(x + o, y, c)
  }
}
const LEAF = ['#16461f', '#22682a', '#3a8a32', '#6ab83a', '#a8d84a']
function frond(sx, sy, ang, len, droop) {
  const pts = []
  for (let i = 0; i <= len; i++) {
    const t = i / len
    const a = ang + droop * t * t
    const prev = pts[i - 1] || [sx, sy]
    pts.push([prev[0] + Math.cos(a), prev[1] + Math.sin(a)])
  }
  pts.forEach(([x, y], i) => {
    const t = i / len
    palm.set(x, y, LEAF[1])
    const a = ang + droop * t * t
    const leaflet = Math.max(2, Math.round((1 - t) * 8 + 3))
    if (i % 2 === 0) for (const side of [-1, 1]) {
      const la = a + side * 1.1 + 0.35 * side
      for (let s = 1; s <= leaflet; s++) {
        const lx = x + Math.cos(la) * s, ly = y + Math.sin(la) * s + s * 0.25
        palm.set(lx, ly, s === leaflet ? LEAF[0] : side < 0 ? (s < 3 ? LEAF[4] : LEAF[3]) : LEAF[2])
      }
    }
  })
}
for (const [ang, len, droop] of [[-2.95, 62, -0.8], [-2.45, 54, -1.0], [-1.9, 42, -1.1], [-1.25, 40, 1.0], [-0.65, 56, 1.25], [-0.1, 64, 1.0], [0.5, 50, 0.8], [2.5, 48, 0.9]])
  frond(P1[0], P1[1], ang, len, droop)
for (const [x, y] of [[59, 28], [64, 29], [61, 31]]) { palm.ell(x, y, 2.6, 2.6, '#4a2e14'); palm.set(x - 1, y - 1, '#7a5228') }

const signs = new Sprite()
const WOOD = { base: '#6a4426', dark: '#4e301a', edge: '#2e1a0e', text: '#f6e8c6' }
const boards = [['ESCAPE', 'heart'], ['LEVEL UP', 'star'], ['QUEST ON', 'sword']]
boards.forEach(([label, icon], i) => {
  const y = 80 + i * 14, x = 8
  signs.rect(x, y, 48, 11, WOOD.base)
  for (let gx = x + 3; gx < x + 46; gx += 7) signs.rect(gx, y + 3 + (gx % 3), 4, 1, WOOD.dark)
  signs.rect(x, y + 10, 48, 1, WOOD.dark)
  if (icon === 'heart') signs.grid(['.#.#.', '#####', '#####', '.###.', '..#..'], x + 3, y + 3, { '#': '#e8404a' })
  if (icon === 'star') signs.grid(['..#..', '.###.', '#####', '.###.', '#.#.#'], x + 3, y + 3, { '#': '#ffd23f' })
  if (icon === 'sword') signs.grid(['....#', '...#.', '#.#..', '.#...', '#.#..'], x + 3, y + 3, { '#': '#cfe8ff' })
  text(signs, label, x + 11, y + 3, WOOD.text)
  signs.line(x + 8, y - 1, x + 8, y - (i === 0 ? 6 : 3), '#9a9aa8'); signs.line(x + 40, y - 1, x + 40, y - (i === 0 ? 6 : 3), '#9a9aa8')
})
signs.outline(WOOD.edge, c => c === WOOD.base || c === WOOD.dark)

// ---------------------------------------------------------------- left: crystal portal
const crystal = new Sprite()
const CRY = ['#13235e', '#1f3c9a', '#2f60d8', '#5f9cff', '#a8d4ff', '#effaff']
crystal.poly([[0, -46], [16, -26], [16, 18], [0, 40], [-16, 18], [-16, -26]], CRY[2])
crystal.poly([[0, -46], [16, -26], [16, 18], [0, 40], [4, 18], [4, -26]], CRY[1])
crystal.poly([[0, -46], [-16, -26], [-16, 18], [0, 40], [-8, 18], [-8, -26]], CRY[3])
crystal.poly([[0, -46], [4, -26], [4, 18], [0, 40], [-2, 18], [-2, -26]], CRY[4])
crystal.line(-6, -30, -6, 10, CRY[5]); crystal.line(-5, -36, -5, -32, CRY[5])
crystal.recolor((x, y, c) => (c === CRY[1] && (x + y) % 7 === 0 ? CRY[0] : null))
crystal.outline('#0c1440')
// vines draped over it
const VINE = ['#1e5a28', '#3a8a34', '#7ac04a']
for (const [x0, len] of [[-14, 30], [6, 40], [-11, 50]]) {
  for (let i = 0; i < len; i++) {
    const x = x0 + Math.round(Math.sin(i / 4 + x0) * 1.5), y = -34 + i
    crystal.set(x, y + (x0 > 0 ? 6 : 0), VINE[1])
    if (i % 4 === 0) { crystal.set(x - 1, y + (x0 > 0 ? 6 : 0), VINE[2]); crystal.set(x + 1, y + 1 + (x0 > 0 ? 6 : 0), VINE[0]) }
  }
}
for (let x = -16; x <= 16; x++) crystal.set(x, -27 + Math.round(Math.abs(x) * -0.3 + Math.sin(x) * 1.2) + 2, VINE[1])
let particles = ''
for (let i = 0; i < 14; i++) {
  const x = Math.round((rnd() * 2 - 1) * 12), y = 42 + Math.floor(rnd() * 8)
  particles += `<rect class="fallp f${1 + (i % 3)}" x="${x}" y="${y}" width="${rnd() < 0.3 ? 2 : 1}" height="${rnd() < 0.3 ? 2 : 1}" fill="${pick(['#8fd0ff', '#d8f2ff', '#5aa8ff'])}"/>`
}

// ---------------------------------------------------------------- left: computer and toys
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

const toys = new Sprite()
// a generic gamepad
toys.ell(16, 262, 8, 6, '#c9c5c0'); toys.ell(42, 262, 8, 6, '#c9c5c0'); toys.rect(16, 256, 26, 12, '#c9c5c0'); toys.rect(16, 256, 26, 1, '#e4e0dc')
toys.rect(12, 261, 7, 2, '#3a3838'); toys.rect(14, 259, 3, 6, '#3a3838')
toys.ell(41, 260, 1.6, 1.6, '#d8404a'); toys.ell(45, 263, 1.6, 1.6, '#4a70d8'); toys.rect(25, 263, 3, 1, '#7a7676'); toys.rect(30, 263, 3, 1, '#7a7676')
toys.outline('#2e2a2a')
// a d20
toys.poly([[60, 244], [67, 240], [74, 244], [74, 253], [67, 257], [60, 253]], '#6a3aa8')
toys.poly([[60, 244], [67, 240], [67, 248]], '#9a6ae0'); toys.poly([[67, 248], [74, 253], [67, 257], [60, 253]], '#4a2480')
text(toys, '20', 63, 247, '#ffffff')
toys.outline('#24123e', c => c !== '#ffffff')
// a treasure chest, lid open and glowing
const CH = ['#7a4a1e', '#a0662c', '#5a3412']
toys.rect(80, 250, 26, 14, CH[1]); toys.rect(80, 250, 26, 2, CH[0]); toys.rect(80, 256, 26, 1, CH[2])
toys.poly([[80, 250], [84, 241], [102, 241], [106, 250]], '#ffe680')
toys.poly([[82, 242], [86, 236], [102, 236], [104, 242]], CH[0])
for (const x of [83, 101]) { toys.rect(x, 250, 3, 14, '#f2c230'); toys.rect(x, 250, 1, 14, '#ffe680') }
toys.rect(91, 254, 4, 4, '#f2c230'); toys.set(92, 256, '#3a2410')
toys.outline('#2a180a', c => c !== '#ffe680')

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
// the crystal sword, held out to his right and pointing at the sky
const sword = new Sprite()
const dir = [0.62, -0.78], perp = [0.78, 0.62]
const hand = [19, 18]
for (let t = 4; t <= 44; t++) {
  const half = t > 40 ? 0 : t > 37 ? 1 : 2
  for (let o = -half; o <= half; o++) {
    const x = hand[0] + dir[0] * t + perp[0] * o, y = hand[1] + dir[1] * t + perp[1] * o
    sword.set(x, y, o < 0 ? '#e9fbff' : o === 0 ? '#9edcff' : o === 1 ? '#5aa4f2' : '#3a78d8')
  }
}
for (let o = -5; o <= 5; o++) sword.set(hand[0] + dir[0] * 3 + perp[0] * o, hand[1] + dir[1] * 3 + perp[1] * o, o === 0 ? '#5ad0ff' : '#f2c230')
for (let t = -2; t <= 2; t++) sword.set(hand[0] + dir[0] * t, hand[1] + dir[1] * t, '#5a3418')
sword.set(hand[0] + dir[0] * -3, hand[1] + dir[1] * -3, '#f2c230')
sword.outline('#0e1a4a')
// the purple scarf, two frames
const scarfA = new Sprite(), scarfB = new Sprite()
scarfA.poly([[5, 12], [-2, 13], [-9, 16], [-14, 15], [-10, 19], [-4, 18], [3, 16]], '#a03cb0')
scarfA.line(-12, 16, -4, 16, '#d07ad8'); scarfA.outline('#1a1028')
scarfB.poly([[5, 12], [-2, 12], [-8, 13], [-15, 11], [-12, 16], [-4, 17], [3, 16]], '#a03cb0')
scarfB.line(-12, 13, -3, 14, '#d07ad8'); scarfB.outline('#1a1028')

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

// ---------------------------------------------------------------- the mushroom guide and the sign
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

const sign = new Sprite()
const SW = { base: '#c89c5c', dark: '#a07a40', edge: '#4a2e14', ink: '#3a2410' }
sign.rect(352, 200, 3, 28, '#7a5228'); sign.rect(352, 200, 1, 28, '#9a6a34')
sign.rect(334, 180, 40, 24, SW.base)
for (let y = 184; y < 204; y += 5) sign.rect(335, y, 38, 1, SW.dark)
text(sign, 'PRINCESS', 338, 183, SW.ink)
text(sign, 'IN THAT', 340, 190, SW.ink)
text(sign, 'CASTLE!^', 338, 197, SW.ink)
sign.outline(SW.edge)

// ---------------------------------------------------------------- right: campfire, guitars, amp, books
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
const flames = [1, 2, 3].map(n => `<g class="fl${n}">${flame(n * 77).svg()}</g>`).join('')

const gear = new Sprite()
// V guitar, purple
gear.line(421, 158, 419, 210, '#3a2410', 2)
for (let y = 168; y < 206; y += 6) gear.set(420, y, '#e8d8b0')
gear.poly([[417, 150], [425, 150], [424, 160], [418, 160]], '#4a2490')
gear.line(419, 210, 404, 246, '#6a3ac8', 7); gear.line(420, 210, 437, 244, '#6a3ac8', 7)
gear.ell(419.5, 212, 5, 4, '#6a3ac8')
gear.line(416, 212, 402, 244, '#9a6ae8'); gear.line(423, 214, 438, 242, '#4a2490')
gear.rect(415, 214, 9, 2, '#1a1a1a'); gear.rect(415, 219, 9, 2, '#1a1a1a')
gear.outline('#1e0e3a')
// blue guitar
gear.line(446, 156, 442, 210, '#5a3a1a', 2)
gear.poly([[444, 150], [450, 150], [449, 160], [445, 160]], '#d8d0c0')
gear.ell(441, 226, 11, 15, null, (x, y, dx, dy) => gear.set(x, y, dx * -0.5 - dy * 0.5 > 0.35 ? '#5a8ae8' : dx > 0.45 ? '#1e3a98' : '#2f58c8'))
gear.ell(434, 212, 3.5, 5, '#2f58c8'); gear.ell(449, 213, 3, 4, '#2f58c8')
gear.poly([[436, 220], [446, 218], [448, 234], [438, 236]], '#eeeae0')
gear.rect(438, 222, 7, 1, '#1a1a1a'); gear.rect(438, 227, 7, 1, '#1a1a1a'); gear.rect(439, 232, 7, 1, '#1a1a1a')
gear.outline('#0e1a4a')
// amp with a music note
gear.rect(452, 222, 28, 26, '#262428'); gear.rect(452, 222, 28, 3, '#3e3a40'); gear.rect(455, 227, 22, 18, '#141216')
for (let y = 228; y < 244; y += 2) gear.rect(456, y, 20, 1, '#1e1c22')
gear.grid(['...####', '...#..#', '...#..#', '.###.##', '####.##', '.##....'], 460, 230, { '#': '#5ad0ff' })
gear.rect(456, 223, 2, 1, '#f2c230'); gear.rect(460, 223, 2, 1, '#f2c230')
gear.outline('#0a080c')
// books
const BOOKS = [['QUESTS', '#22307a', 398, 238], ['XP & POTIONS', '#22663a', 392, 246], ['CODE MAGIC', '#2a4aa8', 396, 254]]
for (const [title, color, x, y] of BOOKS) {
  const w = textWidth(title) + 14
  gear.rect(x, y, w, 7, color); gear.rect(x, y + 6, w, 1, "#10101a"); gear.rect(x + w - 3, y + 1, 2, 5, '#efe6c8'); gear.rect(x, y, w, 1, '#ffffff22'.slice(0, 7))
  gear.rect(x + 2, y + 1, 1, 5, '#f2c230')
  text(gear, title, x + 5, y + 1, '#f2c230')
}
gear.outline('#140c1e', c => c !== '#f2c230' || true)

// ---------------------------------------------------------------- right: cliff with castle and falls
const cliff = new Sprite()
const RK = ['#5a4836', '#7c6448', '#9c8260', '#bca27c']
cliff.poly([[392, 44], [420, 36], [480, 32], [480, 204], [440, 200], [408, 196], [392, 176], [386, 140], [394, 104], [386, 76]], RK[1])
// ledges every 16px (lit top, shadowed foot) and sparse vertical cracks: few runs, lots of read
cliff.recolor((x, y) => {
  const r = (y - 36 + (x > 440 ? 5 : 0)) % 16
  return r === 0 ? RK[3] : r === 1 ? RK[2] : r === 15 ? RK[0] : null
})
cliff.recolor((x, y) => (cliff.has(x - 1, y) ? null : RK[3]))
for (let i = 0; i < 20; i++) {
  const x = Math.round(390 + rnd() * 90), y = Math.round(46 + rnd() * 150)
  if (!cliff.has(x, y)) continue
  const len = 3 + Math.floor(rnd() * 6)
  for (let j = 0; j < len; j++) if (cliff.has(x, y + j)) { cliff.set(x, y + j, RK[0]); if (cliff.has(x + 1, y + j)) cliff.set(x + 1, y + j, RK[2]) }
}
for (let i = 0; i < 12; i++) {
  const x = 388 + rnd() * 92, y = 44 + rnd() * 150
  if (!cliff.has(Math.round(x), Math.round(y))) continue
  const r = 3 + rnd() * 5
  for (const [ox, oy, k] of [[0, 0, 1], [-r * 0.9, r * 0.3, 0.7], [r * 0.9, r * 0.35, 0.65]]) cliff.ell(x + ox, y + oy, r * 1.1 * k, r * 0.85 * k, null, (px, py, dx, dy) => cliff.set(px, py, dy < -0.35 && dx < 0.35 ? LEAF[3] : dy > 0.45 || dx > 0.6 ? LEAF[1] : LEAF[2]))
}
for (let x = 392; x < 480; x++) { cliff.set(x, 37 + Math.round(Math.sin(x / 5) * 1.5), LEAF[2]); cliff.set(x, 38 + Math.round(Math.sin(x / 5) * 1.5), LEAF[1]) }
// castle on the cliff
const SS = ['#a88848', '#d8b878', '#f0d8a0', '#7a5e2e']
const RR = ['#8a2a1a', '#c84a2a', '#e8704a']
for (const [x, y, w, h] of [[406, 14, 12, 26], [452, 8, 14, 32], [420, 20, 34, 20], [430, 2, 12, 22]]) {
  cliff.rect(x, y, w, h, SS[1]); cliff.rect(x + w - 3, y, 3, h, SS[0]); cliff.rect(x, y, 2, h, SS[2])
  for (let bx = x; bx < x + w; bx += 4) cliff.rect(bx, y - 2, 2, 2, SS[1])
}
for (const [x, w, top] of [[406, 12, 0], [452, 14, -8], [430, 12, -14]]) {
  const y = top + 14 + (x === 452 ? -6 : x === 430 ? 2 - 14 + 14 : 0)
  cliff.poly([[x - 2, y], [x + w + 2, y], [x + w / 2, y - 14]], RR[1])
  cliff.poly([[x + w / 2, y], [x + w + 2, y], [x + w / 2, y - 14]], RR[0])
  cliff.line(x + w / 2, y - 14, x + w / 2, y - 19, '#4a3a2a'); cliff.rect(x + w / 2 + 1, y - 19, 4, 2, '#8a4ad0')
}
cliff.rect(433, 24, 8, 10, '#6a2a9a'); cliff.rect(436, 27, 2, 3, '#f2c230'); cliff.rect(435, 34, 1, 1, '#6a2a9a'); cliff.rect(440, 34, 1, 1, '#6a2a9a')
cliff.ell(437, 39, 4, 3, '#2a1e18'); cliff.rect(433, 38, 8, 3, '#2a1e18')
for (const [x, y] of [[410, 22], [410, 30], [457, 18], [461, 28], [424, 28], [447, 28], [435, 8]]) cliff.rect(x, y, 2, 3, '.win')
cliff.outline('#2a1e14')
const falls = [[420, 60, 196], [446, 84, 200], [468, 52, 196], [404, 120, 194]].map(([x, y0, y1], i) =>
  `<rect class="wf" x="${x}" y="${y0}" width="${i === 1 ? 6 : 4}" height="${y1 - y0}"/><rect class="wfs" x="${x + (i === 1 ? 4 : 3)}" y="${y0}" width="1" height="${y1 - y0}"/>`
  + `<line class="fall" x1="${x + 1.5}" x2="${x + 1.5}" y1="${y0}" y2="${y1}" stroke="#ffffff" stroke-opacity=".85" stroke-dasharray="4 6"/>`
  + `<rect class="w1" x="${x - 3}" y="${y1 - 2}" width="${(i === 1 ? 6 : 4) + 6}" height="2" opacity=".8"/>`).join('')

// ---------------------------------------------------------------- the floating castle
const fc = new Sprite()
const FS = ['#b8a078', '#e8d8b0', '#fff0d0', '#8a7454']
const FR = ['#a8401e', '#e0703a', '#ff9a5a']
// island
fc.poly([[0, 60], [72, 60], [64, 70], [54, 78], [46, 96], [40, 112], [34, 92], [24, 80], [8, 70]], '#7a6a58')
fc.recolor((x, y, c) => (c !== '#7a6a58' ? null : x > 44 ? '#5a4a3a' : x < 16 ? '#9a8a70' : null))
for (let x = 0; x <= 72; x++) { fc.set(x, 59, LEAF[2]); fc.set(x, 60, LEAF[1]); if (x % 7 === 2) { const l = 2 + (x * 7) % 9; fc.line(x, 61, x, 61 + l, LEAF[x % 2 ? 1 : 2]) } }
// towers and keep
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
const fcFalls = [[18, 66, 118], [38, 92, 148], [56, 68, 112]].map(([x, y0, y1]) =>
  `<rect class="wf" x="${x}" y="${y0}" width="3" height="${(y1 - y0) * 0.6}"/><rect class="wf" x="${x}" y="${y0 + (y1 - y0) * 0.6}" width="3" height="${(y1 - y0) * 0.4}" opacity=".45"/>`
  + `<line class="fall" x1="${x + 1.5}" x2="${x + 1.5}" y1="${y0}" y2="${y1}" stroke="#ffffff" stroke-opacity=".8" stroke-dasharray="3 5"/>`).join('')
const rock = (w, h) => { const r = new Sprite(); r.poly([[0, 0], [w, 0], [w / 2, h]], '#7a6a58'); r.rect(0, -1, w + 1, 1, LEAF[2]); r.outline('#2e2030'); return r.svg() }

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
@keyframes sail{from{transform:translateX(0)}to{transform:translateX(60px)}}
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
@media (max-aspect-ratio: 1/1){.mid{transform:translateX(40px)}}
`).replace(/\n/g, '')

const glow = (cx, cy, r, color, cls = 'pulse') =>
  `<g class="gw"><g class="${cls}">${[1, 0.82, 0.64, 0.48, 0.32].map(k => `<circle cx="${cx}" cy="${cy}" r="${Math.round(r * k)}" fill="${color}" opacity=".08"/>`).join("")}</g></g>`

const scene = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges"><style>${style}</style>`
  + sky + `<g class="n">${stars}</g>` + sunBloom + moonGroup
  + sea + far.svg() + `<g transform="translate(258 141)"><g class="sail">${ship.svg()}</g></g>`
  // floating castle and its rocks
  + `<g transform="translate(296 18)"><g class="bob2">${fcFalls}${fc.svg()}</g></g>`
  + `<g transform="translate(284 64)"><g class="bob3">${rock(8, 7)}</g></g><g transform="translate(378 50)"><g class="bob">${rock(10, 8)}</g></g>`
  // right cliff
  + `<g transform="translate(0 18)">${falls}${cliff.svg()}</g>`
  // land
  + land.svg() + sand.svg() + ledge.svg()
  // left: palm, signs, crystal
  + palm.svg() + signs.svg()
  + `<g transform="translate(112 84)"><g class="bob3">${crystal.svg()}${particles}</g></g>`
  + pc.svg() + cursor + toys.svg()
  // right props
  + fireRing.svg() + flames + gear.svg() + sign.svg()
  + `<g transform="translate(300 204)">${shroom.svg()}</g>`
  // the heroes
  + `<g class="mid"><g transform="translate(150 196)"><g class="sfA">${scarfA.svg()}</g><g class="sfB">${scarfB.svg()}</g>${hero.svg()}${sword.svg()}</g>`
  + `<ellipse cx="216" cy="226" rx="12" ry="2" fill="#000" opacity=".2"/><g transform="translate(203 205)"><g class="hop">${slime.svg()}</g></g></g>`
  // night: dim the world, then let the lights glow through
  + `<rect class="nv" x="0" y="0" width="${W}" height="${H}" fill="#0a1040" opacity=".3"/>`
  + glow(112, 84, 34, '#5aa8ff') + glow(378, 238, 26, '#ff9a40', 'pulse2') + glow(31, 200, 26, '#6aff8a')
  + glow(93, 244, 14, '#ffd860') + glow(466, 236, 12, '#5ad0ff') + glow(185, 182, 16, '#7ad0ff')
  + `</svg>`

console.log('scene chars:', scene.length)
if (scene.length > 131072) throw new Error('too big: ' + scene.length)
writeFileSync(process.argv[2], `// Generated by art/gen.mjs: the Hero's Shore backdrop, all pixel art drawn as SVG paths.\nexport const SCENE = ${JSON.stringify(scene)}\n`)
if (process.argv[3]) writeFileSync(process.argv[3], `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000}div{position:fixed;inset:0}div svg{width:100%;height:100%;display:block}</style><div>${scene}</div>`)
