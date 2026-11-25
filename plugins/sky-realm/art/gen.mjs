// Generates the Sky Realm pixel-art backdrop SVG.
// usage, from the plugin folder: node art/gen.mjs hooks/scene.ts [preview.html]
import { writeFileSync } from 'node:fs'

const K = '#1b1530'
let seed = 1337
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

class S {
  constructor() { this.p = new Map() }
  k(x, y) { return x + ',' + y }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); this.p.set(this.k(x, y), c) }
  del(x, y) { this.p.delete(this.k(x, y)) }
  get(x, y) { return this.p.get(this.k(x, y)) }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c) }
  ell(cx, cy, rx, ry, c, fn) {
    for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry
        if (dx * dx + dy * dy <= 1) (fn ? fn(x, y) : this.set(x, y, c))
      }
  }
  tri(ax, ay, bx, by, cx, cy, c) {
    const s = (px, py, x1, y1, x2, y2) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2)
    for (let y = Math.floor(Math.min(ay, by, cy)); y <= Math.ceil(Math.max(ay, by, cy)); y++)
      for (let x = Math.floor(Math.min(ax, bx, cx)); x <= Math.ceil(Math.max(ax, bx, cx)); x++) {
        const px = x + 0.5, py = y + 0.5
        const d1 = s(px, py, ax, ay, bx, by), d2 = s(px, py, bx, by, cx, cy), d3 = s(px, py, cx, cy, ax, ay)
        const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0
        if (!(neg && pos)) this.set(x, y, c)
      }
  }
  line(x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let e = dx + dy
    for (;;) {
      this.set(x0, y0, c)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * e
      if (e2 >= dy) { e += dy; x0 += sx }
      if (e2 <= dx) { e += dx; y0 += sy }
    }
  }
  each(fn) { for (const [key, c] of [...this.p]) { const [x, y] = key.split(',').map(Number); fn(x, y, c) } }
  recolor(fn) { this.each((x, y, c) => { const n = fn(x, y, c); if (n) this.set(x, y, n) }) }
  grid(rows, x0, y0, map) {
    rows.forEach((r, j) => [...r].forEach((ch, i) => {
      if (ch === '.') return
      const c = map[ch]
      if (c === undefined) throw new Error('unknown pixel ' + ch)
      this.set(x0 + i, y0 + j, c)
    }))
  }
  outline(c = K) {
    const add = []
    for (const key of this.p.keys()) {
      const [x, y] = key.split(',').map(Number)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (!this.p.has(this.k(x + dx, y + dy))) add.push([x + dx, y + dy])
    }
    add.forEach(([x, y]) => this.set(x, y, c))
  }
  svg() {
    const by = new Map()
    this.each((x, y, c) => { if (!by.has(c)) by.set(c, []); by.get(c).push([x, y]) })
    let out = ''
    for (const [c, pts] of by) {
      pts.sort((a, b) => a[1] - b[1] || a[0] - b[0])
      let d = '', i = 0
      while (i < pts.length) {
        const [x, y] = pts[i]; let w = 1
        while (i + w < pts.length && pts[i + w][1] === y && pts[i + w][0] === x + w) w++
        d += `M${x} ${y}h${w}v1h-${w}z`
        i += w
      }
      const paint = c.startsWith('.') ? `class="${c.slice(1)}"` : `fill="${c}"`
      out += `<path ${paint} d="${d}"/>`
    }
    return out
  }
}

