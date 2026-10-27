import type { RegionId } from '../garments/types'
import type { Design, PatternFill } from '../state/design'
import { getPattern } from './library'
import { num } from '../lib/format'
import { t } from '../i18n'
import { patternName } from '../i18n/labels'


/** e.g. "Houndstooth #0E0E0E · 2.5 cm · 15°". */
export function describeFill(fill: PatternFill): string {
  const extras = [`${num(fill.sizeCm)} cm`, `${fill.angle}°`]
  if (fill.opacity < 1) extras.push(t().pattern.opacityPct(Math.round(fill.opacity * 100)))
  return `${patternName(fill.id)} ${fill.color} · ${extras.join(' · ')}`
}

/** One human-readable line per patterned zone, e.g. "Body — Houndstooth #0E0E0E · 2.5 cm · 15°". */
export function describePatterns(patterns: Design['patterns'], regions: RegionId[]): { zone: RegionId; label: string; text: string }[] {
  return regions.flatMap((zone) => {
    const fill = patterns[zone]
    const def = fill ? getPattern(fill.id) : undefined
    if (!fill || !def) return []
    return [{ zone, label: t().zones.items[zone].label, text: describeFill(fill) }]
  })
}
