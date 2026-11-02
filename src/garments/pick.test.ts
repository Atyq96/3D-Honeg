import { describe, expect, it } from 'vitest'
import { getGarment } from './catalog'
import { pickZone, zonesAt } from './pick'
import { availableZones } from '../state/useColorRegions'
import type { RegionId } from './types'
import type { PaintZoneId, ZoneGroup, ZoneId } from './zones'

const garment = getGarment('raglan')
const zones = availableZones('raglan', ['body', 'sleeves', 'collar'])
/** Points in garment space (m): x to the viewer's right on the front, y up from the hem, z forward. */
const CHEST_LEFT: [number, number, number] = [0.08, 0.45, 0.1]
const LEFT_SLEEVE: [number, number, number] = [0.3, 0.55, 0.02]
const LOW_BACK: [number, number, number] = [-0.05, 0.1, -0.1]

const pick = (part: RegionId, point: [number, number, number], group: ZoneGroup = 'parts', current: ZoneId = 'body', painted: Partial<Record<PaintZoneId, unknown>> = {}) =>
  pickZone({ garment, zones, painted, part, point, group, current })

describe('picking zones on the 3D garment', () => {
  it('selects the part under the pointer from the Parts tab', () => {
    expect(pick('sleeves', LEFT_SLEEVE)).toBe('sleeves')
    expect(pick('collar', [0, 0.7, 0.05])).toBe('collar')
    expect(pick('body', CHEST_LEFT, 'parts', 'sleeves')).toBe('body')
  })

  it('clicking again steps through the zones under the pointer', () => {
    // Sleeves → the single sleeve there → back to Sleeves.
    expect(pick('sleeves', LEFT_SLEEVE, 'parts', 'sleeves')).toBe('sleeveLeft')
    expect(pick('sleeves', LEFT_SLEEVE, 'parts', 'sleeveLeft')).toBe('sleeves')
  })

  it('offers the open tab’s areas, painted or not', () => {
    expect(zonesAt({ garment, zones, painted: {}, part: 'body', point: CHEST_LEFT, group: 'halves' })).toEqual(['halfLeft', 'halfTop', 'body'])
    expect(pick('body', CHEST_LEFT, 'halves')).toBe('halfLeft')
    expect(pick('body', CHEST_LEFT, 'halves', 'halfLeft')).toBe('halfTop')
    expect(pick('body', LOW_BACK, 'panels')).toBe('back')
    expect(pick('body', [0.1, 0.03, 0.1], 'stripes')).toBe('hemBand')
  })

  it('a painted area on top wins, whatever the tab — it’s what the user sees', () => {
    const painted = { halfBottom: { color: '#ED1C24' }, hemBand: { color: '#FFFFFF' } }
    // The hem band is printed over the bottom half, so it comes first.
    expect(zonesAt({ garment, zones, painted, part: 'body', point: [0, 0.03, 0.1], group: 'parts' })).toEqual(['hemBand', 'halfBottom', 'body'])
    expect(pick('body', [0, 0.2, 0.1], 'parts', 'body', painted)).toBe('halfBottom')
  })

  it('falls back to the part when the open tab has nothing there', () => {
    // No stripe on the upper sleeve.
    expect(pick('sleeves', [0.3, 0.62, 0.02], 'stripes')).toBe('sleeves')
  })

  it('never offers zones the model can’t show', () => {
    const bodyOnly = availableZones('raglan', ['body'])
    expect(pickZone({ garment, zones: bodyOnly, painted: {}, part: 'sleeves', point: LEFT_SLEEVE, group: 'parts', current: 'body' })).toBeNull()
  })
})