// ---------- sky ----------
const W = 480, H = 270
function sky(colors, cls) {
  const n = colors.length, band = Math.ceil(H / n)
  let s = `<g class="${cls}">`
  colors.forEach((c, i) => { s += `<rect x="0" y="${i * band}" width="${W}" height="${band + 1}" fill="${c}"/>` })
  // checkerboard dither between bands, the 16-bit way
  for (let i = 1; i < n; i++) {
    const y = i * band
    s += `<line x1="0" x2="${W}" y1="${y - 1.5}" y2="${y - 1.5}" stroke="${colors[i]}" stroke-dasharray="1 1"/>`
    s += `<line x1="0" x2="${W}" y1="${y - 0.5}" y2="${y - 0.5}" stroke="${colors[i]}" stroke-dasharray="1 1" stroke-dashoffset="1"/>`
    s += `<line x1="0" x2="${W}" y1="${y + 0.5}" y2="${y + 0.5}" stroke="${colors[i - 1]}" stroke-dasharray="1 3" stroke-dashoffset="2"/>`
    s += `<line x1="0" x2="${W}" y1="${y - 2.5}" y2="${y - 2.5}" stroke="${colors[i]}" stroke-dasharray="1 3"/>`
  }
  return s + '</g>'
}
const DAY = ['#3a78d8', '#4686df', '#5395e6', '#62a4ec', '#74b3f1', '#89c2f5', '#a1d0f8', '#bddffb', '#d6ecfd']
const NIGHT = ['#060821', '#0a0e2e', '#10143c', '#171a4a', '#1f2056', '#2a2662', '#382c6c', '#4b3576', '#62407e']

// ---------- sun & moon ----------
const sun = new S()
sun.ell(16, 16, 16, 16, '#fff7d0')
sun.ell(16, 16, 13, 13, '#ffe066')
sun.ell(15, 15, 10, 10, '#fff1a0')
sun.ell(12, 12, 4, 4, '#fffbe6')
const moon = new S()
moon.ell(16, 16, 16, 16, '#2c2c66')
moon.ell(16, 16, 12, 12, '#efe9cf')
for (const [x, y, r] of [[11, 13, 3], [19, 20, 2.5], [20, 11, 1.6], [13, 21, 1.4]]) moon.ell(x, y, r, r, '#cfc7a4')
moon.ell(11, 10, 2, 2, '#fbf8ea')

// ---------- stars ----------
let stars = ''
for (let i = 0; i < 90; i++) {
  const x = Math.floor(rnd() * W), y = Math.floor(rnd() * 190), t = 't' + (1 + (i % 3))
  if (i % 9 === 0) stars += `<path class="${t}" fill="#fff6d8" d="M${x} ${y - 1}h1v3h-1zM${x - 1} ${y}h3v1h-3z"/>`
  else stars += `<rect class="${t}" x="${x}" y="${y}" width="1" height="1" fill="${i % 4 ? '#e8e8ff' : '#ffe9a8'}"/>`
}

// ---------- clouds ----------
function cloud(w, h) {
  const c = new S()
  const puffs = Math.max(2, Math.round(w / 12))
  for (let i = 0; i < puffs; i++) {
    const cx = (w / (puffs + 1)) * (i + 1), r = h * (0.55 + rnd() * 0.45)
    c.ell(cx, h - r * 0.7, r * 1.1, r, '.cl')
  }
  c.ell(w / 2, h - 2, w / 2, 3.5, '.cl')
  let maxY = -1e9; c.each((x, y) => { maxY = Math.max(maxY, y) })
  c.recolor((x, y) => (y >= maxY - 1 ? '.cs' : null))
  c.each((x, y) => { if (y > maxY) c.del(x, y) })
  return c
}
function cloudLayer(n, yMin, yMax, wMin, wMax, cls) {
  let s = ''
  for (let i = 0; i < n; i++) {
    const w = Math.round(wMin + rnd() * (wMax - wMin)), h = Math.round(w * 0.28)
    const x = Math.round((W / n) * i + rnd() * 30), y = Math.round(yMin + rnd() * (yMax - yMin))
    const body = cloud(w, h).svg()
    s += `<g transform="translate(${x} ${y})">${body}</g><g transform="translate(${x + W} ${y})">${body}</g>`
  }
  return `<g class="${cls}">${s}</g>`
}
const sea = new S()
for (let x = -16; x < W + 16; x += 14 + Math.floor(rnd() * 10)) {
  const r = 10 + rnd() * 12
  sea.ell(x, 26 - r * 0.4, r * 1.2, r, '.cl')
}
sea.rect(-16, 22, W + 32, 30, '.cl')
sea.recolor((x, y, c) => (c === '.cl' && !sea.get(x, y - 1) ? '.ch' : null))

