/**
 * Imports external vector artwork (e.g. AI-generated designs vectorised to
 * SVG with a limited palette) as a recolourable pattern: every distinct
 * flat colour becomes a `data-layer`, the most-used colour being layer 0
 * (the base), so it behaves exactly like a generated pattern.
 *
 * The input is parsed with a small built-in XML reader (no DOM needed) and
 * only shape geometry is carried over: scripts, links, images, text, filters
 * and anything unknown never reach the output, which is in the same strict
 * layered format that `parseLayered` validates.
 */

export interface ImportedArtwork {
  /** Layered SVG (1000 × 1000, the artwork scaled to cover it). */
  svg: string
  /** Layer colours, base first. */
  colors: string[]
  layers: number
  /** Things that were simplified or dropped, as stable codes for the UI to explain. */
  warnings: ImportWarning[]
}

export type ImportWarning = 'gradients' | 'text' | 'images' | 'merged' | 'opacity'

export const MAX_IMPORT_BYTES = 3_000_000
export const MAX_ARTWORK_BYTES = 600_000
export const MAX_IMPORT_LAYERS = 8

export class ArtworkError extends Error {
  constructor(public code: 'notSvg' | 'empty' | 'tooBig' | 'tooComplex') {
    super(`Artwork import failed: ${code}`)
  }
}

/* ------------------------------------------------------------------ */
/* XML                                                                */
/* ------------------------------------------------------------------ */

interface El {
  name: string
  attrs: Map<string, string>
  children: El[]
  text: string
  parent: El | null
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENTITIES[e] ?? m),
  )

function parseXml(src: string): El {
  const root: El = { name: '#root', attrs: new Map(), children: [], text: '', parent: null }
  let cur = root
  let i = 0
  const n = src.length
  while (i < n) {
    const lt = src.indexOf('<', i)
    if (lt < 0) break
    if (lt > i) cur.text += src.slice(i, lt)
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4)
      i = end < 0 ? n : end + 3
    } else if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt + 9)
      cur.text += src.slice(lt + 9, end < 0 ? n : end)
      i = end < 0 ? n : end + 3
    } else if (src.startsWith('<?', lt)) {
      const end = src.indexOf('?>', lt + 2)
      i = end < 0 ? n : end + 2
    } else if (src.startsWith('<!', lt)) {
      // DOCTYPE, possibly with an internal [subset].
      let depth = 0
      let j = lt + 2
      for (; j < n; j++) {
        if (src[j] === '[') depth++
        else if (src[j] === ']') depth--
        else if (src[j] === '>' && depth <= 0) break
      }
      i = j + 1
    } else if (src[lt + 1] === '/') {
      const end = src.indexOf('>', lt)
      const name = src.slice(lt + 2, end < 0 ? n : end).trim()
      // Close up to the matching element (tolerates sloppy markup).
      for (let e: El | null = cur; e && e !== root; e = e.parent)
        if (e.name === name) {
          cur = e.parent!
          break
        }
      i = end < 0 ? n : end + 1
    } else {
      const m = /^<([A-Za-z_][\w:.-]*)/.exec(src.slice(lt, lt + 200))
      if (!m) {
        i = lt + 1
        continue
      }
      const el: El = { name: m[1], attrs: new Map(), children: [], text: '', parent: cur }
      let j = lt + m[0].length
      const attr = /\s*([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')|\s*(\/?)>/y
      let selfClose = false
      for (;;) {
        attr.lastIndex = j
        const a = attr.exec(src)
        if (!a) {
          // Malformed tag: skip to its end.
          const end = src.indexOf('>', j)
          j = end < 0 ? n : end + 1
          break
        }
        j = attr.lastIndex
        if (a[1]) el.attrs.set(a[1], decode(a[3] ?? a[4] ?? ''))
        else {
          selfClose = a[5] === '/'
          break
        }
      }
      cur.children.push(el)
      if (!selfClose) cur = el
      i = j
    }
  }
  return root
}

/* ------------------------------------------------------------------ */
/* Colours                                                            */
/* ------------------------------------------------------------------ */

