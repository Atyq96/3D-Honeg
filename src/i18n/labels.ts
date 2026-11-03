import { t } from '.'
import { getPreset } from '../patterns/presets'
import type { PatternFill } from '../state/design'

/** Name of a palette colour in the current language, or null for a custom colour. */
export const colorName = (hex: string): string | null => t().palette[hex.toUpperCase()] ?? null

/** A preset's name in the current language, e.g. "Shards · Electric". */
export function presetLabel(id: string): string {
  const p = getPreset(id)
  if (!p) return id
  const m = t().pattern
  return m.presetName(m.types[p.type], m.palettes[p.palette] ?? p.palette)
}

/** A zone pattern's name: its preset, else its type. */
export function patternName(fill: Pick<PatternFill, 'type' | 'preset'>): string {
  return fill.preset ? presetLabel(fill.preset) : t().pattern.types[fill.type]
}
