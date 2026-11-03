import type { RegionId } from '../garments/types'
import type { Design, PatternFill } from '../state/design'
import { num } from '../lib/format'
import { t } from '../i18n'
import { patternName } from '../i18n/labels'

/**
 * e.g. "Shards · Electric, layout #7 · #14234A #5FB3E8 #F2762E #0E0E12 · 55 cm · 15°".
 * With the zone's fabric colour (layer 0), that's everything needed to regenerate it.
 */
export function describeFill(fill: PatternFill): string {
  const extras = [fill.colors.join(' '), `${num(fill.sizeCm)} cm`, `${fill.angle}°`]
  if (fill.opacity < 1) extras.push(t().pattern.opacityPct(Math.round(fill.opacity * 100)))
  return `${patternName(fill)}, ${t().pattern.seed(fill.seed)} · ${extras.join(' · ')}`
}

/** One human-readable line per patterned zone, e.g. "Body — Shards · Electric, layout #7 · …". */
export function describePatterns(patterns: Design['patterns'], regions: RegionId[]): { zone: RegionId; label: string; text: string }[] {
  return regions.flatMap((zone) => {
    const fill = patterns[zone]
    if (!fill) return []
    return [{ zone, label: t().zones.items[zone].label, text: describeFill(fill) }]
  })
}