// ---------- floating castle ----------
const ST = '#dcd6ec', STD = '#a9a2c8', STM = '#bdb6d6', RF = '#3b62d6', RFD = '#27409a', RFL = '#6a8cf0'
const RK = '#8f5d3b', RKD = '#5f3c27', RKL = '#b67f52', G = '#4cbf4a', GD = '#2d8a3c', GL = '#8be06a'
const castle = new S()
// rock
castle.tri(2, 107, 108, 107, 60, 162, RK)
castle.tri(10, 107, 48, 107, 26, 140, RK)
castle.tri(70, 107, 104, 107, 90, 136, RK)
castle.recolor((x, y, c) => {
  if (c !== RK) return null
  if ((x * 3 + y * 7) % 29 === 0 || (x * 5 + y * 2) % 37 === 0) return RKD
  const t = (x - 2) / 106
  if (t > 0.62 + (y % 5) * 0.01) return RKD
  if (t < 0.2) return RKL
  return null
})
for (let i = 0; i < 9; i++) { const x = 20 + Math.floor(rnd() * 70); castle.line(x, 110, x + (rnd() < .5 ? -1 : 1), 110 + 3 + Math.floor(rnd() * 6), GD) }
// grass
castle.ell(55, 106, 55, 4.5, G)
castle.recolor((x, y, c) => (c === G && castle.get(x, y + 1) !== G ? GD : c === G && castle.get(x, y - 1) === undefined ? GL : null))
// towers & keep
castle.rect(18, 56, 15, 49, ST); castle.rect(78, 56, 15, 49, ST)
castle.rect(30, 72, 51, 33, ST)
castle.rect(47, 38, 17, 34, ST)
for (let x = 30; x <= 78; x += 6) castle.rect(x, 68, 3, 4, ST)
castle.recolor((x, y, c) => {
  if (c !== ST) return null
  if ((x >= 29 && x <= 32 && y > 56) || (x >= 89 && x <= 92) || (x >= 60 && x <= 63 && y < 72) || (x >= 76 && x <= 80 && y > 72)) return STD
  if (y % 6 === 0 && (x + Math.floor(y / 6) * 4) % 8 < 3) return STM
  return null
})
// roofs
castle.tri(14, 57, 37, 57, 25, 32, RF); castle.tri(74, 57, 97, 57, 85, 32, RF); castle.tri(43, 39, 68, 39, 55, 10, RF)
castle.recolor((x, y, c) => {
  if (c !== RF) return null
  const cx = x < 40 ? 25 : x > 70 ? 85 : 55
  if (x > cx) return RFD
  if (x === cx - 2 || x === cx - 3) return RFL
  return null
})
// flags
castle.line(55, 2, 55, 10, '#5a4a6a'); castle.rect(56, 2, 6, 3, '#e0403a'); castle.set(62, 3, '#e0403a'); castle.set(56, 4, '#a82a2a')
for (const fx of [25, 85]) { castle.line(fx, 26, fx, 32, '#5a4a6a'); castle.rect(fx + 1, 26, 4, 2, '#ffd23f') }
// windows, gate, banners
for (const [x, y, w, h] of [[24, 64, 3, 4], [24, 80, 3, 4], [84, 64, 3, 4], [84, 80, 3, 4], [54, 46, 3, 5], [54, 58, 3, 5], [37, 80, 2, 3], [72, 80, 2, 3]]) castle.rect(x, y, w, h, '.win')
castle.rect(49, 90, 13, 15, '#2a2240'); castle.ell(55.5, 91, 6.5, 4, '#2a2240')
castle.line(52, 88, 52, 104, '#4a3a5a'); castle.line(59, 88, 59, 104, '#4a3a5a')
for (const bx of [40, 67]) { castle.rect(bx, 75, 4, 8, '#c8323c'); castle.set(bx + 1, 78, '#ffd23f'); castle.set(bx + 2, 78, '#ffd23f'); castle.set(bx, 83, '#c8323c'); castle.set(bx + 3, 83, '#c8323c') }
castle.outline()

