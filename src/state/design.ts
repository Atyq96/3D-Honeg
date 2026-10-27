import type { PlacementId, RegionId, Side } from '../garments/types'
import { DEFAULT_GARMENT_ID, GARMENTS } from '../garments/catalog'
import { DEFAULT_BODY_COLOR } from '../config/palette'
import { normalizeHex } from '../lib/color'
import { getPattern } from '../patterns/library'
import type { BrandSide, BrandStyle } from '../config/brand'
import { PAINT_ZONE_IDS, type PaintZoneId } from '../garments/zones'
import { t } from '../i18n'

export interface LogoAsset {
  /** PNG data URL (rasterised, trimmed and capped at 1024 px). */
  dataUrl: string
  name: string
  width: number
  height: number
  /** Original file size in bytes. */
  bytes: number
  /** Original MIME type. */
  mime: string
}

export interface LogoPlacement {
  side: Side
  placement: PlacementId
  widthCm: number
  /** Clockwise as seen by the viewer, degrees. */
  rotationDeg: number
  offsetXCm: number
  offsetYCm: number
  flipX: boolean
  flipY: boolean
  /** 0.1–1. */
  opacity: number
  /** Single-colour fill applied to the logo's visible pixels, or null for original colours. */
  tint: string | null
  /** Locked logos can't be dragged, resized, rotated or nudged on the garment. */
  locked: boolean
}

/** Most logos/photos one garment can carry. */
export const MAX_LOGOS = 3
/** Most text blocks one garment can carry (counted separately from logos). */
export const MAX_TEXTS = 3
export const MAX_TEXT_LINES = 3
export const MAX_TEXT_LINE_CHARS = 32

export type TextAlign = 'left' | 'center' | 'right'

/** What a text layer's image was rendered from. Its colour is the layer's fill (`placement.tint`). */
export interface TextSpec {
  content: string
  /** Font id from src/config/fonts.ts. */
  font: string
  align: TextAlign
  /** Cap height of the rendered image in px — turns its width into a letter height in cm. */
  capPx: number
  /**
   * Chosen letter height, cm. Text that would overflow the print area is set
   * smaller, and grows back to this size when it's shortened again.
   */
  sizeCm: number
}

/**
 * One print on the garment: an uploaded logo or photo, or a text block
 * rendered to an image. Array order is stacking order: later layers print on top.
 */
export interface LogoLayer {
  id: string
  asset: LogoAsset
  placement: LogoPlacement
  /** Present on text layers. */
  text?: TextSpec
}

export type LayerKind = 'image' | 'text'
export const layerKind = (l: LogoLayer): LayerKind => (l.text ? 'text' : 'image')

/** Printed letter height (cap height) of a text layer, cm. */
export function letterHeightCm(layer: LogoLayer): number {
  return layer.text ? Math.round(((layer.placement.widthCm * layer.text.capPx) / layer.asset.width) * 10) / 10 : 0
}

/** Keeps line breaks (up to MAX_TEXT_LINES) and trims each line to MAX_TEXT_LINE_CHARS. */
export function cleanTextContent(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .slice(0, MAX_TEXT_LINES)
    .map((l) => l.slice(0, MAX_TEXT_LINE_CHARS))
    .join('\n')
}

let logoSeq = 0
export const newLogoId = () => `logo-${Date.now().toString(36)}-${(++logoSeq).toString(36)}`

export interface Design {
  version: 1
  productId: string
  colors: {
    body: string
    /** null = follows the body colour. */
    sleeves: string | null
    collar: string | null
  }
  /** Up to MAX_LOGOS uploaded logos or photos. */
  logos: LogoLayer[]
  /** All-over print per colour zone (null = plain fabric). */
  patterns: Record<RegionId, PatternFill | null>
  /** Halves, panels and stripes painted over the parts; a zone is printed only when present. */
  zones: Partial<Record<PaintZoneId, ZonePaint>>
  /** The brand mark — always printed; only its position, style and colour are chosen. */
  brand: BrandMarkSettings
}

/** A paint zone's fabric colour, with an optional pattern drawn over it. */
export interface ZonePaint {
  color: string
  pattern: PatternFill | null
}

export interface BrandMarkSettings {
  /** Wearer's chest side. */
  side: BrandSide
  style: BrandStyle
  /** 'auto' = white on dark fabric, black on light fabric. */
  color: 'auto' | string
}

/** Wearer's right chest by default, opposite the default left-chest club logo (as on Nike/Adidas kits). */
export const DEFAULT_BRAND: BrandMarkSettings = { side: 'right', style: 'logo', color: 'auto' }

