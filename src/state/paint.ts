import type { RegionId } from '../garments/types'
import { getGarment } from '../garments/catalog'
import { brandPlacement } from '../garments/brand'
import { inZone, isPaintZone, type PaintZoneId, type ZoneId } from '../garments/zones'
import { presetName } from '../config/palette'
import { t } from '../i18n'
import { describeFill } from '../patterns/describe'
import { resolvedColor, type Design, type ZonePaint } from './design'

/** What a zone shows: parts always (through "match body"); paint zones only once painted. */
export function zonePaint(design: Design, zone: ZoneId): ZonePaint | null {
  if (!isPaintZone(zone)) return { color: resolvedColor(design.colors, zone), pattern: design.patterns[zone] }
  return design.zones[zone] ?? null
}

/** Fabric colour at a garment-space point on a part: the topmost painted zone there, else the part's colour. */
export function fabricColorAt(design: Pick<Design, 'productId' | 'colors' | 'zones'>, part: RegionId, point: [number, number, number]): string {
  let color = resolvedColor(design.colors, part)
  for (const def of getGarment(design.productId).paintZones) {
    const paint = design.zones[def.id]
    if (paint && def.parts.includes(part) && inZone(def, point)) color = paint.color
  }
  return color
}

/** Chest surface depth in front of the garment's centre, metres (where front prints sit). */
const CHEST_Z = 0.1

/** The fabric under the brand mark, which decides its "Auto" ink. */
export function brandFabric(design: Pick<Design, 'productId' | 'colors' | 'zones' | 'brand'>): string {
  const { center } = brandPlacement(getGarment(design.productId), design.brand)
  return fabricColorAt(design, 'body', [center[0], center[1], CHEST_Z])
}

/** One line per painted zone, in print order, e.g. "Écharpe — Rouge course #ED1C24" or "Moitié basse — Craie #F6F5F2 · Fines rayures …". */
export function describeZones(design: Pick<Design, 'productId' | 'zones'>): { zone: PaintZoneId; label: string; text: string }[] {
  return getGarment(design.productId).paintZones.flatMap((z) => {
    const paint = design.zones[z.id]
    if (!paint) return []
    const color = `${presetName(paint.color) ?? t().common.custom} ${paint.color}`
    return [{ zone: z.id, label: t().zones.items[z.id].label, text: paint.pattern ? `${color} · ${describeFill(paint.pattern)}` : color }]
  })
}
