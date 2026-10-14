/**
 * Garment pattern library.
 *
 * Curated from inkjet — "Generative SVG patterns", MIT © 2025 0xDragoon
 * (https://github.com/dragoon0x/inkjet). The original renderers were built as
 * subtle UI backgrounds (opacity multipliers of 0.03–0.15); here they are
 * re-tuned for print strength, randomly scattered motifs are wrapped so every
 * tile is seamless, and hex-based motifs use true hexagonal tiles.
 *
 * Each renderer returns SVG markup for one tile in tile units (default 20×20),
 * drawn in the ink colour on a transparent background.
 */

export type PatternCategory = 'stripes' | 'checks' | 'dots' | 'geometric' | 'animal' | 'waves' | 'floral' | 'retro' | 'technical'

export interface PatternParams {
  /** Ink colour. */
  color: string
  /** Garment colour underneath (for motifs that knock out, e.g. seigaiha). */
  bg: string
  /** 0–1, pattern-specific (stripe width, dot size, scatter amount…). */
  density: number
  seed: number
}

export interface PatternDef {
  id: string
  name: string
  category: PatternCategory
  /** Tile size in tile units [w, h]. */
  tile: [number, number]
  /** Whether the density slider changes this pattern. */
  usesDensity: boolean
  /** Whether the layout is random (so Shuffle changes it). */
  usesSeed: boolean
  /** Suggested printed tile width, cm. */
  defaultSizeCm: number
  render: (p: PatternParams) => string
}

export const CATEGORY_LABELS: Record<PatternCategory, string> = {
  stripes: 'Stripes',
  checks: 'Checks',
  dots: 'Dots',
  geometric: 'Geometric',
  animal: 'Animal',
  waves: 'Waves',
  floral: 'Floral',
  retro: 'Retro',
  technical: 'Tech',
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const T = 20
const HEX_R = T / Math.sqrt(3) // pointy-top hexagon radius so its width is one tile
const HEX_TILE: [number, number] = [T, 3 * HEX_R]

const n = (v: number) => +v.toFixed(3)
const op = (o: number) => (o < 1 ? ` opacity="${n(o)}"` : '')
const ci = (cx: number, cy: number, r: number, f: string, o = 1) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${f}"${op(o)}/>`
const ring = (cx: number, cy: number, r: number, s: string, sw: number, o = 1) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${s}" stroke-width="${n(sw)}"${op(o)}/>`
const rc = (x: number, y: number, w: number, h: number, f: string, o = 1, rx = 0) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${f}"${op(o)}${rx ? ` rx="${n(rx)}"` : ''}/>`
const ln = (x1: number, y1: number, x2: number, y2: number, s: string, sw: number, o = 1) =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${s}" stroke-width="${n(sw)}" stroke-linecap="round"${op(o)}/>`
const pa = (d: string, f: string, s = 'none', sw = 0, o = 1) =>
  `<path d="${d}" fill="${f}"${s !== 'none' ? ` stroke="${s}" stroke-width="${n(sw)}" stroke-linejoin="round" stroke-linecap="round"` : ''}${op(o)}/>`
const el = (cx: number, cy: number, rx: number, ry: number, rot: number, f: string, o = 1) =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" transform="rotate(${n(rot)} ${n(cx)} ${n(cy)})" fill="${f}"${op(o)}/>`

/** Seeded PRNG from inkjet (Park–Miller). */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/**
 * Evenly spread random points: one per cell of a jittered grid. Pure random
 * placement clumps, which makes the tile repeat obvious on a garment.
 */
function scatter(r: () => number, count: number): [number, number][] {
  const k = Math.ceil(Math.sqrt(count))
  const cell = T / k
  const cells = Array.from({ length: k * k }, (_, i) => i)
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[cells[i], cells[j]] = [cells[j], cells[i]]
  }
  return cells.slice(0, count).map((c) => [((c % k) + 0.1 + r() * 0.8) * cell, (Math.floor(c / k) + 0.1 + r() * 0.8) * cell])
}

