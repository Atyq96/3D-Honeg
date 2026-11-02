import { bands } from './generators/bands'
import { chevrons } from './generators/chevrons'
import { digitalCamo } from './generators/digitalCamo'
import { elevation } from './generators/elevation'
import { halftone } from './generators/halftone'
import { lowPoly } from './generators/lowPoly'
import { shards } from './generators/shards'
import { speedLines } from './generators/speedLines'
import { topo } from './generators/topo'
import { waves } from './generators/waves'
import { clamp } from './math'
import { createRng, mixSeed } from './rng'
import { buildSvg, recolor } from './svg'
import type { PatternType, PatternTypeDef } from './types'

/** Every pattern type, in library order. */
export const PATTERN_TYPES: PatternTypeDef[] = [shards, lowPoly, digitalCamo, chevrons, speedLines, bands, topo, elevation, waves, halftone]
const BY_ID = new Map(PATTERN_TYPES.map((t) => [t.id, t]))

export const getPatternType = (id: string): PatternTypeDef | undefined => BY_ID.get(id as PatternType)
export const isPatternType = (id: unknown): id is PatternType => typeof id === 'string' && BY_ID.has(id as PatternType)

export interface PatternOptions {
  /** Layer colours, base first (#RRGGBB). Extra colours beyond the type's maximum are ignored. */
  colors: readonly string[]
  seed: number
  /** Feature size, 0.5–2. Default 1. */
  scale?: number
  /** Main direction in degrees (types that have one). Default: the type's own. */
  angle?: number
  /** Amount of detail, 0–1. Default 0.5. */
  density?: number
}

export interface GeneratedPattern {
  svg: string
  layers: number
}

export const SCALE_RANGE: [number, number] = [0.5, 2]

/** "#abc" / "abc" / "#AABBCC" → "#AABBCC"; anything else → null. */
export function normalizeColor(raw: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim())
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return `#${h.toUpperCase()}`
}

/** Clamped, rounded options — exactly what the geometry depends on. */
export function normalizeOptions(type: PatternTypeDef, opts: Omit<PatternOptions, 'colors'>) {
  const num = (v: number | undefined, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  return {
    seed: Math.max(0, Math.round(num(opts.seed, 1))) >>> 0,
    scale: Math.round(clamp(num(opts.scale, 1), ...SCALE_RANGE) * 100) / 100,
    angle: ((((Math.round(num(opts.angle, type.defaultAngle)) + 180) % 360) + 360) % 360) - 180,
    density: Math.round(clamp(num(opts.density, 0.5), 0, 1) * 100) / 100,
  }
}

/** Colour layers the type will use for this many colours (3–6, within the type's range). */
export const layerCount = (type: PatternTypeDef, colors: number) => clamp(colors, type.minLayers, type.maxLayers)

/** Geometry is cached with neutral colours, so a colour change is just a cheap recolour. */
const GEOMETRY = new Map<string, string>()
const GEOMETRY_LIMIT = 48
const NEUTRAL = ['#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF']

/** Forgets cached geometry (tests use it to prove a fresh generation gives the same SVG). */
export const clearPatternCache = () => GEOMETRY.clear()

/**
 * Builds a pattern: a seamless 1000 × 1000 SVG tile with one `<g data-layer>`
 * per colour. The same type, seed and options always give the same SVG.
 */
export function generatePattern(type: PatternType, opts: PatternOptions): GeneratedPattern {
  const def = BY_ID.get(type)
  if (!def) throw new Error(`Unknown pattern type "${type}"`)
  const given = opts.colors.map((c) => normalizeColor(c))
  if (!given.length || given.some((c) => !c)) throw new Error('Pattern colours must be hex colours like #1F5BD8')
  const layers = layerCount(def, given.length)
  // Too few colours: repeat them (a design still needs every layer drawn).
  const colors = Array.from({ length: layers }, (_, i) => given[i % given.length]!)
  const o = normalizeOptions(def, opts)
  const key = [type, o.seed, o.scale, o.angle, o.density, layers].join('|')

  let neutral = GEOMETRY.get(key)
  if (neutral) {
    GEOMETRY.delete(key) // refresh its place in the LRU order
  } else {
    const rng = createRng(mixSeed(o.seed, type))
    const art = def.generate({ rng, inks: layers - 1, scale: o.scale, angle: o.angle, density: o.density })
    neutral = buildSvg({ type, seed: o.seed }, NEUTRAL.slice(0, layers), art)
    if (GEOMETRY.size >= GEOMETRY_LIMIT) GEOMETRY.delete(GEOMETRY.keys().next().value!)
  }
  GEOMETRY.set(key, neutral)
  return { svg: recolor(neutral, colors), layers }
}
