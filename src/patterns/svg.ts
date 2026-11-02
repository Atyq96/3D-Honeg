import { bbox, TILE, type Pt } from './math'

/**
 * SVG assembly. A pattern is a 1000 × 1000 tile made of colour layers:
 *
 *   <g data-layer="0" fill="#…"><rect width="1000" height="1000"/></g>   ← base (the fabric)
 *   <g data-layer="1" fill="#…"><path d="…"/></g>
 *   <g data-layer="2" fill="none" stroke="#…" stroke-width="8"><path d="…"/></g>
 *
 * Only the layer groups carry colours, so recolouring rewrites those
 * attributes and never touches the geometry.
 */

/** Coordinates to 0.1 unit (0.06 mm on a 60 cm print): plenty, and keeps files small. */
export function f(v: number): string {
  const r = Math.round(v * 10) / 10
  return (r === 0 ? 0 : r).toString()
}

export const polyD = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z'
export const lineD = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')
export const rectD = (x: number, y: number, w: number, h: number) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`
export const circleD = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`

/** Smooth path through points (quadratic curves between midpoints); closed loops stay closed. */
export function smoothD(pts: Pt[], closed: boolean): string {
  if (pts.length < 3) return lineD(pts)
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const p = (q: Pt) => `${f(q[0])} ${f(q[1])}`
  if (closed) {
    const n = pts.length
    let d = `M${p(mid(pts[n - 1], pts[0]))}`
    for (let i = 0; i < n; i++) d += `Q${p(pts[i])} ${p(mid(pts[i], pts[(i + 1) % n]))}`
    return d + 'Z'
  }
  let d = `M${p(pts[0])}`
  for (let i = 1; i < pts.length - 1; i++) d += `Q${p(pts[i])} ${p(mid(pts[i], pts[i + 1]))}`
  return d + `L${p(pts[pts.length - 1])}`
}

/**
 * Tile offsets at which a shape must be drawn so that, cut to the tile, it
 * continues across the edges (the left part of a shard that leaves on the
 * right). `margin` covers stroke widths.
 */
export function wrapOffsets(pts: Pt[], margin = 0): Pt[] {
  const [x0, y0, x1, y1] = bbox(pts)
  const out: Pt[] = []
  // Shapes may sit anywhere on the plane; check every tile they could reach
  // (a shape ending exactly on an edge doesn't need a copy on the other side).
  const e = 1e-6
  const kx0 = Math.floor((x0 - margin + e) / TILE), kx1 = Math.floor((x1 + margin - e) / TILE)
  const ky0 = Math.floor((y0 - margin + e) / TILE), ky1 = Math.floor((y1 + margin - e) / TILE)
  for (let kx = kx0; kx <= kx1; kx++) for (let ky = ky0; ky <= ky1; ky++) out.push([-kx * TILE, -ky * TILE])
  return out
}

/** Every visible copy of a polygon, as path data. */
export function wrappedPoly(pts: Pt[], margin = 0): string {
  return wrapOffsets(pts, margin)
    .map(([dx, dy]) => polyD(pts.map(([x, y]) => [x + dx, y + dy])))
    .join('')
}

/** Every visible copy of an open polyline (stroked), as path data. */
export function wrappedLine(pts: Pt[], margin: number, smooth = false): string {
  return wrapOffsets(pts, margin)
    .map(([dx, dy]) => {
      const moved = pts.map(([x, y]): Pt => [x + dx, y + dy])
      return smooth ? smoothD(moved, false) : lineD(moved)
    })
    .join('')
}

/** One colour layer's drawing: filled shapes, or strokes of a given width. */
export interface LayerArt {
  /** Path data, concatenated into one `<path>` (one per layer keeps files small and fast). */
  d: string
  stroke?: { width: number; cap?: 'round' | 'butt' | 'square'; join?: 'round' | 'miter' | 'bevel' }
  /** Even-odd filling (for shapes with holes). */
  evenOdd?: boolean
}

const groupAttrs = (color: string, art: LayerArt) =>
  art.stroke
    ? ` fill="none" stroke="${color}" stroke-width="${f(art.stroke.width)}" stroke-linecap="${art.stroke.cap ?? 'round'}" stroke-linejoin="${art.stroke.join ?? 'round'}"`
    : ` fill="${color}"${art.evenOdd ? ' fill-rule="evenodd"' : ''}`

/** The full tile: base layer 0 plus one group per ink layer. `colors[i]` colours layer i. */
export function buildSvg(meta: Record<string, string | number>, colors: string[], layers: LayerArt[]): string {
  const attrs = Object.entries(meta)
    .map(([k, v]) => ` data-${k}="${v}"`)
    .join('')
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${TILE}"${attrs} data-layers="${layers.length + 1}">`
  out += `<g data-layer="0" fill="${colors[0]}"><rect width="${TILE}" height="${TILE}"/></g>`
  layers.forEach((art, i) => {
    out += `<g data-layer="${i + 1}"${groupAttrs(colors[i + 1], art)}>${art.d ? `<path d="${art.d}"/>` : ''}</g>`
  })
  return out + '</svg>'
}

const LAYER_TAG = /<g data-layer="(\d+)"([^>]*)>/g
const COLOR_ATTR = /\b(fill|stroke)="#[0-9A-Fa-f]{3,8}"/g

/**
 * New colours for an existing pattern SVG: `colors[i]` replaces layer i's
 * colour; layers without a new colour keep theirs. Only the layer groups'
 * fill/stroke attributes change — the geometry is untouched.
 */
export function recolor(svg: string, colors: readonly string[]): string {
  return svg.replace(LAYER_TAG, (tag, index: string, attrs: string) => {
    const c = colors[+index]
    if (!c || !/^#[0-9A-Fa-f]{6}$/.test(c)) return tag
    return `<g data-layer="${index}"${attrs.replace(COLOR_ATTR, `$1="${c}"`)}>`
  })
}

/** Each layer's current colour, by layer index. */
export function layerColors(svg: string): string[] {
  const out: string[] = []
  for (const m of svg.matchAll(LAYER_TAG)) {
    const c = /\b(?:fill|stroke)="(#[0-9A-Fa-f]{3,8})"/.exec(m[2])
    if (c && out[+m[1]] === undefined) out[+m[1]] = c[1].toUpperCase()
  }
  return out
}

/** Number of colour layers in a pattern SVG. */
export function countLayers(svg: string): number {
  let max = -1
  for (const m of svg.matchAll(LAYER_TAG)) max = Math.max(max, +m[1])
  return max + 1
}

/** The SVG with every colour removed — what must stay identical when recolouring. */
export const geometryOf = (svg: string) => svg.replace(COLOR_ATTR, '$1=""')

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
