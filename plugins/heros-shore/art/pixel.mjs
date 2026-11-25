// Shared pixel-art helpers for the theme scene generators.
// A sprite is a sparse grid of colored pixels, compiled to one <path> per color.

export const makeRandom = (start) => {
  let seed = start
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Sprite {
  constructor() { this.p = new Map(); this.fresh = new Set() }
  k(x, y) { return x + ',' + y }
  set(x, y, c) { const key = this.k(Math.round(x), Math.round(y)); this.p.set(key, c); this.fresh.add(key) }
  del(x, y) { this.p.delete(this.k(x, y)) }
  get(x, y) { return this.p.get(this.k(x, y)) }
  has(x, y) { return this.p.has(this.k(x, y)) }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c) }
  ell(cx, cy, rx, ry, c, fn) {
    for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry
        if (dx * dx + dy * dy <= 1) (fn ? fn(x, y, dx, dy) : this.set(x, y, c))
      }
  }
  poly(pts, c) {
    let minY = Infinity, maxY = -Infinity
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const py = y + 0.5, xs = []
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]
        if ((y1 <= py && y2 > py) || (y2 <= py && y1 > py)) xs.push(x1 + ((py - y1) / (y2 - y1)) * (x2 - x1))
      }
      xs.sort((a, b) => a - b)
      for (let i = 0; i + 1 < xs.length; i += 2)
        for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) this.set(x, y, c)
    }
  }
  line(x0, y0, x1, y1, c, w = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let e = dx + dy
    for (;;) {
      if (w === 1) this.set(x0, y0, c); else this.rect(x0 - Math.floor(w / 2), y0 - Math.floor(w / 2), w, w, c)
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
      if (ch === '.' || ch === ' ') return
      const c = map[ch]
      if (c === undefined) throw new Error('unknown pixel ' + ch)
      this.set(x0 + i, y0 + j, c)
    }))
  }
  // outlines what was drawn since the last outline, so each object gets one ring
  outline(c, only) {
    const add = []
    for (const key of this.fresh) {
      const col = this.p.get(key)
      if (col === undefined) continue
      if (only && !only(col)) continue
      const [x, y] = key.split(',').map(Number)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (!this.p.has(this.k(x + dx, y + dy))) add.push([x + dx, y + dy])
    }
    add.forEach(([x, y]) => this.set(x, y, c))
    this.fresh = new Set()
  }
  merge(other, ox = 0, oy = 0) { other.each((x, y, c) => this.set(x + ox, y + oy, c)) }
  // Painter's order: colors with the most pixels go first, and a run of one color may pass
  // under pixels of any color drawn after it. Texture then costs only its own pixels.
  svg(attrs = '') {
    const by = new Map()
    this.each((x, y, c) => { if (!by.has(c)) by.set(c, []); by.get(c).push([x, y]) })
    const order = [...by.keys()].sort((a, b) => by.get(b).length - by.get(a).length)
    const rank = new Map(order.map((c, i) => [c, i]))
    let out = ''
    for (const c of order) {
      const pts = by.get(c).sort((a, b) => a[1] - b[1] || a[0] - b[0])
      const mine = rank.get(c)
      const covered = (x, y) => { const o = this.get(x, y); return o !== undefined && rank.get(o) >= mine }
      // each run is a 1px stroke through the row's middle; relative moves keep it short
      let d = '', i = 0, px = 0, py = 0
      while (i < pts.length) {
        const [x, y] = pts[i]
        let end = x + 1, j = i + 1, scan = x + 1
        while (covered(scan, y)) {
          if (this.get(scan, y) === c) { end = scan + 1; while (j < pts.length && pts[j][1] === y && pts[j][0] <= scan) j++ }
          scan++
        }
        const w = end - x
        d += d === '' ? `M${x} ${y + 0.5}h${w}` : `m${x - px} ${y - py}h${w}`
        px = end; py = y
        i = Math.max(j, i + 1)
      }
      d = d.replace(/ -/g, '-')
      const paint = c.startsWith('.') ? `class="${c.slice(1)}"` : `stroke="${c}"`
      out += `<path ${paint}${attrs} d="${d}"/>`
    }
    return out
  }
}

