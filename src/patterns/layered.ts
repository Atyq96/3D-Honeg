/**
 * Reader for the layered pattern format (what generatePattern and importSvg
 * produce). It accepts that format only — anything else (scripts, links,
 * styles, unknown elements or attributes) is rejected — so it doubles as the
 * validator for artwork stored in saved designs.
 */

export interface LayeredItem {
  kind: 'path' | 'rect'
  /** Path data (paths) — or width/height (rects, drawn at 0,0). */
  d: string
  width: number
  height: number
  transform: Matrix | null
  strokeWidth: number | null
}

export interface LayeredGroup {
  layer: number
  fill: string | null
  stroke: string | null
  strokeWidth: number
  cap: CanvasLineCap
  join: CanvasLineJoin
  evenOdd: boolean
  transform: Matrix | null
  items: LayeredItem[]
}

/** a b c d e f, as in SVG matrix(…) */
export type Matrix = [number, number, number, number, number, number]

export interface Layered {
  /** viewBox width/height (1000 × 1000 for patterns). */
  width: number
  height: number
  layers: number
  groups: LayeredGroup[]
}

const NUM = String.raw`-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?`
const HEX = /^#[0-9A-Fa-f]{6}$/
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]*$/
const MATRIX = new RegExp(String.raw`^matrix\((${NUM})[ ,]+(${NUM})[ ,]+(${NUM})[ ,]+(${NUM})[ ,]+(${NUM})[ ,]+(${NUM})\)$`, 'i')
const TAG = /\s*<(\/?)([a-z]+)((?:\s+[a-z:-]+="[^"<>]*")*)\s*(\/?)>/giy
const ATTR = /\s+([a-z:-]+)="([^"<>]*)"/gi

function attrs(raw: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of raw.matchAll(ATTR)) out.set(m[1], m[2])
  return out
}

const fail = (why: string): never => {
  throw new Error(`Not a layered pattern SVG: ${why}`)
}

function number(v: string | undefined, name: string): number {
  if (v === undefined || !new RegExp(`^${NUM}$`, 'i').test(v)) return fail(`bad ${name}`)
  return +v
}

function matrix(v: string | undefined): Matrix | null {
  if (v === undefined) return null
  const m = MATRIX.exec(v.trim())
  return m ? (m.slice(1, 7).map(Number) as Matrix) : fail('bad transform')
}

const ROOT_ATTRS = new Set(['xmlns', 'viewBox', 'width', 'height', 'data-type', 'data-seed', 'data-layers'])
const GROUP_ATTRS = new Set(['data-layer', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'transform'])
const ITEM_ATTRS = new Set(['d', 'width', 'height', 'transform', 'stroke-width'])

export function parseLayered(svg: string): Layered {
  const src = svg.trim()
  TAG.lastIndex = 0
  let root: Map<string, string> | null = null
  let group: LayeredGroup | null = null
  const groups: LayeredGroup[] = []
  let closed = false
  while (TAG.lastIndex < src.length) {
    const start = TAG.lastIndex
    const m = TAG.exec(src)
    if (!m || m.index !== start) fail(`unexpected content at ${start}`)
    const [, close, name, rawAttrs, selfClose] = m!
    const a = attrs(rawAttrs)
    for (const k of a.keys()) {
      const allowed = name === 'svg' ? ROOT_ATTRS : name === 'g' ? GROUP_ATTRS : ITEM_ATTRS
      if (!allowed.has(k)) fail(`attribute ${k} on <${name}>`)
    }
    if (closed) fail('content after </svg>')
    if (name === 'svg') {
      if (close) {
        if (group) fail('unclosed group')
        closed = true
      } else {
        if (root) fail('nested <svg>')
        if (a.get('xmlns') !== 'http://www.w3.org/2000/svg') fail('namespace')
        root = a
      }
    } else if (name === 'g') {
      if (!root || closed) fail('group outside <svg>')
      if (close) {
        if (!group) fail('stray </g>')
        groups.push(group!)
        group = null
        continue
      }
      if (group) fail('nested group')
      const layer = number(a.get('data-layer'), 'data-layer')
      if (!Number.isInteger(layer) || layer < 0 || layer > 15) fail('layer index')
      const paint = (v: string | undefined) => (v === undefined || v === 'none' ? null : HEX.test(v) ? v.toUpperCase() : fail('colour'))
      const fill = a.has('fill') ? paint(a.get('fill')) : null
      const stroke = paint(a.get('stroke'))
      if (!fill && !stroke) fail('layer without colour')
      const cap = a.get('stroke-linecap') ?? 'round'
      const join = a.get('stroke-linejoin') ?? 'round'
      if (!['round', 'butt', 'square'].includes(cap) || !['round', 'miter', 'bevel'].includes(join)) fail('stroke style')
      const rule = a.get('fill-rule') ?? 'nonzero'
      if (rule !== 'nonzero' && rule !== 'evenodd') fail('fill-rule')
      group = {
        layer,
        fill,
        stroke,
        strokeWidth: a.has('stroke-width') ? number(a.get('stroke-width'), 'stroke-width') : 1,
        cap: cap as CanvasLineCap,
        join: join as CanvasLineJoin,
        evenOdd: rule === 'evenodd',
        transform: matrix(a.get('transform')),
        items: [],
      }
      if (selfClose) {
        groups.push(group)
        group = null
      }
    } else if (name === 'path' || name === 'rect') {
      if (!group || close || !selfClose) fail(`<${name}> must be a self-closing child of a layer group`)
      const d = name === 'path' ? (a.get('d') ?? '') : ''
      if (!PATH_DATA.test(d)) fail('path data')
      group!.items.push({
        kind: name,
        d,
        width: name === 'rect' ? number(a.get('width'), 'width') : 0,
        height: name === 'rect' ? number(a.get('height'), 'height') : 0,
        transform: matrix(a.get('transform')),
        strokeWidth: a.has('stroke-width') ? number(a.get('stroke-width'), 'stroke-width') : null,
      })
    } else fail(`element <${name}>`)
  }
  if (!root || !closed) fail('missing <svg> or </svg>')
  const vb = (root!.get('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
  if (vb.length !== 4 || vb.some((v) => !Number.isFinite(v)) || vb[0] !== 0 || vb[1] !== 0 || vb[2] <= 0 || vb[3] <= 0) fail('viewBox')
  if (!groups.some((g) => g.layer === 0)) fail('no base layer')
  return { width: vb[2], height: vb[3], layers: Math.max(...groups.map((g) => g.layer)) + 1, groups }
}

/** True when `svg` is a valid layered pattern. */
export function isLayered(svg: string): boolean {
  try {
    parseLayered(svg)
    return true
  } catch {
    return false
  }
}
