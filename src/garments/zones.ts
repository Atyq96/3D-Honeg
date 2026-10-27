import type { RegionId, Side } from './types'
import type { V2 } from './flat/geom2d'

/**
 * Paint zones: areas cut across the garment's parts (halves, panels, stripes)
 * that take their own colour or pattern on top of the part colours.
 */
export type PaintZoneId =
  | 'front'
  | 'back'
  | 'halfLeft'
  | 'halfRight'
  | 'halfTop'
  | 'halfBottom'
  | 'sleeveLeft'
  | 'sleeveRight'
  | 'sidePanels'
  | 'yoke'
  | 'sash'
  | 'chestBand'
  | 'centerStripe'
  | 'hemBand'

/** Anything the Colors and Pattern steps can select: a whole part, or a paint zone. */
export type ZoneId = RegionId | PaintZoneId

export const REGION_IDS: RegionId[] = ['body', 'sleeves', 'collar']
export const PAINT_ZONE_IDS: PaintZoneId[] = [
  'front',
  'back',
  'halfLeft',
  'halfRight',
  'halfTop',
  'halfBottom',
  'sleeveLeft',
  'sleeveRight',
  'sidePanels',
  'yoke',
  'sash',
  'chestBand',
  'centerStripe',
  'hemBand',
]
export const isPaintZone = (z: ZoneId): z is PaintZoneId => !(REGION_IDS as string[]).includes(z)

/**
 * Half-space `nx·x + ny·y + nz·z ≥ d` in garment space: metres, hem at y = 0,
 * x towards the viewer's right on the front (the wearer's left), z forward.
 */
export type ZonePlane = [nx: number, ny: number, nz: number, d: number]

export interface PaintZoneDef {
  id: PaintZoneId
  /** Parts the zone paints over. */
  parts: RegionId[]
  /** All must hold. */
  planes: ZonePlane[]
  /** Planes test |x|, so the zone is mirrored on both sides (side panels, centre stripe). */
  absX?: boolean
}

export type ZoneGroup = 'parts' | 'panels' | 'halves' | 'stripes'

/** Picker tabs, in order; labels and hints come from the i18n dictionaries (`zones`). */
export const ZONE_GROUPS: ZoneGroup[] = ['parts', 'panels', 'halves', 'stripes']

/** Picker tab and thumbnail view of each zone. */
export const ZONE_INFO: Record<ZoneId, { group: ZoneGroup; view: Side }> = {
  body: { group: 'parts', view: 'front' },
  sleeves: { group: 'parts', view: 'front' },
  collar: { group: 'parts', view: 'front' },
  sleeveLeft: { group: 'parts', view: 'front' },
  sleeveRight: { group: 'parts', view: 'front' },
  front: { group: 'panels', view: 'front' },
  back: { group: 'panels', view: 'back' },
  sidePanels: { group: 'panels', view: 'front' },
  yoke: { group: 'panels', view: 'front' },
  halfLeft: { group: 'halves', view: 'front' },
  halfRight: { group: 'halves', view: 'front' },
  halfTop: { group: 'halves', view: 'front' },
  halfBottom: { group: 'halves', view: 'front' },
  chestBand: { group: 'stripes', view: 'front' },
  centerStripe: { group: 'stripes', view: 'front' },
  hemBand: { group: 'stripes', view: 'front' },
  sash: { group: 'stripes', view: 'front' },
}

const applies = (planes: ZonePlane[], x: number, y: number, z: number) => planes.every(([a, b, c, d]) => a * x + b * y + c * z >= d)

/** Whether a garment-space point lies in the zone (part membership is checked separately). */
export function inZone(def: PaintZoneDef, [x, y, z]: [number, number, number]): boolean {
  return applies(def.planes, def.absX ? Math.abs(x) : x, y, z)
}

/** Keeps the part of a polygon where `a·x + b·y ≥ c` (Sutherland–Hodgman). */
function clipPolygon(poly: V2[], a: number, b: number, c: number): V2[] {
  const out: V2[] = []
  const f = (p: V2) => a * p[0] + b * p[1] - c
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const fp = f(p)
    const fq = f(q)
    if (fp >= 0) out.push(p)
    if (fp >= 0 !== fq >= 0) {
      const t = fp / (fp - fq)
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
    }
  }
  return out
}

/**
 * The zone as polygons in a flat sketch's view space (x to the viewer's
 * right, y up), for clipping the 2D flats. Front-view points are taken as
 * z = +1 and back-view points as z = −1 with x mirrored, which is all the
 * front/back planes need.
 */
export function zonePolygons(def: PaintZoneDef, view: Side): V2[][] {
  const s = view === 'front' ? 1 : -1
  let poly: V2[] = [
    [-2, -1],
    [2, -1],
    [2, 2],
    [-2, 2],
  ]
  if (def.absX) poly = clipPolygon(poly, 1, 0, 0)
  for (const [nx, ny, nz, d] of def.planes) {
    // With |x| the zone is symmetric, so the view's mirroring doesn't matter.
    const a = def.absX ? nx : nx * s
    const c = d - nz * s
    if (a === 0 && ny === 0) {
      if (c > 0) return []
      continue
    }
    poly = clipPolygon(poly, a, ny, c)
    if (poly.length < 3) return []
  }
  return def.absX ? [poly, poly.map(([x, y]): V2 => [-x, y])] : [poly]
}
