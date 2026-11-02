import type { GarmentDefinition, RegionId } from './types'
import { inZone, ZONE_INFO, type PaintZoneId, type ZoneGroup, type ZoneId } from './zones'

export interface PickInput {
  garment: GarmentDefinition
  /** Zones the user can select on this product and model. */
  zones: ZoneId[]
  /** Painted zones (`design.zones`): what's visible on top of the parts. */
  painted: Partial<Record<PaintZoneId, unknown>>
  /** The part that was hit, and where (garment space). */
  part: RegionId
  point: [number, number, number]
  /** The zone picker's open tab. */
  group: ZoneGroup
  /** The zone currently selected. */
  current: ZoneId
}

/**
 * Every zone under a point on the garment, in the order a click offers them:
 * painted zones first (topmost first — what's visible there), then the open
 * picker tab's zones (the part before unpainted areas), then the part itself.
 */
export function zonesAt({ garment, zones, painted, part, point, group }: Omit<PickInput, 'current'>): ZoneId[] {
  const available = new Set(zones)
  const contains = (id: PaintZoneId) => {
    const def = garment.paintZones.find((z) => z.id === id)
    return !!def && def.parts.includes(part) && inZone(def, point)
  }
  const here = garment.paintZones.filter((z) => available.has(z.id) && contains(z.id)).map((z) => z.id)
  const visible = here.filter((id) => painted[id]).reverse()
  const tab = [...(available.has(part) && ZONE_INFO[part].group === group ? [part] : []), ...here.filter((id) => ZONE_INFO[id].group === group && !painted[id])]
  const out = [...visible, ...tab, ...(available.has(part) ? [part] : [])]
  return out.filter((z, i) => out.indexOf(z) === i)
}

/**
 * The zone a click on the garment selects. Clicking the same spot again steps
 * through the overlapping zones there (Sleeves → Left sleeve → Sleeves…), so
 * every zone can be reached from the model; the hover label previews it.
 */
export function pickZone(input: PickInput): ZoneId | null {
  const options = zonesAt(input)
  if (!options.length) return null
  const i = options.indexOf(input.current)
  return i < 0 ? options[0] : options[(i + 1) % options.length]
}
