import type { PlacementId, RegionId, Side } from '../garments/types'
import { DEFAULT_GARMENT_ID, GARMENTS } from '../garments/catalog'
import { DEFAULT_BODY_COLOR } from '../config/palette'
import { normalizeHex } from '../lib/color'
import { countLayers, getPatternType, isLayered, layerCount, SCALE_RANGE, type PatternType } from '../patterns'
import { getPreset, type Preset } from '../patterns/presets'
import { MAX_ARTWORK_BYTES } from '../patterns/importSvg'
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

/**
 * An all-over pattern on one zone: a generated sportswear pattern (or imported
 * artwork) whose layer 0 is the zone's fabric colour and whose layers 1…n are
 * `colors`. Type + seed + options regenerate it exactly.
 */
export interface PatternFill {
  /** Generator from src/patterns, or 'artwork' for imported vector art. */
  type: PatternType | 'artwork'
  /** Preset it was started from (names it), or null. */
  preset: string | null
  /** Ink colours for layers 1…n (layer 0 is the zone's fabric colour). */
  colors: string[]
  /** Layout seed; "Shuffle" changes it. */
  seed: number
  /** Generator feature size, 0.5–2. */
  scale: number
  /** Generator direction, degrees (types that have one). */
  direction: number
  /** Generator detail, 0–1. */
  density: number
  /** Printed width of one pattern repeat, cm. */
  sizeCm: number
  /** Rotation on the garment, clockwise, degrees. */
  angle: number
  /** 0.1–1: inks over the fabric colour. */
  opacity: number
  /** Imported artwork only: the layered SVG with its original colours. */
  art?: string
}

export const PATTERN_SIZE_CM: [number, number] = [10, 100]
export const NO_PATTERNS: Design['patterns'] = { body: null, sleeves: null, collar: null }

/**
 * Keeps pattern values in range and fits the colour list to the layers the
 * pattern has; returns null for unknown types, bad colours or invalid artwork.
 */
export function cleanPatternFill(p: PatternFill): PatternFill | null {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo))
  const colors = p.colors.map((c) => normalizeHex(c))
  if (!colors.length || colors.some((c) => !c)) return null
  let inks: number
  if (p.type === 'artwork') {
    if (typeof p.art !== 'string' || p.art.length > MAX_ARTWORK_BYTES || !isLayered(p.art)) return null
    inks = countLayers(p.art) - 1
  } else {
    const def = getPatternType(p.type)
    if (!def) return null
    inks = layerCount(def, colors.length + 1) - 1
  }
  if (inks < 1) return null
  const wrapDeg = (v: number) => ((((Math.round(Number.isFinite(v) ? v : 0) + 180) % 360) + 360) % 360) - 180
  return {
    type: p.type,
    preset: typeof p.preset === 'string' && getPreset(p.preset)?.type === p.type ? p.preset : null,
    // Missing colours repeat the given ones; extra ones are dropped.
    colors: Array.from({ length: inks }, (_, i) => colors[i % colors.length]!),
    seed: Math.max(1, Math.round(clamp(p.seed, 1, 2147483646))),
    scale: Math.round(clamp(p.scale, ...SCALE_RANGE) * 100) / 100,
    direction: wrapDeg(p.direction),
    density: Math.round(clamp(p.density, 0, 1) * 100) / 100,
    sizeCm: Math.round(clamp(p.sizeCm, ...PATTERN_SIZE_CM) * 10) / 10,
    angle: wrapDeg(p.angle),
    opacity: Math.round(clamp(p.opacity, 0.1, 1) * 100) / 100,
    ...(p.type === 'artwork' ? { art: p.art } : {}),
  }
}

/** A preset as a fill, plus the fabric colour it's designed on (its layer 0). */
export function presetFill(preset: Preset): { fill: PatternFill; base: string } {
  return {
    fill: {
      type: preset.type,
      preset: preset.id,
      colors: preset.colors.slice(1),
      seed: preset.seed,
      scale: preset.scale ?? 1,
      direction: preset.angle ?? getPatternType(preset.type)!.defaultAngle,
      density: preset.density ?? 0.5,
      sizeCm: preset.sizeCm,
      angle: 0,
      opacity: 1,
    },
    base: preset.colors[0],
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

  // Patterns were added later too; unknown types (including the retired
  // one-colour motif library) are dropped rather than rejected.
  const rawPatterns = (d.patterns ?? {}) as Record<string, unknown>
  const pattern = (v: unknown): PatternFill | null => {
    if (!v || typeof v !== 'object') return null
    const f = v as Record<string, unknown>
    if (typeof f.type !== 'string' || !Array.isArray(f.colors) || !f.colors.every((c) => typeof c === 'string')) return null
    return cleanPatternFill({
      type: f.type as PatternFill['type'],
      preset: typeof f.preset === 'string' ? f.preset : null,
      colors: f.colors as string[],
      seed: num(f.seed, 1),
      scale: num(f.scale, 1),
      direction: num(f.direction, 0),
      density: num(f.density, 0.5),
      sizeCm: num(f.sizeCm, 50),
      angle: num(f.angle, 0),
      opacity: num(f.opacity, 1),
      ...(typeof f.art === 'string' ? { art: f.art } : {}),
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