const NAMED: Record<string, string> = {
  black: '#000000', white: '#FFFFFF', red: '#FF0000', green: '#008000', blue: '#0000FF', yellow: '#FFFF00',
  orange: '#FFA500', purple: '#800080', pink: '#FFC0CB', gray: '#808080', grey: '#808080', navy: '#000080',
  teal: '#008080', lime: '#00FF00', aqua: '#00FFFF', cyan: '#00FFFF', magenta: '#FF00FF', fuchsia: '#FF00FF',
  maroon: '#800000', olive: '#808000', silver: '#C0C0C0', gold: '#FFD700', brown: '#A52A2A', crimson: '#DC143C',
  darkblue: '#00008B', darkgreen: '#006400', darkred: '#8B0000', lightblue: '#ADD8E6', lightgray: '#D3D3D3', lightgrey: '#D3D3D3',
  darkgray: '#A9A9A9', darkgrey: '#A9A9A9', royalblue: '#4169E1', skyblue: '#87CEEB', coral: '#FF7F50', tomato: '#FF6347',
  indigo: '#4B0082', violet: '#EE82EE', beige: '#F5F5DC', ivory: '#FFFFF0', khaki: '#F0E68C', salmon: '#FA8072',
}

const hex2 = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0').toUpperCase()

/** Any CSS colour we can read → #RRGGBB; null for none/transparent/unreadable. */
function cssColor(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  if (!v || v === 'none' || v === 'transparent') return null
  if (NAMED[v]) return NAMED[v]
  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v)
  if (m) {
    const h = m[1].length <= 4 ? [...m[1].slice(0, 3)].map((c) => c + c).join('') : m[1].slice(0, 6)
    return `#${h.toUpperCase()}`
  }
  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+[\d.]+%?)?\s*\)$/.exec(v)
  if (m) {
    const ch = (s: string) => (s.endsWith('%') ? (parseFloat(s) * 255) / 100 : parseFloat(s))
    return `#${hex2(ch(m[1]))}${hex2(ch(m[2]))}${hex2(ch(m[3]))}`
  }
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+[\d.]+%?)?\s*\)$/.exec(v)
  if (m) {
    const h = (+m[1] % 360) / 360, s = +m[2] / 100, l = +m[3] / 100
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    const f = (t: number) => {
      t = (t + 1) % 1
      return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p)
    }
    return `#${hex2(f(h + 1 / 3))}${hex2(f(h))}${hex2(f(h - 1 / 3))}`
  }
  return null
}

const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const distance = (a: string, b: string) => {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  // Weighted RGB distance (closer to perceived difference than plain RGB).
  return Math.sqrt(2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2) / 3
}

/* ------------------------------------------------------------------ */
/* Styles                                                             */
/* ------------------------------------------------------------------ */

const STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'display', 'visibility', 'opacity', 'fill-opacity', 'stroke-opacity', 'color'] as const
type Prop = (typeof STYLE_PROPS)[number]
type Style = Partial<Record<Prop, string>>
const INHERITED: Prop[] = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'visibility', 'fill-opacity', 'stroke-opacity', 'color']

const declarations = (css: string): Style => {
  const out: Style = {}
  for (const part of css.split(';')) {
    const at = part.indexOf(':')
    if (at < 0) continue
    const k = part.slice(0, at).trim().toLowerCase() as Prop
    if ((STYLE_PROPS as readonly string[]).includes(k)) out[k] = part.slice(at + 1).replace(/!important/i, '').trim()
  }
  return out
}

interface Rule {
  tag: string | null
  id: string | null
  classes: string[]
  specificity: number
  order: number
  style: Style
}

