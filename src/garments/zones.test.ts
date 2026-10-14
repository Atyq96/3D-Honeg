import { describe, expect, it } from 'vitest'
import { getGarment } from './catalog'
import { inZone, zonePolygons, type PaintZoneDef, type PaintZoneId } from './zones'
import type { V2 } from './flat/geom2d'

const zone = (id: PaintZoneId): PaintZoneDef => getGarment('raglan').paintZones.find((z) => z.id === id)!
const xs = (polys: V2[][]) => polys.flat().map(([x]) => x)

describe('paint zones in 3D (garment space)', () => {
  it('splits left and right at the centre line (x = wearer’s left on the front)', () => {
    expect(inZone(zone('halfLeft'), [0.1, 0.3, 0.1])).toBe(true)
    expect(inZone(zone('halfLeft'), [-0.1, 0.3, 0.1])).toBe(false)
    expect(inZone(zone('halfRight'), [-0.1, 0.3, -0.1])).toBe(true)
  })

  it('splits front and back along the side seam, which leans back at the shoulders', () => {
    expect(inZone(zone('front'), [0, 0.3, 0.12])).toBe(true)
    expect(inZone(zone('back'), [0, 0.3, -0.14])).toBe(true)
    // Front of the neck sits at z ≈ 0.01 but is still front.
    expect(inZone(zone('front'), [0, 0.68, 0.01])).toBe(true)
  })

  it('mirrors side panels and the centre stripe on both sides', () => {
    expect(inZone(zone('sidePanels'), [0.17, 0.3, 0])).toBe(true)
    expect(inZone(zone('sidePanels'), [-0.17, 0.3, 0])).toBe(true)
    expect(inZone(zone('sidePanels'), [0.05, 0.3, 0])).toBe(false)
    expect(inZone(zone('centerStripe'), [-0.03, 0.3, 0.1])).toBe(true)
    expect(inZone(zone('centerStripe'), [0.06, 0.3, 0.1])).toBe(false)
  })

  it('bands are limited in height, and the sash is front-only', () => {
    expect(inZone(zone('chestBand'), [0, 0.43, 0.1])).toBe(true)
    expect(inZone(zone('chestBand'), [0, 0.5, 0.1])).toBe(false)
    expect(inZone(zone('sash'), [0, 0.33, 0.1])).toBe(true)
    expect(inZone(zone('sash'), [0, 0.33, -0.14])).toBe(false)
  })
})

describe('paint zones on the flats (view space)', () => {
  it('mirrors left/right on the back view', () => {
    const front = xs(zonePolygons(zone('halfLeft'), 'front'))
    const back = xs(zonePolygons(zone('halfLeft'), 'back'))
    expect(Math.min(...front)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...back)).toBeLessThanOrEqual(0)
  })

  it('shows front-only zones on the front flat only', () => {
    expect(zonePolygons(zone('front'), 'front')).toHaveLength(1)
    expect(zonePolygons(zone('front'), 'back')).toEqual([])
    expect(zonePolygons(zone('back'), 'front')).toEqual([])
    expect(zonePolygons(zone('sash'), 'back')).toEqual([])
  })

  it('draws mirrored zones as two polygons', () => {
    const panels = zonePolygons(zone('sidePanels'), 'front')
    expect(panels).toHaveLength(2)
    expect(Math.min(...xs([panels[0]]))).toBeCloseTo(0.13)
    expect(Math.max(...xs([panels[1]]))).toBeCloseTo(-0.13)
  })

  it('clips bands to their height', () => {
    const ys = zonePolygons(zone('hemBand'), 'back').flat().map(([, y]) => y)
    expect(Math.max(...ys)).toBeCloseTo(0.06)
  })
})