/** Repeats content at the 8 neighbouring tile offsets so shapes crossing an edge continue seamlessly. */
const wrap = (svg: string, [w, h]: [number, number] = [T, T]) =>
  [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => (dx || dy ? `<g transform="translate(${dx * w} ${dy * h})">${svg}</g>` : svg))).join('')

const hexPath = (cx: number, cy: number, r: number) =>
  'M' + [0, 1, 2, 3, 4, 5].map((k) => { const a = ((60 * k - 90) * Math.PI) / 180; return `${n(cx + r * Math.cos(a))},${n(cy + r * Math.sin(a))}` }).join(' L') + ' Z'
const HEX_CENTRES: [number, number][] = [[0, 0], [T, 0], [T / 2, 1.5 * HEX_R], [0, 3 * HEX_R], [T, 3 * HEX_R]]

const star = (cx: number, cy: number, ro: number, ri: number, points = 5) => {
  let d = ''
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2
    const r = i % 2 ? ri : ro
    d += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * r)},${n(cy + Math.sin(a) * r)} `
  }
  return d + 'Z'
}

const pixels = (rows: string[], c: string, x0 = 0, y0 = 0, px = 2) =>
  rows.flatMap((row, y) => [...row].map((ch, x) => (ch === '#' ? rc(x0 + x * px, y0 + y * px, px + 0.02, px + 0.02, c) : ''))).join('')

/* ------------------------------------------------------------------ */
/* Library                                                            */
/* ------------------------------------------------------------------ */

/** Patterns whose layout comes from the seeded PRNG (Shuffle re-rolls them). */
const SEEDED = new Set(['confetti', 'speckle', 'bubbles', 'leopard', 'tiger', 'cow', 'cheetah', 'ditsy', 'memphis', 'pixel-mosaic', 'terrazzo', 'splatter'])

const defs: PatternDef[] = []
function reg(id: string, name: string, category: PatternCategory, render: PatternDef['render'], opts: Partial<Pick<PatternDef, 'tile' | 'usesDensity' | 'defaultSizeCm'>> = {}) {
  defs.push({ id, name, category, render, tile: opts.tile ?? [T, T], usesDensity: opts.usesDensity ?? false, usesSeed: SEEDED.has(id), defaultSizeCm: opts.defaultSizeCm ?? 6 })
}

// ── Stripes ─────────────────────────────────────────────────────────
reg('breton', 'Breton', 'stripes', ({ color, density }) => { const h = 2 + density * 8; return rc(0, (T - h) / 2, T, h, color) }, { usesDensity: true, defaultSizeCm: 4 })
reg('awning', 'Awning', 'stripes', ({ color, density }) => rc(0, 0, 4 + density * 12, T, color), { usesDensity: true, defaultSizeCm: 8 })
reg('pinstripe', 'Pinstripe', 'stripes', ({ color, density }) => ln(T / 2, -1, T / 2, T + 1, color, 0.5 + density * 1.2), { usesDensity: true, defaultSizeCm: 2 })
reg('racing', 'Racing', 'stripes', ({ color }) => rc(6.4, 0, 2.8, T, color) + rc(10.8, 0, 2.8, T, color), { defaultSizeCm: 14 })
reg('shadow-stripe', 'Shadow stripe', 'stripes', ({ color }) => rc(5, 0, 4, T, color, 0.4) + rc(9, 0, 1.6, T, color), { defaultSizeCm: 5 })
reg('multistripe', 'Multistripe', 'stripes', ({ color }) => rc(1.5, 0, 1, T, color) + rc(4, 0, 2.5, T, color, 0.55) + rc(10, 0, 1, T, color) + rc(13.5, 0, 4, T, color, 0.35), { defaultSizeCm: 8 })
reg('candy-stripe', 'Diagonal', 'stripes', ({ color, density }) => wrap(ln(-10, 30, 30, -10, color, 3 + density * 7)), { usesDensity: true, defaultSizeCm: 5 })
reg('regimental', 'Regimental', 'stripes', ({ color }) => wrap(ln(-10, 30, 30, -10, color, 5) + ln(0, 30, 30, 0, color, 1.4)), { defaultSizeCm: 6 })

// ── Checks ──────────────────────────────────────────────────────────
reg('gingham', 'Gingham', 'checks', ({ color }) => rc(0, 0, 10, T, color, 0.5) + rc(0, 0, T, 10, color, 0.5), { defaultSizeCm: 2.5 })
reg('buffalo', 'Buffalo check', 'checks', ({ color }) => rc(0, 0, 10, T, color, 0.35) + rc(0, 0, T, 10, color, 0.35) + rc(0, 0, 10, 10, color), { defaultSizeCm: 8 })
reg('checkerboard', 'Checkerboard', 'checks', ({ color }) => rc(0, 0, 10, 10, color) + rc(10, 10, 10, 10, color), { defaultSizeCm: 4 })
// True houndstooth from its weave: 2/2 twill with blocks of 4 dark / 4 light ends in both directions.
reg('houndstooth', 'Houndstooth', 'checks', ({ color }) => {
  let s = ''
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const warpUp = (x + y) % 4 < 2
      if (warpUp ? x < 4 : y < 4) s += rc(x * 2.5, y * 2.5, 2.52, 2.52, color)
    }
  return s
}, { defaultSizeCm: 2.5 })
reg('argyle', 'Argyle', 'checks', ({ color }) =>
  pa('M10,0 L20,10 L10,20 L0,10 Z', color, 'none', 0, 0.55) + wrap(ln(0, 0, 20, 20, color, 0.5) + ln(20, 0, 0, 20, color, 0.5)), { defaultSizeCm: 8 })
reg('harlequin', 'Harlequin', 'checks', ({ color }) => pa('M10,0 L20,10 L10,20 L0,10 Z', color), { defaultSizeCm: 6 })
reg('tartan', 'Tartan', 'checks', ({ color }) =>
  rc(0, 5, T, 3, color, 0.65) + rc(0, 13.5, T, 1.5, color, 0.4) + rc(5, 0, 3, T, color, 0.65) + rc(13.5, 0, 1.5, T, color, 0.4) + ln(0, 17.5, T, 17.5, color, 0.4) + ln(17.5, 0, 17.5, T, color, 0.4), { defaultSizeCm: 9 })
reg('windowpane', 'Windowpane', 'checks', ({ color, density }) => ln(10, -1, 10, 21, color, 0.4 + density * 1.6) + ln(-1, 10, 21, 10, color, 0.4 + density * 1.6), { usesDensity: true, defaultSizeCm: 7 })
reg('glen-plaid', 'Glen plaid', 'checks', ({ color }) =>
  [2.5, 7.5, 12.5, 17.5].map((p, i) => ln(-1, p, 21, p, color, i % 2 ? 0.8 : 0.4, i % 2 ? 0.8 : 0.5) + ln(p, -1, p, 21, color, i % 2 ? 0.8 : 0.4, i % 2 ? 0.8 : 0.5)).join('') + rc(0, 0, 10, 10, color, 0.18), { defaultSizeCm: 6 })
reg('madras', 'Madras', 'checks', ({ color }) =>
  rc(0, 4, T, 4, color, 0.45) + rc(0, 12, T, 3, color, 0.7) + rc(3, 0, 4, T, color, 0.35) + rc(12, 0, 3, T, color, 0.55), { defaultSizeCm: 8 })

// ── Dots ────────────────────────────────────────────────────────────
reg('polka', 'Polka', 'dots', ({ color, density }) => { const r = 1.5 + density * 4; return [[10, 10], [0, 0], [T, 0], [0, T], [T, T]].map(([x, y]) => ci(x, y, r, color)).join('') }, { usesDensity: true, defaultSizeCm: 4 })
reg('dots', 'Dot grid', 'dots', ({ color, density }) => ci(10, 10, 1 + density * 5, color), { usesDensity: true, defaultSizeCm: 2 })
reg('dots-offset', 'Offset dots', 'dots', ({ color, density }) => { const r = 1 + density * 3; return ci(10, 5, r, color) + ci(0, 15, r, color) + ci(T, 15, r, color) }, { usesDensity: true, defaultSizeCm: 2.5 })
reg('halftone', 'Halftone', 'dots', ({ color, density }) => { const r1 = 1.5 + density * 3.2, r2 = r1 * 0.5; return ci(5, 5, r1, color) + ci(15, 15, r1, color) + ci(15, 5, r2, color) + ci(5, 15, r2, color) }, { usesDensity: true, defaultSizeCm: 2 })
reg('rings', 'Rings', 'dots', ({ color, density }) => ring(10, 10, 3 + density * 5, color, 1.4), { usesDensity: true, defaultSizeCm: 3 })
reg('confetti', 'Confetti', 'dots', ({ color, density, seed }) => {
  const r = rng(seed)
  let s = ''
  for (const [x, y] of scatter(r, 4 + Math.round(density * 8))) { const a = r() * 360, w = 1 + r() * 1.5; s += `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(w * 2.4)}" fill="${color}" transform="rotate(${n(a)} ${n(x)} ${n(y)})"${op(0.6 + r() * 0.4)}/>` }
  return wrap(s)
}, { usesDensity: true, defaultSizeCm: 6 })
reg('speckle', 'Speckle', 'dots', ({ color, density, seed }) => {
  const r = rng(seed)
  let s = ''
  for (let i = 0; i < 12 + Math.round(density * 30); i++) s += ci(r() * T, r() * T, 0.3 + r() * 0.8, color, 0.5 + r() * 0.5)
  return wrap(s)
}, { usesDensity: true, defaultSizeCm: 5 })
reg('bubbles', 'Bubbles', 'dots', ({ color, seed }) => {
  const r = rng(seed)
  let s = ''
  for (const [x, y] of scatter(r, 5)) s += ring(x, y, 2 + r() * 4, color, 0.9)
  return wrap(s)
}, { defaultSizeCm: 6 })