/** Simple selectors only (tag, .class, #id and combinations) — what design tools emit. */
function parseCss(css: string): Rule[] {
  const rules: Rule[] = []
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '')
  let i = 0
  let order = 0
  while (i < src.length) {
    const open = src.indexOf('{', i)
    if (open < 0) break
    const head = src.slice(i, open).trim()
    // Find the matching close (at-rules may nest blocks).
    let depth = 1
    let j = open + 1
    for (; j < src.length && depth; j++) depth += src[j] === '{' ? 1 : src[j] === '}' ? -1 : 0
    const body = src.slice(open + 1, j - 1)
    i = j
    if (head.startsWith('@')) continue
    const style = declarations(body)
    for (const sel of head.split(',')) {
      const m = /^([a-zA-Z][\w-]*|\*)?((?:[.#][\w-]+)*)$/.exec(sel.trim())
      if (!m) continue
      const parts = m[2].match(/[.#][\w-]+/g) ?? []
      const ids = parts.filter((p) => p[0] === '#').map((p) => p.slice(1))
      const classes = parts.filter((p) => p[0] === '.').map((p) => p.slice(1))
      const tag = m[1] && m[1] !== '*' ? m[1] : null
      rules.push({ tag, id: ids[0] ?? null, classes, specificity: ids.length * 100 + classes.length * 10 + (tag ? 1 : 0), order: order++, style })
    }
  }
  return rules
}

/* ------------------------------------------------------------------ */
/* Geometry                                                           */
/* ------------------------------------------------------------------ */

type M = [number, number, number, number, number, number]
const IDENTITY: M = [1, 0, 0, 1, 0, 0]
const mul = (a: M, b: M): M => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
]
const nums = (s: string) => (s.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number)

function parseTransform(raw: string | undefined): M {
  let m = IDENTITY
  if (!raw) return m
  for (const [, fn, args] of raw.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gi)) {
    const a = nums(args)
    const r = (deg: number) => (deg * Math.PI) / 180
    let t: M = IDENTITY
    switch (fn.toLowerCase()) {
      case 'matrix': if (a.length === 6) t = a as M; break
      case 'translate': t = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]; break
      case 'scale': t = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]; break
      case 'rotate': {
        const c = Math.cos(r(a[0] ?? 0)), s = Math.sin(r(a[0] ?? 0))
        const [cx, cy] = [a[1] ?? 0, a[2] ?? 0]
        t = mul(mul([1, 0, 0, 1, cx, cy], [c, s, -s, c, 0, 0]), [1, 0, 0, 1, -cx, -cy])
        break
      }
      case 'skewx': t = [1, 0, Math.tan(r(a[0] ?? 0)), 1, 0, 0]; break
      case 'skewy': t = [1, Math.tan(r(a[0] ?? 0)), 0, 1, 0, 0]; break
    }
    m = mul(m, t)
  }
  return m
}

const len = (v: string | undefined, fallback = 0) => {
  const x = v === undefined ? NaN : parseFloat(v)
  return Number.isFinite(x) ? x : fallback
}
const fmt = (v: number) => {
  const r = Math.round(v * 1000) / 1000
  return (r === 0 ? 0 : r).toString()
}

const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]*$/

/** Path data for a basic shape (null when it has no area/length). */
function shapeD(el: El): string | null {
  const a = (k: string) => len(el.attrs.get(k))
  switch (el.name) {
    case 'path': {
      const d = (el.attrs.get('d') ?? '').replace(/\s+/g, ' ').trim()
      return d && PATH_DATA.test(d) ? d : null
    }
    case 'rect': {
      const [x, y, w, h] = [a('x'), a('y'), a('width'), a('height')]
      if (w <= 0 || h <= 0) return null
      let rx = len(el.attrs.get('rx'), NaN), ry = len(el.attrs.get('ry'), NaN)
      if (Number.isNaN(rx)) rx = Number.isNaN(ry) ? 0 : ry
      if (Number.isNaN(ry)) ry = rx
      rx = Math.min(rx, w / 2)
      ry = Math.min(ry, h / 2)
      if (rx <= 0 || ry <= 0) return `M${fmt(x)} ${fmt(y)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}Z`
      const arc = (dx: number, dy: number) => `a${fmt(rx)} ${fmt(ry)} 0 0 1 ${fmt(dx)} ${fmt(dy)}`
      return `M${fmt(x + rx)} ${fmt(y)}h${fmt(w - 2 * rx)}${arc(rx, ry)}v${fmt(h - 2 * ry)}${arc(-rx, ry)}h${fmt(-(w - 2 * rx))}${arc(-rx, -ry)}v${fmt(-(h - 2 * ry))}${arc(rx, -ry)}Z`
    }
    case 'circle':
    case 'ellipse': {
      const rx = el.name === 'circle' ? a('r') : a('rx')
      const ry = el.name === 'circle' ? a('r') : a('ry')
      if (rx <= 0 || ry <= 0) return null
      const [cx, cy] = [a('cx'), a('cy')]
      return `M${fmt(cx - rx)} ${fmt(cy)}a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(2 * rx)} 0a${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(-2 * rx)} 0Z`
    }
    case 'line':
      return `M${fmt(a('x1'))} ${fmt(a('y1'))}L${fmt(a('x2'))} ${fmt(a('y2'))}`
    case 'polyline':
    case 'polygon': {
      const p = nums(el.attrs.get('points') ?? '')
      if (p.length < 4) return null
      const pairs: string[] = []
      for (let i = 0; i + 1 < p.length; i += 2) pairs.push(`${fmt(p[i])} ${fmt(p[i + 1])}`)
      return `M${pairs.join('L')}${el.name === 'polygon' ? 'Z' : ''}`
    }
  }
  return null
}