// A 3x5 pixel font, advance 4.
const GLYPHS = {
  A: '.#.|#.#|###|#.#|#.#', B: '##.|#.#|##.|#.#|##.', C: '.##|#..|#..|#..|.##', D: '##.|#.#|#.#|#.#|##.',
  E: '###|#..|##.|#..|###', F: '###|#..|##.|#..|#..', G: '.##|#..|#.#|#.#|.##', H: '#.#|#.#|###|#.#|#.#',
  I: '###|.#.|.#.|.#.|###', J: '..#|..#|..#|#.#|.#.', K: '#.#|#.#|##.|#.#|#.#', L: '#..|#..|#..|#..|###',
  M: '#.#|###|#.#|#.#|#.#', N: '##.|#.#|#.#|#.#|#.#', O: '.#.|#.#|#.#|#.#|.#.', P: '##.|#.#|##.|#..|#..',
  Q: '.#.|#.#|#.#|##.|.##', R: '##.|#.#|##.|#.#|#.#', S: '.##|#..|.#.|..#|##.', T: '###|.#.|.#.|.#.|.#.',
  U: '#.#|#.#|#.#|#.#|###', V: '#.#|#.#|#.#|#.#|.#.', W: '#.#|#.#|#.#|###|#.#', X: '#.#|#.#|.#.|#.#|#.#',
  Y: '#.#|#.#|.#.|.#.|.#.', Z: '###|..#|.#.|#..|###', 0: '###|#.#|#.#|#.#|###', 2: '##.|..#|.#.|#..|###',
  '>': '#..|.#.|..#|.#.|#..', _: '...|...|...|...|###', '&': '.#.|#.#|.#.|#.#|.##', '!': '.#.|.#.|.#.|...|.#.',
  '^': '.#.|###|.#.|.#.|.#.', ' ': '...|...|...|...|...',
}
export function text(sprite, str, x, y, c) {
  let cx = x
  for (const ch of str) {
    const g = GLYPHS[ch]
    if (!g) throw new Error('no glyph ' + ch)
    g.split('|').forEach((row, j) => [...row].forEach((v, i) => { if (v === '#') sprite.set(cx + i, y + j, c) }))
    cx += 4
  }
}
export const textWidth = str => str.length * 4 - 1

// Horizontal bands with a checkerboard dither between them, the 16/32-bit way.
export function bands(x, y0, w, stops, classes) {
  let s = ''
  for (let i = 0; i < stops.length - 1; i++) {
    const y = stops[i], h = stops[i + 1] - y
    s += `<rect class="${classes[i]}" x="${x}" y="${y}" width="${w}" height="${h + 0.5}"/>`
  }
  for (let i = 1; i < stops.length - 1; i++) {
    const y = stops[i], a = classes[i], b = classes[i - 1]
    s += dither(x, y - 3, w, a, '1 3', 0) + dither(x, y - 2, w, a, '1 1', 0) + dither(x, y - 1, w, a, '1 1', 1)
    s += dither(x, y, w, b, '1 1', 0) + dither(x, y + 1, w, b, '1 3', 2)
  }
  return s
}
// one dashed row of single pixels (CSS gives line.<class> its stroke)
export function dither(x, y, w, cls, dash, offset) {
  return `<line class="${cls}" x1="${x}" x2="${x + w}" y1="${y + 0.5}" y2="${y + 0.5}" stroke-dasharray="${dash}" stroke-dashoffset="${offset}"/>`
}

// CSS for colors that change between light and dark: { name: [light, dark] }
export function modeCss(map) {
  let light = '', dark = ''
  for (const [name, [l, d]] of Object.entries(map)) {
    light += `.${name}{fill:${l}}line.${name},path.${name}{stroke:${l}}`
    dark += `.${name}{fill:${d}}line.${name},path.${name}{stroke:${d}}`
  }
  return `${light}@media (prefers-color-scheme: dark){${dark}}`
}