// ── Geometric ───────────────────────────────────────────────────────
reg('honeycomb', 'Honeycomb', 'geometric', ({ color, density }) => HEX_CENTRES.map(([x, y]) => pa(hexPath(x, y, HEX_R * 0.97), 'none', color, 0.5 + density * 2)).join(''), { tile: HEX_TILE, usesDensity: true, defaultSizeCm: 3 })
reg('tumbling-blocks', 'Tumbling blocks', 'geometric', ({ color }) =>
  HEX_CENTRES.map(([x, y]) => {
    const p = (k: number) => { const a = ((60 * k - 90) * Math.PI) / 180; return `${n(x + HEX_R * Math.cos(a))},${n(y + HEX_R * Math.sin(a))}` }
    const c = `${n(x)},${n(y)}`
    // Three rhombi per hexagon: top (full ink), left (mid), right (light) — the classic cube illusion.
    return pa(`M${c} L${p(5)} L${p(0)} L${p(1)} Z`, color) + pa(`M${c} L${p(3)} L${p(4)} L${p(5)} Z`, color, 'none', 0, 0.55) + pa(`M${c} L${p(1)} L${p(2)} L${p(3)} Z`, color, 'none', 0, 0.2)
  }).join(''), { tile: HEX_TILE, defaultSizeCm: 5 })