const debris = new S()
debris.tri(0, 0, 9, 0, 4, 8, RK); debris.rect(0, -1, 10, 1, G)
const debris2 = new S()
debris2.tri(0, 0, 6, 0, 3, 5, RKD); debris2.rect(0, -1, 7, 1, GD)
debris.outline(); debris2.outline()

const waterfall = `<g><rect class="wf" x="8" y="108" width="6" height="34"/><rect class="wf" x="8" y="142" width="6" height="22" opacity=".65"/><rect class="wf" x="8" y="164" width="6" height="16" opacity=".3"/>`
  + `<line class="fall" x1="9.5" y1="108" x2="9.5" y2="180" stroke="#ffffff" stroke-opacity=".8" stroke-dasharray="5 7"/>`
  + `<line class="fall" x1="12.5" y1="110" x2="12.5" y2="176" stroke="#ffffff" stroke-opacity=".6" stroke-dasharray="3 9"/></g>`

// ---------- airship ----------
const EN = '#e2533f', END = '#a8302a', ENL = '#ff8f6b', WD = '#a0663a', WDD = '#6e4224', GO = '#f2c230'
const ship = new S()
ship.tri(3, 3, 16, 12, 3, 21, EN)
ship.ell(38, 12, 29, 10, EN)
ship.recolor((x, y, c) => {
  if (c !== EN) return null
  if (x === 24 || x === 38 || x === 52) return GO
  if (y >= 18) return END
  const dx = (x - 30) / 16, dy = (y - 7) / 4
  if (dx * dx + dy * dy < 1) return ENL
  return null
})
ship.line(20, 21, 22, 27, '#4a3020'); ship.line(38, 22, 38, 27, '#4a3020'); ship.line(56, 21, 54, 27, '#4a3020')
for (let y = 28; y <= 37; y++) {
  const x0 = 9 + Math.floor((y - 28) * 0.8), x1 = 64 - Math.floor((y - 28) * 1.3)
  for (let x = x0; x <= x1; x++) ship.set(x, y, y === 28 ? GO : y === 37 ? '#5a341c' : y % 3 === 0 ? WDD : WD)
}
ship.line(64, 29, 72, 24, '#6e4224'); ship.rect(62, 30, 2, 2, GO)
ship.line(12, 20, 12, 27, '#4a3020'); ship.rect(13, 20, 4, 2, GO); ship.set(17, 21, GO)
for (const px of [20, 28, 36, 44]) ship.rect(px, 31, 2, 2, '.win')
ship.rect(3, 29, 4, 1, '#c8c2dc'); ship.line(5, 26, 5, 34, '#8a84a6'); ship.rect(7, 30, 2, 2, '#6e4224')
ship.outline()
ship.set(72, 24, '.lamp'); ship.set(73, 24, '.lamp'); ship.set(72, 23, '.lamp')
// a tiny pink slime riding on deck
ship.grid([
  '...KKK...',
  '.KKPPPKK.',
  'KPWPPPPPK',
  'KPPKPKPPK',
  'KPPPPPPPK',
  '.KKKKKKK.',
], 41, 22, { K, P: '#ff8fc0', W: '#ffffff' })

// ---------- hero isle ----------
const isle = new S()
isle.tri(0, 63, 74, 63, 38, 100, RK)
isle.tri(46, 63, 70, 63, 60, 84, RK)
isle.recolor((x, y, c) => {
  if (c !== RK) return null
  if ((x * 3 + y * 7) % 23 === 0) return RKD
  const t = x / 74
  return t > 0.6 ? RKD : t < 0.2 ? RKL : null
})
isle.ell(37, 63, 38, 3.5, G)
isle.recolor((x, y, c) => (c === G && isle.get(x, y + 1) !== G ? GD : c === G && isle.get(x, y - 1) === undefined ? GL : null))
for (const gx of [4, 9, 31, 62, 68]) { isle.set(gx, 59, GL); isle.set(gx + 1, 58, G) }
isle.outline()