/**
 * Rough area and length of path data under a transform: shoelace and
 * perimeter over each subpath's on-curve points (an arc adds its bulge point).
 */
function measure(d: string, m: M): { area: number; length: number } {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []
  const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 }
  let x = 0, y = 0, sx = 0, sy = 0
  let total = 0
  let length = 0
  let sub: [number, number][] = []
  const flush = () => {
    let s = 0
    for (let i = 0; i < sub.length; i++) {
      const [x0, y0] = sub[i]
      const [x1, y1] = sub[(i + 1) % sub.length]
      s += x0 * y1 - x1 * y0
      if (i + 1 < sub.length) length += Math.hypot(x1 - x0, y1 - y0)
    }
    total += Math.abs(s) / 2
    sub = []
  }
  const pushAt = (px: number, py: number) => sub.push([m[0] * px + m[2] * py + m[4], m[1] * px + m[3] * py + m[5]])
  const push = () => pushAt(x, y)
  let cmd = ''
  let i = 0
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) cmd = tokens[i++]
    const lower = cmd.toLowerCase()
    const rel = cmd !== cmd.toUpperCase()
    if (lower === 'z') {
      flush()
      x = sx
      y = sy
      if (i < tokens.length && !/[a-z]/i.test(tokens[i])) i++ // stray number
      continue
    }
    const n = ARGS[lower]
    if (n === undefined || i + n > tokens.length) break
    const a = tokens.slice(i, i + n).map(Number)
    i += n
    const [x0, y0] = [x, y]
    if (lower === 'h') x = rel ? x + a[0] : a[0]
    else if (lower === 'v') y = rel ? y + a[0] : a[0]
    else {
      x = rel ? x + a[n - 2] : a[n - 2]
      y = rel ? y + a[n - 1] : a[n - 1]
    }
    if (lower === 'a') {
      // The arc's middle, roughly: the chord's midpoint pushed out by the radius, on the sweep side.
      const [dx, dy] = [x - x0, y - y0]
      const chord = Math.hypot(dx, dy) || 1
      const side = a[4] ? 1 : -1
      pushAt((x0 + x) / 2 + (side * dy * Math.abs(a[1])) / chord, (y0 + y) / 2 - (side * dx * Math.abs(a[1])) / chord)
    }
    if (lower === 'm') {
      if (sub.length) flush()
      sx = x
      sy = y
      cmd = rel ? 'l' : 'L' // further pairs are line-tos
    }
    push()
  }
  if (sub.length) flush()
  return { area: total, length }
}

/* ------------------------------------------------------------------ */
/* Import                                                             */
/* ------------------------------------------------------------------ */

interface Item {
  color: string
  stroke: boolean
  d: string
  m: M
  width: number
  cap: string
  join: string
  evenOdd: boolean
  weight: number
}

const SKIP = new Set(['defs', 'clipPath', 'mask', 'symbol', 'pattern', 'marker', 'linearGradient', 'radialGradient', 'filter', 'style', 'script', 'title', 'desc', 'metadata', 'foreignObject', 'animate', 'animateTransform', 'set', 'font', 'font-face', 'cursor', 'view'])
const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'])