reg('chevron', 'Chevron', 'geometric', ({ color, density }) => pa('M-2,15.2 L10,4.8 L22,15.2', 'none', color, 2 + density * 4), { usesDensity: true, defaultSizeCm: 5 })
reg('zigzag', 'Zigzag', 'geometric', ({ color }) => pa('M-2,16.7 L10,3.3 L22,16.7', 'none', color, 1.2), { defaultSizeCm: 3 })
reg('herringbone', 'Herringbone', 'geometric', ({ color }) => wrap([0, 5, 10, 15].map((y) => ln(0.5, y + 4.5, 9.5, y + 0.5, color, 1.6) + ln(10.5, y + 0.5, 19.5, y + 4.5, color, 1.6)).join('')), { defaultSizeCm: 3 })
reg('diamonds', 'Diamonds', 'geometric', ({ color, density }) => pa('M10,0 L20,10 L10,20 L0,10 Z', 'none', color, 0.6 + density * 2), { usesDensity: true, defaultSizeCm: 3 })
reg('triangles', 'Triangles', 'geometric', ({ color }) => pa('M0,20 L10,0 L20,20 Z', color, 'none', 0, 0.9) + pa('M10,0 L20,0 L20,20 Z M0,0 L10,0 L0,20 Z', color, 'none', 0, 0.3), { defaultSizeCm: 4 })
reg('crosses', 'Crosses', 'geometric', ({ color, density }) => { const t = 1 + density * 2; return rc(10 - t, 4, t * 2, 12, color) + rc(4, 10 - t, 12, t * 2, color) }, { usesDensity: true, defaultSizeCm: 2.5 })
reg('stars', 'Stars', 'geometric', ({ color, density }) => pa(star(10, 10.6, 3 + density * 5, (3 + density * 5) * 0.42), color) + pa(star(0, 0, 2, 0.85), color) + pa(star(T, 0, 2, 0.85), color) + pa(star(0, T, 2, 0.85), color) + pa(star(T, T, 2, 0.85), color), { usesDensity: true, defaultSizeCm: 4 })
reg('greek-key', 'Greek key', 'geometric', ({ color }) => pa('M0,17 L0,3 L14,3 L14,13 L6,13 L6,9 L10,9 M0,17 L20,17', 'none', color, 1.6), { defaultSizeCm: 4 })
reg('scales', 'Scales', 'geometric', ({ color }) => [[0, 0], [T, 0], [10, 10], [0, T], [T, T]].map(([x, y]) => ring(x, y, 10, color, 1.2)).join(''), { defaultSizeCm: 3 })
reg('octagons', 'Octagons', 'geometric', ({ color }) => pa('M6,0 L14,0 L20,6 L20,14 L14,20 L6,20 L0,14 L0,6 Z', 'none', color, 1.2) + pa('M0,0 L6,0 L0,6 Z M14,0 L20,0 L20,6 Z M20,14 L20,20 L14,20 Z M0,14 L6,20 L0,20 Z', color), { defaultSizeCm: 4 })
reg('quatrefoil', 'Quatrefoil', 'geometric', ({ color }) => [[10, 6.4], [13.6, 10], [10, 13.6], [6.4, 10]].map(([x, y]) => ring(x, y, 3.6, color, 1.1)).join(''), { defaultSizeCm: 4 })
reg('crosshatch', 'Crosshatch', 'geometric', ({ color, density }) => wrap(ln(0, 20, 20, 0, color, 0.4 + density * 1.4) + ln(0, 0, 20, 20, color, 0.4 + density * 1.4)), { usesDensity: true, defaultSizeCm: 1.5 })
reg('target', 'Target', 'geometric', ({ color }) => ring(10, 10, 8, color, 1.2) + ring(10, 10, 5, color, 1.2) + ci(10, 10, 2, color), { defaultSizeCm: 4 })