// hero with an absurdly large sword
const hero = new S()
const DX = 16
// blade, held straight overhead (SX = the grip's left column)
const SX = 17
for (let y = 1; y <= 35; y++) {
  hero.set(SX - 2, y, '#ffffff'); hero.set(SX - 1, y, '#e4ecf6'); hero.set(SX, y, '#b8c6da')
  hero.set(SX + 1, y, '#b8c6da'); hero.set(SX + 2, y, '#d0dbe9'); hero.set(SX + 3, y, '#8a9bb5')
}
hero.rect(SX - 1, -1, 4, 2, '#e4ecf6'); hero.rect(SX, -3, 2, 2, '#ffffff')
hero.rect(SX - 6, 36, 14, 2, GO); hero.rect(SX - 6, 37, 14, 1, '#c8901e'); hero.rect(SX, 36, 2, 2, '#e0303a')
hero.set(SX - 7, 35, GO); hero.set(SX + 8, 35, GO)
hero.rect(SX, 38, 2, 7, '#6a4426'); hero.rect(SX - 1, 45, 4, 2, GO)
hero.grid([
  '..h.hh.h....',
  '.hhhhhhhh...',
  'hhhhhhhhhh..',
  'hHhhhhhhhhh.',
  'hhhsssssshh.',
  'hhsEsssEsh..',
  'Hhssssssss..',
  '.hssssmss...',
  '..ssssss....',
  '.rraggaa....',
  'rrraaaaaaa..',
  'rrAaaggaaaa.',
  'rRAaaaaaaaa.',
  'rRAaaaaaas..',
  'rRrAbbybbb..',
  'rRrAaaaaaa..',
  'RRrAaa.aaa..',
  'RRRaaa.aaa..',
  '.RRAaa.aAa..',
  '..BBB..BBB..',
  '..BBB..BBB..',
  '.BBBB..BBBB.',
], DX - 12, 40, {
  h: '#ffd23f', H: '#d99a1e', s: '#f8cfa6', E: K, m: '#c0706a', r: '#d8323c', R: '#8e1c2a',
  a: '#3d72e0', A: '#24479a', g: '#ffd23f', b: '#6a4426', y: '#ffd23f', B: '#5a3a22',
})
// raised arm gripping the hilt
for (const [x, y] of [[14, 50], [15, 50], [14, 49], [15, 49], [15, 48], [16, 48], [15, 47], [16, 47], [15, 46], [15, 45]]) hero.set(x, y, '#3d72e0')
hero.set(16, 49, '#24479a'); hero.set(16, 46, '#24479a')
hero.rect(SX - 1, 41, 4, 4, '#f8cfa6'); hero.rect(SX, 42, 3, 1, '#d9a984')
hero.outline()

const glint = `<path class="gl" fill="#ffffff" d="M${SX} -8h2v10h-2zM${SX - 4} -4h10v2h-10z"/>`

// the slime
const slime = new S()
slime.grid([
  '......KKKK......',
  '....KKbbbbKK....',
  '...KbWWbbbbbK...',
  '..KbWWbbbbbbbK..',
  '..KbWbbbbbbbbK..',
  '.KbbbbbbbbbbbbK.',
  '.KbbbKbbbbKbbbK.',
  '.KbbbKbbbbKbbbK.',
  'KbbppbbbbbbppbbK',
  'KbbbbbbKKbbbbbbK',
  'KdbbbbbbbbbbbbdK',
  '.KddddddddddddK.',
  '..KKKKKKKKKKKK..',
], 0, 0, { K, b: '#4fb8ff', d: '#2a7fd4', W: '#ffffff', p: '#ff8fb0' })