export function importSvg(source: string): ImportedArtwork {
  if (source.length > MAX_IMPORT_BYTES) throw new ArtworkError('tooBig')
  const doc = parseXml(source.replace(/^\uFEFF/, ''))
  const root = doc.children.find((e) => e.name === 'svg' || e.name.endsWith(':svg'))
  if (!root) throw new ArtworkError('notSvg')

  const warnings = new Set<ImportWarning>()
  const byId = new Map<string, El>()
  let styleText = ''
  let count = 0
  const index = (e: El) => {
    if (++count > 50_000) throw new ArtworkError('tooComplex')
    const id = e.attrs.get('id')
    if (id && !byId.has(id)) byId.set(id, e)
    if (e.name === 'style') styleText += e.text + '\n'
    e.children.forEach(index)
  }
  index(root)
  const rules = parseCss(styleText)

  /** Gradients flatten to their middle stop's colour. */
  const gradientColor = (id: string, depth = 0): string | null => {
    const g = byId.get(id)
    if (!g || depth > 5) return null
    const stops = g.children.filter((c) => c.name === 'stop')
    if (!stops.length) {
      const href = (g.attrs.get('href') ?? g.attrs.get('xlink:href') ?? '').replace(/^#/, '')
      return href ? gradientColor(href, depth + 1) : null
    }
    const stop = stops[Math.floor((stops.length - 1) / 2)]
    const color = stop.attrs.get('stop-color') ?? declarations(stop.attrs.get('style') ?? '')['color' as Prop] ?? /stop-color\s*:\s*([^;]+)/.exec(stop.attrs.get('style') ?? '')?.[1]
    return color ? cssColor(color) : null
  }

  const paint = (raw: string | undefined, style: Style): string | null => {
    if (!raw) return null
    const v = raw.trim()
    const url = /^url\(\s*['"]?#([^'")]+)['"]?\s*\)/.exec(v)
    if (url) {
      warnings.add('gradients')
      return gradientColor(url[1])
    }
    if (v.toLowerCase() === 'currentcolor') return cssColor(style.color ?? 'black')
    return cssColor(v)
  }

  const computed = (el: El, parent: Style): Style => {
    const s: Style = {}
    for (const k of INHERITED) if (parent[k] !== undefined) s[k] = parent[k]
    for (const k of STYLE_PROPS) {
      const v = el.attrs.get(k)
      if (v !== undefined && v.trim() !== 'inherit') s[k] = v
    }
    const classes = (el.attrs.get('class') ?? '').split(/\s+/).filter(Boolean)
    const id = el.attrs.get('id')
    const matching = rules
      .filter((r) => (!r.tag || r.tag === el.name) && (!r.id || r.id === id) && r.classes.every((c) => classes.includes(c)))
      .sort((a, b) => a.specificity - b.specificity || a.order - b.order)
    for (const r of matching) Object.assign(s, r.style)
    Object.assign(s, declarations(el.attrs.get('style') ?? ''))
    return s
  }

  const items: Item[] = []
  const walk = (el: El, parent: Style, m: M, depth: number, alpha: number) => {
    if (depth > 64 || SKIP.has(el.name) || el.name.includes(':')) return
    const style = computed(el, parent)
    if (style.display?.trim() === 'none') return
    const opacity = alpha * len(style.opacity, 1)
    if (opacity < 1) warnings.add('opacity')
    if (opacity <= 0.01) return
    let local = mul(m, parseTransform(el.attrs.get('transform')))

    if (el.name === 'text' || el.name === 'tspan' || el.name === 'textPath') {
      warnings.add('text')
      return
    }
    if (el.name === 'image') {
      warnings.add('images')
      return
    }
    if (el.name === 'use') {
      const ref = byId.get((el.attrs.get('href') ?? el.attrs.get('xlink:href') ?? '').replace(/^#/, ''))
      if (!ref || depth > 8) return
      local = mul(local, [1, 0, 0, 1, len(el.attrs.get('x')), len(el.attrs.get('y'))])
      // A referenced symbol's children render; anything else renders itself.
      if (ref.name === 'symbol') ref.children.forEach((c) => walk(c, style, local, depth + 1, opacity))
      else walk({ ...ref, name: ref.name }, style, local, depth + 1, opacity)
      return
    }
    if (el.name === 'svg' && el !== root) {
      local = mul(local, [1, 0, 0, 1, len(el.attrs.get('x')), len(el.attrs.get('y'))])
    }
    if (SHAPES.has(el.name)) {
      if (style.visibility?.trim() === 'hidden') return
      const d = shapeD(el)
      if (!d) return
      const fill = el.name === 'line' || el.name === 'polyline' ? (style.fill === undefined ? null : paint(style.fill, style)) : paint(style.fill ?? 'black', style)
      const stroke = paint(style.stroke, style)
      const width = len(style['stroke-width'], 1)
      const scale = Math.sqrt(Math.abs(local[0] * local[3] - local[1] * local[2]))
      if (fill && len(style['fill-opacity'], 1) > 0.01) {
        items.push({ color: fill, stroke: false, d, m: local, width: 0, cap: 'butt', join: 'miter', evenOdd: style['fill-rule']?.trim() === 'evenodd', weight: measure(d, local).area })
      }
      if (stroke && width > 0 && len(style['stroke-opacity'], 1) > 0.01) {
        const area = measure(d, local).length * width * scale
        items.push({ color: stroke, stroke: true, d, m: local, width, cap: style['stroke-linecap']?.trim() ?? 'butt', join: style['stroke-linejoin']?.trim() ?? 'miter', evenOdd: false, weight: area })
      }
      return
    }
    for (const c of el.children) walk(c, style, local, depth + 1, opacity)
  }
  walk(root, {}, IDENTITY, 0, 1)
  if (!items.length) throw new ArtworkError('empty')

  // Palette: weight per colour, near-duplicates merged, then capped.
  const weight = new Map<string, number>()
  for (const it of items) weight.set(it.color, (weight.get(it.color) ?? 0) + Math.max(1, it.weight))
  const byWeight = (list: string[]) => list.sort((a, b) => weight.get(b)! - weight.get(a)! || (a < b ? -1 : 1))
  const distinct = byWeight([...weight.keys()])
  const mapTo = new Map<string, string>(distinct.map((c) => [c, c]))
  // Merged colours pool their weight into the heavier one they join.
  const merge = (from: string, into: string) => {
    weight.set(into, weight.get(into)! + weight.get(from)!)
    for (const [k, v] of mapTo) if (v === from) mapTo.set(k, into)
  }
  const kept: string[] = []
  for (const c of distinct) {
    const near = kept.find((k) => distance(k, c) < 14)
    if (near) merge(c, near)
    else kept.push(c)
  }
  while (kept.length > MAX_IMPORT_LAYERS) {
    byWeight(kept)
    const c = kept.pop()!
    let best = kept[0]
    for (const k of kept) if (distance(k, c) < distance(best, c)) best = k
    merge(c, best)
  }
  if (kept.length < distinct.length) warnings.add('merged')
  let palette = byWeight(kept)
  // One colour only: put it on a contrasting base so it stays visible.
  if (palette.length === 1) {
    const [r, g, b] = rgb(palette[0])
    palette = [0.299 * r + 0.587 * g + 0.114 * b > 140 ? '#111111' : '#FFFFFF', palette[0]]
  }

  // Cover the 1000 × 1000 tile with the artwork's viewBox (or its width/height).
  const vb = nums(root.attrs.get('viewBox') ?? '')
  const [vx, vy, vw, vh] = vb.length === 4 && vb[2] > 0 && vb[3] > 0 ? vb : [0, 0, len(root.attrs.get('width'), 0), len(root.attrs.get('height'), 0)]
  if (!(vw > 0 && vh > 0)) throw new ArtworkError('notSvg')
  const s = 1000 / Math.min(vw, vh)
  const fit: M = [s, 0, 0, s, (1000 - vw * s) / 2 - vx * s, (1000 - vh * s) / 2 - vy * s]

  const layerOf = new Map(palette.map((c, i) => [c, i]))
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" data-type="artwork" data-layers="${palette.length}">`
  out += `<g data-layer="0" fill="${palette[0]}"><rect width="1000" height="1000"/></g>`
  // Document order is kept (it's the stacking order); consecutive shapes of one layer and style share a group.
  let runKey = ''
  for (const it of items) {
    const layer = layerOf.get(mapTo.get(it.color)!)!
    const color = palette[layer]
    const key = `${layer}|${it.stroke}|${it.evenOdd}|${it.cap}|${it.join}`
    if (key !== runKey) {
      if (runKey) out += '</g>'
      const cap = ['round', 'butt', 'square'].includes(it.cap) ? it.cap : 'butt'
      const join = ['round', 'miter', 'bevel'].includes(it.join) ? it.join : 'miter'
      out += it.stroke
        ? `<g data-layer="${layer}" fill="none" stroke="${color}" stroke-linecap="${cap}" stroke-linejoin="${join}">`
        : `<g data-layer="${layer}" fill="${color}"${it.evenOdd ? ' fill-rule="evenodd"' : ''}>`
      runKey = key
    }
    const t = mul(fit, it.m)
    out += `<path d="${it.d}" transform="matrix(${t.map(fmt).join(' ')})"${it.stroke ? ` stroke-width="${fmt(it.width)}"` : ''}/>`
    if (out.length > MAX_ARTWORK_BYTES) throw new ArtworkError('tooComplex')
  }
  out += '</g></svg>'
  return { svg: out, colors: palette, layers: palette.length, warnings: [...warnings] }
}