// ── Animal ──────────────────────────────────────────────────────────
reg('leopard', 'Leopard', 'animal', ({ color, density, seed }) => {
  const r = rng(seed)
  let s = ''
  for (const [cx, cy] of scatter(r, 3 + Math.round(density * 4))) {
    const rad = 2.6 + r() * 1.2, rot = r() * 360
    s += el(cx, cy, rad * 0.6, rad * 0.45, rot, color, 0.35)
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + r() * 0.5
      s += el(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.85, 1.5 + r() * 0.6, 0.75 + r() * 0.35, (a * 180) / Math.PI + 90, color)
    }
  }
  return wrap(s)
}, { usesDensity: true, defaultSizeCm: 14 })
reg('zebra', 'Zebra', 'animal', ({ color }) =>
  [1.5, 6.8, 12, 17.2].map((y, i) => pa(`M-1,${y} Q5,${y + 3.6} 10,${y} Q15,${y - 3.6} 21,${y}`, 'none', color, i % 2 ? 2.4 : 1.6)).join(''), { defaultSizeCm: 10 })
reg('tiger', 'Tiger', 'animal', ({ color, seed }) => {
  const r = rng(seed)
  let s = ''
  for (let i = 0; i < 5; i++) { const y = i * 4 + r() * 2, x = r() * 20; s += pa(`M${n(x - 7)},${n(y)} Q${n(x)},${n(y + 4.2)} ${n(x + 7)},${n(y - 1)} Q${n(x)},${n(y + 1)} ${n(x - 7)},${n(y)} Z`, color) }
  return wrap(s)
}, { defaultSizeCm: 12 })
reg('cow', 'Cow', 'animal', ({ color, density, seed }) => {
  const r = rng(seed)
  let s = ''
  for (const [cx, cy] of scatter(r, 2 + Math.round(density * 3))) { s += el(cx, cy, 2.5 + r() * 3, 2 + r() * 2, r() * 180, color) + el(cx + 2, cy + 1.5, 1.6 + r(), 1.2 + r(), r() * 180, color) }
  return wrap(s)
}, { usesDensity: true, defaultSizeCm: 16 })
reg('cheetah', 'Cheetah', 'animal', ({ color, density, seed }) => {
  const r = rng(seed)
  let s = ''
  for (const [x, y] of scatter(r, 8 + Math.round(density * 12))) s += el(x, y, 0.6 + r() * 0.9, 0.5 + r() * 0.6, r() * 180, color)
  return wrap(s)
}, { usesDensity: true, defaultSizeCm: 8 })
reg('snakeskin', 'Snakeskin', 'animal', ({ color }) => {
  let s = ''
  for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) s += `<ellipse cx="${n(col * (T / 3) + T / 6 + (row % 2) * (T / 6))}" cy="${n(row * 5 + 2.5)}" rx="3" ry="2.2" fill="none" stroke="${color}" stroke-width="0.7"/>`
  return wrap(s)
}, { defaultSizeCm: 4 })