/** An all-over pattern printed on one zone, drawn in `color` over the zone's fabric colour. */
export interface PatternFill {
  /** Pattern id from src/patterns/library.ts. */
  id: string
  color: string
  /** Printed width of one pattern repeat, cm. */
  sizeCm: number
  /** Clockwise, degrees. */
  angle: number
  /** 0–1, pattern-specific. */
  density: number
  /** 0.1–1. */
  opacity: number
  /** Layout seed for scattered patterns (leopard, confetti…); "Shuffle" changes it. */
  seed: number
}

export const PATTERN_SIZE_CM: [number, number] = [1, 40]
export const NO_PATTERNS: Design['patterns'] = { body: null, sleeves: null, collar: null }

/** Keeps pattern values in range; returns null for unknown pattern ids. */
export function cleanPatternFill(p: PatternFill): PatternFill | null {
  if (!getPattern(p.id)) return null
  const color = normalizeHex(p.color)
  if (!color) return null
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo))
  return {
    id: p.id,
    color,
    sizeCm: Math.round(clamp(p.sizeCm, ...PATTERN_SIZE_CM) * 10) / 10,
    angle: ((((Math.round(p.angle) + 180) % 360) + 360) % 360) - 180,
    density: Math.round(clamp(p.density, 0, 1) * 100) / 100,
    opacity: Math.round(clamp(p.opacity, 0.1, 1) * 100) / 100,
    seed: Math.max(1, Math.round(clamp(p.seed, 1, 2147483646))),
  }
}

export const DEFAULT_PLACEMENT: LogoPlacement = {
  side: 'front',
  placement: 'leftChest',
  widthCm: 8,
  rotationDeg: 0,
  offsetXCm: 0,
  offsetYCm: 0,
  flipX: false,
  flipY: false,
  opacity: 1,
  tint: null,
  locked: false,
}

export function createDefaultDesign(): Design {
  return {
    version: 1,
    productId: DEFAULT_GARMENT_ID,
    colors: { body: DEFAULT_BODY_COLOR, sleeves: null, collar: null },
    logos: [],
    patterns: { ...NO_PATTERNS },
    zones: {},
    brand: { ...DEFAULT_BRAND },
  }
}

export function resolvedColor(colors: Design['colors'], region: RegionId): string {
  if (region === 'body') return colors.body
  return colors[region] ?? colors.body
}

export function logoAspect(asset: LogoAsset): number {
  return asset.width / asset.height
}

const PLACEMENTS: PlacementId[] = ['leftChest', 'centerChest', 'rightChest', 'upperBack', 'centerBack']

/**
 * Validates untrusted JSON (imported file or localStorage) into a Design.
 * Throws an Error with a user-facing message when the shape is wrong.
 */
