import { getPalette } from './palettes'
import type { PatternType } from './types'

/**
 * Ready-made designs: the configurator's pattern library, grouped by sport.
 * Each is a type + colours + seed + options, so it regenerates exactly. Names
 * come from the i18n dictionaries ("type · palette").
 */
export type Sport = 'cycling' | 'triathlon' | 'running' | 'multisport'
export const SPORTS: Sport[] = ['cycling', 'triathlon', 'running', 'multisport']

export interface Preset {
  id: string
  sport: Sport
  type: PatternType
  /** Palette the colours come from (names the preset). */
  palette: string
  /** Layer colours, base first. */
  colors: string[]
  seed: number
  scale?: number
  density?: number
  /** Generator direction (types with one). */
  angle?: number
  /** Printed width of one repeat, cm. */
  sizeCm: number
}

/** Palette colours in the given order (indices into the palette, base first). */
function from(palette: string, order: number[]): string[] {
  const p = getPalette(palette)
  if (!p) throw new Error(`Unknown palette ${palette}`)
  return order.map((i) => p.colors[i])
}

const preset = (sport: Sport, type: PatternType, palette: string, order: number[], seed: number, sizeCm: number, opts: Pick<Preset, 'scale' | 'density' | 'angle'> = {}): Preset => ({
  id: `${type}-${palette}`,
  sport,
  type,
  palette,
  colors: from(palette, order),
  seed,
  sizeCm,
  ...opts,
})

export const PRESETS: Preset[] = [
  // Cycling
  preset('cycling', 'bands', 'peloton', [0, 1, 2, 3, 4], 11, 80, { density: 0.7 }),
  preset('cycling', 'bands', 'breakaway', [0, 1, 2, 3], 5, 80, { density: 0.2 }),
  preset('cycling', 'bands', 'tricolore', [0, 1, 2, 3, 4], 31, 80, { density: 0.8 }),
  preset('cycling', 'elevation', 'glacier', [0, 3, 2, 1, 4], 8, 80, { density: 0.5 }),
  preset('cycling', 'topo', 'peloton', [0, 4, 1, 2], 21, 45, { density: 0.45 }),
  preset('cycling', 'shards', 'breakaway', [0, 4, 1, 2, 3], 17, 55),
  preset('cycling', 'chevrons', 'tricolore', [0, 3, 1, 2, 4], 4, 60, { angle: 27 }),
  preset('cycling', 'lowPoly', 'glacier', [0, 3, 2, 1], 12, 50),
  // Triathlon
  preset('triathlon', 'waves', 'lagoon', [0, 1, 2, 3, 4], 9, 60, { density: 0.55 }),
  preset('triathlon', 'waves', 'glacier', [1, 2, 3, 0], 14, 55, { density: 0.4 }),
  preset('triathlon', 'halftone', 'lagoon', [0, 1, 2, 3], 6, 60),
  preset('triathlon', 'speedLines', 'lagoon', [0, 1, 4, 2], 3, 60),
  preset('triathlon', 'chevrons', 'volt', [0, 1, 4, 2], 10, 55, { angle: 45 }),
  preset('triathlon', 'lowPoly', 'sunset', [0, 4, 1, 2, 3], 23, 50),
  preset('triathlon', 'shards', 'lagoon', [0, 1, 2, 3, 4], 29, 55),
  // Running
  preset('running', 'shards', 'electric', [0, 2, 3, 1, 4], 7, 55),
  preset('running', 'shards', 'volt', [0, 3, 2, 1, 4], 13, 55, { density: 0.6 }),
  preset('running', 'shards', 'sunset', [0, 4, 1, 2, 3], 19, 55),
  preset('running', 'speedLines', 'electric', [0, 2, 1, 3], 5, 60, { density: 0.8 }),
  preset('running', 'halftone', 'volt', [0, 1, 2], 15, 55),
  preset('running', 'digitalCamo', 'graphite', [0, 3, 2, 4, 1], 27, 45),
  preset('running', 'chevrons', 'sunset', [0, 1, 2, 3, 4], 2, 60, { angle: 0, scale: 0.6 }),
  preset('running', 'lowPoly', 'electric', [2, 0, 3, 1, 4], 33, 50),
  // Multisport
  preset('multisport', 'digitalCamo', 'trail', [0, 3, 2, 1, 4], 18, 45),
  preset('multisport', 'digitalCamo', 'volt', [0, 1, 4, 3], 22, 45),
  preset('multisport', 'topo', 'graphite', [1, 2, 4, 3], 26, 45, { density: 0.55 }),
  preset('multisport', 'elevation', 'trail', [0, 3, 2, 1, 4], 16, 80, { density: 0.6 }),
  preset('multisport', 'elevation', 'sunset', [0, 4, 1, 2, 3], 24, 80, { density: 0.15 }),
  preset('multisport', 'halftone', 'graphite', [0, 1, 2, 3], 20, 60),
  preset('multisport', 'waves', 'volt', [0, 3, 2, 1, 4], 28, 60, { density: 0.6 }),
]

const BY_ID = new Map(PRESETS.map((p) => [p.id, p]))
export const getPreset = (id: string): Preset | undefined => BY_ID.get(id)