// ── Waves ───────────────────────────────────────────────────────────
reg('waves', 'Waves', 'waves', ({ color, density }) => { let d = 'M-1,10'; for (let x = 0; x <= T; x += 1) d += ` L${x},${n(10 + Math.sin((x / T) * Math.PI * 2) * (2 + density * 4))}`; return pa(d + ' L21,10', 'none', color, 1.6) }, { usesDensity: true, defaultSizeCm: 4 })
reg('ocean', 'Ocean', 'waves', ({ color }) => pa('M-1,12 Q5,6 10,10 Q15,14 21,8', 'none', color, 1.4) + pa('M-1,3 Q5,-1 10,1 Q15,3 21,-1', 'none', color, 0.8, 0.6), { defaultSizeCm: 5 })
reg('seigaiha', 'Seigaiha', 'waves', ({ color, bg }) =>
  [[0, 0], [T, 0], [10, 10], [0, T], [T, T]].map(([x, y]) => ci(x, y, 10, bg) + [9.3, 6.6, 3.9, 1.4].map((rad) => ring(x, y, rad, color, 1)).join('')).join(''), { defaultSizeCm: 4 })
reg('topography', 'Topography', 'waves', ({ color }) =>
  [2.5, 7.5, 12.5, 17.5].map((y, i) => { let d = ''; for (let x = -1; x <= 21; x++) d += `${x < 0 ? 'M' : ' L'}${x},${n(y + Math.sin(((x + i * 5) / T) * Math.PI * 2) * 1.6 + Math.sin(((x * 2 + i) / T) * Math.PI * 2) * 0.6)}`; return pa(d, 'none', color, 0.7) }).join(''), { defaultSizeCm: 8 })
reg('sound-wave', 'Sound wave', 'waves', ({ color }) => { let s = ''; for (let x = 1; x < T; x += 2) { const a = 1 + Math.abs(Math.sin((x / T) * Math.PI * 2)) * 7; s += ln(x, 10 - a, x, 10 + a, color, 1.1) } return s }, { defaultSizeCm: 6 })