// ---------- assemble ----------
const style = `
.n{display:none}
.win{fill:#4a4470}.lamp{fill:#7a6a50}.wf{fill:#bfe6ff}
.cl{fill:#ffffff}.cs{fill:#c6dcf4}.ch{fill:#ffffff}
@media (prefers-color-scheme: dark){
.d{display:none}.n{display:inline}
.win{fill:#ffd860}.lamp{fill:#ffe9a0}.wf{fill:#6f8fd8}
.cl{fill:#3d3c7a}.cs{fill:#2c2b62}.ch{fill:#5654a0}
}
@keyframes drift{from{transform:translateX(0)}to{transform:translateX(-480px)}}
.dA{animation:drift 900s linear infinite}.dB{animation:drift 420s linear infinite}
@keyframes fly{from{transform:translateX(-260px)}to{transform:translateX(420px)}}
.fly{animation:fly 150s linear infinite}
@keyframes bob{0%{transform:translateY(0)}25%{transform:translateY(-1px)}50%{transform:translateY(-2px)}75%{transform:translateY(-1px)}}
.bob{animation:bob 6s steps(1,end) infinite}.bob2{animation:bob 9s steps(1,end) infinite}.bob3{animation:bob 4s steps(1,end) infinite}
@keyframes hop{0%{transform:translateY(0) scale(1,1)}60%{transform:translateY(0) scale(1.12,.85)}70%{transform:translateY(-6px) scale(.9,1.1)}80%{transform:translateY(-3px) scale(1,1)}90%{transform:translateY(0) scale(1.1,.9)}100%{transform:translateY(0) scale(1,1)}}
.hop{transform-box:fill-box;transform-origin:50% 100%;animation:hop 3s steps(1,end) infinite}
@keyframes tw{0%,100%{opacity:1}50%{opacity:.2}}
.t1{animation:tw 6s ease-in-out infinite}.t2{animation:tw 8s ease-in-out 2s infinite}.t3{animation:tw 11s ease-in-out 4s infinite}
@keyframes fall{to{stroke-dashoffset:-24}}
.fall{animation:fall 2.4s linear infinite}
@keyframes glint{0%,90%,100%{opacity:0}94%{opacity:1}}
.gl{opacity:0;animation:glint 8s linear infinite}
@media (max-aspect-ratio: 1/1){
.pc{transform:translate(188px,6px) scale(.75)}
.ph{transform:translate(160px,156px) scale(.75)}
.ps{transform:translate(154px,10px) scale(.8)}
}
`.replace(/\n/g, '')

const scene = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges"><style>${style}</style>`
  + sky(DAY, 'd') + sky(NIGHT, 'n')
  + `<g class="n">${stars}</g>`
  + `<g class="ps" transform="translate(64 14)"><g class="d">${sun.svg()}</g><g class="n">${moon.svg()}</g></g>`
  + cloudLayer(6, 10, 120, 30, 60, 'dA')
  + cloudLayer(5, 140, 205, 50, 90, 'dB')
  + `<g class="pc" transform="translate(345 16)"><g class="bob2">${waterfall}${castle.svg()}</g>`
  + `<g transform="translate(-14 150)"><g class="bob3">${debris.svg()}</g></g><g transform="translate(112 128)"><g class="bob">${debris2.svg()}</g></g></g>`
  + `<g transform="translate(150 38)"><g class="fly"><g class="bob">${ship.svg()}</g></g></g>`
  + `<g class="ph" transform="translate(28 112)"><g class="bob">${isle.svg()}${hero.svg()}${glint}<g transform="translate(36 49)"><g class="hop">${slime.svg()}</g></g></g></g>`
  + `<g transform="translate(0 228)">${sea.svg()}</g>`
  + `</svg>`

console.log('scene chars:', scene.length)
if (scene.length > 131072) throw new Error('too big')
writeFileSync(process.argv[2], `// Generated by art/gen.mjs: the Sky Realm backdrop, all pixel art drawn as SVG paths.\nexport const SCENE = ${JSON.stringify(scene)}\n`)
if (process.argv[3]) writeFileSync(process.argv[3], `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000}div{position:fixed;inset:0}div svg{width:100%;height:100%;display:block}</style><div>${scene}</div>`)
