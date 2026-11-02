import type { Rng } from './rng'
import type { LayerArt } from './svg'

export type PatternType = 'shards' | 'lowPoly' | 'digitalCamo' | 'chevrons' | 'speedLines' | 'bands' | 'topo' | 'elevation' | 'waves' | 'halftone'

/** What a generator gets. Layer 0 (the base colour) is drawn for it; it returns the `inks` layers above. */
export interface GenContext {
  rng: Rng
  /** Number of ink layers to return (total layers − 1). */
  inks: number
  /** Feature size, 0.5–2 (1 = as designed). */
  scale: number
  /** Main direction, degrees counter-clockwise as seen. */
  angle: number
  /** Amount of detail, 0–1. */
  density: number
}

export interface PatternTypeDef {
  id: PatternType
  /** Colour layers it can use, base included (3–6). */
  minLayers: number
  maxLayers: number
  /** Which options change this type's geometry (the configurator only shows those). */
  uses: { scale: boolean; angle: boolean; density: boolean }
  defaultAngle: number
  /** One entry per ink layer, bottom to top. Must not depend on colours. */
  generate: (ctx: GenContext) => LayerArt[]
}