// ── Floral ──────────────────────────────────────────────────────────
reg('daisy', 'Daisy', 'floral', ({ color }) => {
  let s = ''
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; s += el(10 + Math.cos(a) * 3.6, 10 + Math.sin(a) * 3.6, 2.2, 1.1, (a * 180) / Math.PI, color) }
  return s + ring(10, 10, 1.4, color, 0.8)
}, { defaultSizeCm: 4 })
reg('cherry-blossom', 'Cherry blossom', 'floral', ({ color }) => {
  let s = ''
  for (let i = 0; i < 5; i++) { const a = (i * 2 * Math.PI) / 5 - Math.PI / 2; s += el(10 + Math.cos(a) * 3, 10 + Math.sin(a) * 3, 2.6, 1.8, (a * 180) / Math.PI, color, 0.9) }
  return s + ci(10, 10, 1, color) + ci(0, 0, 1.2, color, 0.6) + ci(T, T, 1.2, color, 0.6) + ci(T, 0, 1.2, color, 0.6) + ci(0, T, 1.2, color, 0.6)
}, { defaultSizeCm: 5 })
reg('ditsy', 'Ditsy floral', 'floral', ({ color, density, seed }) => {
  const r = rng(seed)
  let s = ''
  for (const [cx, cy] of scatter(r, 4 + Math.round(density * 6))) {
    for (let j = 0; j < 5; j++) { const a = (j * 2 * Math.PI) / 5; s += ci(cx + Math.cos(a) * 0.9, cy + Math.sin(a) * 0.9, 0.6, color) }
  }
  return wrap(s)
}, { usesDensity: true, defaultSizeCm: 6 })
reg('palm', 'Palm leaf', 'floral', ({ color }) => {
  let s = pa('M10,19 Q10.5,11 10,3', 'none', color, 0.8)
  for (let i = 0; i < 7; i++) { const y = 4 + i * 2; for (const dir of [-1, 1]) s += pa(`M10,${y} Q${10 + dir * 3},${y - 1.6} ${10 + dir * (7 - i * 0.5)},${y + 1}`, 'none', color, 0.9) }
  return s
}, { defaultSizeCm: 8 })
reg('monstera', 'Monstera', 'floral', ({ color, bg }) =>
  pa('M10,10 Q3.5,9 3,4.5 Q6,2 10,2.6 Q14,2 17,4.5 Q16.5,9 10,10 Z', color) +
  pa('M10,9.5 L5,5.5 M10,9.5 L15,5.5 M10,9.5 L10,3.5', 'none', bg, 0.7) +
  ln(10, 10, 10, 18, color, 0.8), { defaultSizeCm: 8 })

// ── Retro ───────────────────────────────────────────────────────────
reg('memphis', 'Memphis', 'retro', ({ color, seed }) => {
  const r = rng(seed)
  let s = ''
  for (let i = 0; i < 3; i++) s += ci(r() * T, r() * T, 1 + r(), color)
  for (let i = 0; i < 2; i++) { const x = r() * T, y = r() * T; s += pa(`M${n(x)},${n(y)} q1.5,-2 3,0 t3,0 t3,0`, 'none', color, 0.9) }
  for (let i = 0; i < 2; i++) { const x = r() * T, y = r() * T, a = r() * 360; s += `<path d="M0,-2 L2,1.6 L-2,1.6 Z" transform="translate(${n(x)} ${n(y)}) rotate(${n(a)})" fill="none" stroke="${color}" stroke-width="0.8"/>` }
  return wrap(s)
}, { defaultSizeCm: 8 })
reg('pixel-heart', '8-bit heart', 'retro', ({ color }) =>
  pixels(['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], color, 3, 4, 2), { defaultSizeCm: 3 })
reg('space-invader', 'Space invader', 'retro', ({ color }) =>
  pixels(['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...'], color, 1.75, 4, 1.5), { defaultSizeCm: 4 })
reg('starburst', 'Starburst', 'retro', ({ color }) => {
  let s = ''
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI * 2) / 12; s += pa(`M10,10 L${n(10 + Math.cos(a - 0.11) * 9)},${n(10 + Math.sin(a - 0.11) * 9)} L${n(10 + Math.cos(a + 0.11) * 9)},${n(10 + Math.sin(a + 0.11) * 9)} Z`, color, 'none', 0, 0.75) }
  return s
}, { defaultSizeCm: 6 })
reg('flower-power', 'Flower power', 'retro', ({ color }) => {
  let s = ''
  for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; s += ci(10 + Math.cos(a) * 3.8, 10 + Math.sin(a) * 3.8, 2.6, color, 0.8) }
  return s + ci(10, 10, 2.2, color)
}, { defaultSizeCm: 5 })
reg('pixel-mosaic', 'Pixel mosaic', 'retro', ({ color, density, seed }) => {
  const r = rng(seed)
  let s = ''
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (r() < 0.3 + density * 0.4) s += rc(x * 4, y * 4, 4.02, 4.02, color, 0.35 + r() * 0.65)
  return s
}, { usesDensity: true, defaultSizeCm: 5 })