export function parseDesign(raw: unknown): Design {
  const fail = (msg: string): never => {
    throw new Error(t().design.invalid(msg))
  }
  if (!raw || typeof raw !== 'object') fail(t().design.expectedObject)
  const d = raw as Record<string, unknown>
  if (d.version !== 1) fail(t().design.version)
  if (typeof d.productId !== 'string') fail(t().design.product)
  // Products come and go as models change; carry the design over to the default product.
  const productId = GARMENTS.some((g) => g.id === d.productId) ? (d.productId as string) : DEFAULT_GARMENT_ID

  const c = (d.colors ?? {}) as Record<string, unknown>
  const body = typeof c.body === 'string' ? normalizeHex(c.body) : null
  if (!body) fail(t().design.bodyColor)
  const optional = (v: unknown, name: string) => {
    if (v === null || v === undefined) return null
    const hex = typeof v === 'string' ? normalizeHex(v) : null
    return hex ?? fail(t().design.partColor(name))
  }

  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

  const asset = (raw: unknown): LogoAsset => {
    const l = (raw ?? {}) as Record<string, unknown>
    if (typeof l.dataUrl !== 'string' || !/^data:image\/(png|jpeg);base64,/.test(l.dataUrl)) fail(t().design.logoImage)
    if (typeof l.width !== 'number' || typeof l.height !== 'number' || l.width <= 0 || l.height <= 0) fail(t().design.logoSize)
    return {
      dataUrl: l.dataUrl as string,
      name: typeof l.name === 'string' ? l.name.slice(0, 120) : 'logo.png',
      width: l.width as number,
      height: l.height as number,
      bytes: typeof l.bytes === 'number' ? l.bytes : 0,
      mime: typeof l.mime === 'string' ? l.mime : 'image/png',
    }
  }

  const placement = (raw: unknown): LogoPlacement => {
    const p = (raw ?? {}) as Record<string, unknown>
    return {
      side: p.side === 'back' ? 'back' : 'front',
      placement: PLACEMENTS.includes(p.placement as PlacementId) ? (p.placement as PlacementId) : DEFAULT_PLACEMENT.placement,
      widthCm: num(p.widthCm, DEFAULT_PLACEMENT.widthCm),
      rotationDeg: num(p.rotationDeg, 0),
      offsetXCm: num(p.offsetXCm, 0),
      offsetYCm: num(p.offsetYCm, 0),
      // Appearance fields were added later; older exports simply get the defaults.
      flipX: p.flipX === true,
      flipY: p.flipY === true,
      opacity: Math.min(1, Math.max(0.1, num(p.opacity, 1))),
      tint: typeof p.tint === 'string' ? normalizeHex(p.tint) : null,
      locked: p.locked === true,
    }
  }

  // Exports from before multiple logos carry a single `logo` + `placement`.
  const rawLogos: Record<string, unknown>[] = Array.isArray(d.logos)
    ? d.logos.map((l) => (l ?? {}) as Record<string, unknown>)
    : d.logo
      ? [{ asset: d.logo, placement: d.placement }]
      : []
  const text = (raw: unknown, image: LogoAsset): TextSpec | undefined => {
    if (!raw || typeof raw !== 'object') return undefined
    const t = raw as Record<string, unknown>
    const content = typeof t.content === 'string' ? cleanTextContent(t.content) : ''
    if (!content.trim()) return undefined
    const capPx = num(t.capPx, 0)
    return {
      content,
      font: typeof t.font === 'string' && /^[a-z-]{1,32}$/.test(t.font) ? t.font : 'anton',
      align: t.align === 'left' || t.align === 'right' ? t.align : 'center',
      // Without a usable cap height, treat the whole image as one line of capitals.
      capPx: capPx > 0 && capPx <= image.height * 4 ? capPx : image.height,
      sizeCm: Math.min(40, Math.max(0.5, num(t.sizeCm, 4))),
    }
  }
  const ids = new Set<string>()
  const counts: Record<LayerKind, number> = { image: 0, text: 0 }
  const logos: LogoLayer[] = []
  for (const l of rawLogos) {
    const image = asset(l.asset)
    const spec = text(l.text, image)
    const kind: LayerKind = spec ? 'text' : 'image'
    if (++counts[kind] > (kind === 'text' ? MAX_TEXTS : MAX_LOGOS)) continue
    let id = typeof l.id === 'string' && /^[\w-]{1,64}$/.test(l.id) ? l.id : newLogoId()
    if (ids.has(id)) id = newLogoId()
    ids.add(id)
    logos.push({ id, asset: image, placement: placement(l.placement), ...(spec ? { text: spec } : {}) })
  }

  // Patterns were added later too; unknown pattern ids are dropped rather than rejected.
  const rawPatterns = (d.patterns ?? {}) as Record<string, unknown>
  const pattern = (v: unknown): PatternFill | null => {
    if (!v || typeof v !== 'object') return null
    const f = v as Record<string, unknown>
    if (typeof f.id !== 'string' || typeof f.color !== 'string') return null
    return cleanPatternFill({
      id: f.id,
      color: f.color,
      sizeCm: num(f.sizeCm, 6),
      angle: num(f.angle, 0),
      density: num(f.density, 0.5),
      opacity: num(f.opacity, 1),
      seed: num(f.seed, 42),
    })
  }

  return {
    version: 1,
    productId,
    colors: { body: body as string, sleeves: optional(c.sleeves, t().design.sleeve), collar: optional(c.collar, t().design.collar) },
    logos,
    patterns: { body: pattern(rawPatterns.body), sleeves: pattern(rawPatterns.sleeves), collar: pattern(rawPatterns.collar) },
    zones: parseZones(d.zones, pattern),
    brand: parseBrand(d.brand),
  }
}

/** The brand mark can't be switched off; invalid or missing settings fall back to defaults. */
function parseBrand(raw: unknown): BrandMarkSettings {
  const b = (raw ?? {}) as Record<string, unknown>
  const color = b.color === 'auto' ? 'auto' : typeof b.color === 'string' ? normalizeHex(b.color) : null
  return {
    side: b.side === 'left' || b.side === 'right' || b.side === 'center' ? b.side : DEFAULT_BRAND.side,
    style: b.style === 'logo' || b.style === 'symbol' ? b.style : DEFAULT_BRAND.style,
    color: color ?? DEFAULT_BRAND.color,
  }
}

/** Paint zones were added later; unknown zones and invalid colours are dropped rather than rejected. */
function parseZones(raw: unknown, pattern: (v: unknown) => PatternFill | null): Design['zones'] {
  const out: Design['zones'] = {}
  if (!raw || typeof raw !== 'object') return out
  const src = raw as Record<string, unknown>
  for (const id of PAINT_ZONE_IDS) {
    const z = src[id] as Record<string, unknown> | undefined
    const color = z && typeof z.color === 'string' ? normalizeHex(z.color) : null
    if (color) out[id] = { color, pattern: pattern(z!.pattern) }
  }
  return out
}
