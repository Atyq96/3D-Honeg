import type { PlacementId, RegionId, Side } from '../garments/types'
import { DEFAULT_GARMENT_ID, GARMENTS } from '../garments/catalog'
import { DEFAULT_BODY_COLOR } from '../config/palette'
import { normalizeHex } from '../lib/color'
import { getPattern } from '../patterns/library'

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

export interface Design {
  version: 1
  productId: string
  colors: {
    body: string
    /** null = follows the body colour. */
    sleeves: string | null
    collar: string | null
  }
  logo: LogoAsset | null
  placement: LogoPlacement
  /** All-over print per colour zone (null = plain fabric). */
  patterns: Record<RegionId, PatternFill | null>
}

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
    logo: null,
    placement: { ...DEFAULT_PLACEMENT },
    patterns: { ...NO_PATTERNS },
  }
}

export function resolvedColor(colors: Design['colors'], region: RegionId): string {
  if (region === 'body') return colors.body
  return colors[region] ?? colors.body
}

export function logoAspect(design: Design): number {
  return design.logo ? design.logo.width / design.logo.height : 1
}

const PLACEMENTS: PlacementId[] = ['leftChest', 'centerChest', 'rightChest', 'upperBack', 'centerBack']

/**
 * Validates untrusted JSON (imported file or localStorage) into a Design.
 * Throws an Error with a user-facing message when the shape is wrong.
 */
export function parseDesign(raw: unknown): Design {
  const fail = (msg: string): never => {
    throw new Error(`This file isn't a valid HONEG design: ${msg}`)
  }
  if (!raw || typeof raw !== 'object') fail('expected a JSON object.')
  const d = raw as Record<string, unknown>
  if (d.version !== 1) fail('unsupported version.')
  if (typeof d.productId !== 'string') fail('missing product.')
  // Products come and go as models change; carry the design over to the default product.
  const productId = GARMENTS.some((g) => g.id === d.productId) ? (d.productId as string) : DEFAULT_GARMENT_ID

  const c = (d.colors ?? {}) as Record<string, unknown>
  const body = typeof c.body === 'string' ? normalizeHex(c.body) : null
  if (!body) fail('invalid body color.')
  const optional = (v: unknown, name: string) => {
    if (v === null || v === undefined) return null
    const hex = typeof v === 'string' ? normalizeHex(v) : null
    return hex ?? fail(`invalid ${name} color.`)
  }

  let logo: LogoAsset | null = null
  if (d.logo) {
    const l = d.logo as Record<string, unknown>
    if (typeof l.dataUrl !== 'string' || !/^data:image\/(png|jpeg);base64,/.test(l.dataUrl)) fail('logo must be an embedded PNG or JPEG image.')
    if (typeof l.width !== 'number' || typeof l.height !== 'number' || l.width <= 0 || l.height <= 0) fail('logo size is missing.')
    logo = {
      dataUrl: l.dataUrl as string,
      name: typeof l.name === 'string' ? l.name.slice(0, 120) : 'logo.png',
      width: l.width as number,
      height: l.height as number,
      bytes: typeof l.bytes === 'number' ? l.bytes : 0,
      mime: typeof l.mime === 'string' ? l.mime : 'image/png',
    }
  }

  const p = (d.placement ?? {}) as Record<string, unknown>
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  const placement: LogoPlacement = {
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
    colors: { body: body as string, sleeves: optional(c.sleeves, 'sleeve'), collar: optional(c.collar, 'collar') },
    logo,
    placement,
    patterns: { body: pattern(rawPatterns.body), sleeves: pattern(rawPatterns.sleeves), collar: pattern(rawPatterns.collar) },
  }
}