// ── Technical / texture ─────────────────────────────────────────────
reg('circuit', 'Circuit', 'technical', ({ color }) =>
  pa('M-1,10 H6 V4 H14 V10 H21', 'none', color, 0.9) + pa('M10,21 V15 H17', 'none', color, 0.9) + ci(6, 10, 1.1, color) + ci(14, 4, 1.1, color) + ring(17, 15, 1.2, color, 0.8), { defaultSizeCm: 5 })
reg('carbon-fiber', 'Carbon fibre', 'technical', ({ color }) =>
  rc(0, 0, 10, 10, color, 0.75) + rc(10, 10, 10, 10, color, 0.75) + rc(10, 0, 10, 10, color, 0.35) + rc(0, 10, 10, 10, color, 0.35) + ln(0, 0, 10, 10, color, 0.4, 0.5) + ln(10, 10, 20, 20, color, 0.4, 0.5), { defaultSizeCm: 1 })
reg('mesh', 'Sport mesh', 'technical', ({ color, density }) => wrap([0, 5, 10, 15].map((y) => [0, 5, 10, 15].map((x) => ci(x + 2.5 + ((y / 5) % 2) * 2.5, y + 2.5, 0.6 + density * 1.1, color)).join('')).join('')), { usesDensity: true, defaultSizeCm: 2 })
reg('terrazzo', 'Terrazzo', 'technical', ({ color, density, seed }) => {
  const r = rng(seed)
  let s = ''
  for (const [x, y] of scatter(r, 5 + Math.round(density * 8))) { const z = 1 + r() * 2.5; s += pa(`M${n(x)},${n(y)} L${n(x + z)},${n(y + r() * z * 0.5)} L${n(x + z * 0.7)},${n(y + z)} L${n(x - z * 0.3)},${n(y + z * 0.7)} Z`, color, 'none', 0, 0.45 + r() * 0.55) }
  return wrap(s)
}, { usesDensity: true, defaultSizeCm: 8 })
reg('splatter', 'Splatter', 'technical', ({ color, density, seed }) => {
  const r = rng(seed)
  let s = ''
  for (const [cx, cy] of scatter(r, 3 + Math.round(density * 4))) {
    s += ci(cx, cy, 0.8 + r() * 1.8, color)
    for (let k = 0; k < 5; k++) { const a = r() * Math.PI * 2, d = 2 + r() * 3; s += ci(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.2 + r() * 0.5, color) }
  }
  return wrap(s)
}, { usesDensity: true, defaultSizeCm: 10 })
reg('lightning', 'Lightning', 'technical', ({ color }) => pa('M11,1.5 L6,11 L9.6,11 L8,18.5 L14,8.6 L10.4,8.6 L12.6,1.5 Z', color), { defaultSizeCm: 4 })

export const PATTERNS: PatternDef[] = defs
const BY_ID = new Map(defs.map((d) => [d.id, d]))

export function getPattern(id: string): PatternDef | undefined {
  return BY_ID.get(id)
}

/** Standalone SVG for one tile (`px` wide), ink on the garment colour. */
export function tileSvg(def: PatternDef, params: PatternParams & { opacity: number }, px: number): string {
  const [w, h] = def.tile
  const height = Math.round((px * h) / w)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${height}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${params.bg}"/><g opacity="${n(params.opacity)}">${def.render(params)}</g></svg>`
}

export function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
