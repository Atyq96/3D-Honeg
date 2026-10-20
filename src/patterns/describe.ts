import type { RegionId } from '../garments/types'
import type { Design, PatternFill } from '../state/design'
import { getPattern } from './library'
import { fr } from '../lib/format'

const ZONE: Record<RegionId, string> = { body: 'Corps', sleeves: 'Manches', collar: 'Col' }

/** e.g. "Pied-de-poule #0E0E0E · 2,5 cm · 15°". */
export function describeFill(fill: PatternFill): string {
  const def = getPattern(fill.id)
  const extras = [`${fr(fill.sizeCm)} cm`, `${fill.angle}°`]
  if (fill.opacity < 1) extras.push(`opacité ${Math.round(fill.opacity * 100)} %`)
  return `${def?.name ?? fill.id} ${fill.color} · ${extras.join(' · ')}`
}

/** One human-readable line per patterned zone, e.g. "Corps — Pied-de-poule #0E0E0E · 2,5 cm · 15°". */
export function describePatterns(patterns: Design['patterns'], regions: RegionId[]): { zone: RegionId; label: string; text: string }[] {
  return regions.flatMap((zone) => {
    const fill = patterns[zone]
    const def = fill ? getPattern(fill.id) : undefined
    if (!fill || !def) return []
    return [{ zone, label: ZONE[zone], text: describeFill(fill) }]
  })
}
