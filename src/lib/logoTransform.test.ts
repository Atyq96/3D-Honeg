import { describe, expect, it } from 'vitest'
import { alignOffsets, clampTransform, describeLook, maxWidthCm, offsetRange, rotatedExtents, snapCenter, snapRotation } from './logoTransform'

const area = { xMin: -0.2, xMax: 0.2, yMin: 0.1, yMax: 0.6 }

describe('rotatedExtents', () => {
  it('swaps width and height at 90°', () => {
    const [w, h] = rotatedExtents(0.2, 2, 90)
    expect(w).toBeCloseTo(0.1)
    expect(h).toBeCloseTo(0.2)
  })
})

describe('maxWidthCm', () => {
  it('is limited by the area width for wide logos', () => {
    expect(maxWidthCm(area, 4, 0)).toBe(34) // area allows 40 cm, global cap is 34
    expect(maxWidthCm({ ...area, xMin: -0.1, xMax: 0.1 }, 4, 0)).toBe(20)
  })
  it('is limited by the area height for tall logos', () => {
    expect(maxWidthCm(area, 0.25, 0)).toBe(12.5)
  })
})

describe('clampTransform', () => {
  it('keeps a logo inside the print area', () => {
    const t = clampTransform({ widthCm: 10, rotationDeg: 0, offsetXCm: 50, offsetYCm: -50 }, 1, area, [0.1, 0.5])
    // centre may go at most to xMax - 5cm = 15cm → offset 5cm from the 10cm anchor
    expect(t.offsetXCm).toBe(5)
    // centre may go at least to yMin + 5cm = 15cm → offset -35cm from the 50cm anchor
    expect(t.offsetYCm).toBe(-35)
  })

  it('shrinks oversized logos before positioning', () => {
    const t = clampTransform({ widthCm: 80, rotationDeg: 0, offsetXCm: 0, offsetYCm: 0 }, 1, area, [0, 0.35])
    expect(t.widthCm).toBe(34)
  })

  it('enforces a minimum size and normalises rotation', () => {
    const t = clampTransform({ widthCm: 0.5, rotationDeg: 270, offsetXCm: 0, offsetYCm: 0 }, 1, area, [0, 0.35])
    expect(t.widthCm).toBe(3)
    expect(t.rotationDeg).toBe(-90)
  })

  it('agrees with offsetRange', () => {
    const base = { widthCm: 12, rotationDeg: 30, offsetXCm: 0, offsetYCm: 0 }
    const range = offsetRange(base, 1.5, area, [0.05, 0.45])
    const t = clampTransform({ ...base, offsetXCm: 999, offsetYCm: 999 }, 1.5, area, [0.05, 0.45])
    expect(t.offsetXCm).toBe(range.x[1])
    expect(t.offsetYCm).toBe(range.y[1])
  })
})

describe('direct manipulation helpers', () => {
  it('snaps rotation to 45 degree steps within 8 degrees', () => {
    expect(snapRotation(40)).toBe(45)
    expect(snapRotation(52)).toBe(45)
    expect(snapRotation(60)).toBe(60)
    expect(snapRotation(-87)).toBe(-90)
  })

  it('snaps the centre to the print-area centre line and reports a guide', () => {
    const r = snapCenter([0.004, 0.3], [0.1, 0.1], area, 0.008)
    expect(r.center[0]).toBe(0)
    expect(r.guides.x).toEqual([0])
    expect(r.guides.y).toEqual([])
  })

  it('snaps an edge onto the print-area edge', () => {
    const r = snapCenter([0.146, 0.3], [0.1, 0.1], area, 0.008)
    expect(r.center[0]).toBeCloseTo(0.15)
    expect(r.guides.x).toEqual([0.2])
  })

  it('leaves free positions alone', () => {
    const r = snapCenter([0.07, 0.25], [0.1, 0.1], area, 0.008)
    expect(r.center).toEqual([0.07, 0.25])
    expect(r.guides).toEqual({ x: [], y: [] })
  })

  it('aligns to the nine print-area positions', () => {
    const t = { widthCm: 10, rotationDeg: 0, offsetXCm: 0, offsetYCm: 0 }
    expect(alignOffsets(t, 1, area, [0.05, 0.4], 'left', 'top')).toEqual({ offsetXCm: -20, offsetYCm: 15 })
    expect(alignOffsets(t, 1, area, [0.05, 0.4], 'center', 'center')).toEqual({ offsetXCm: -5, offsetYCm: -5 })
    expect(alignOffsets(t, 1, area, [0.05, 0.4], 'right', 'bottom')).toEqual({ offsetXCm: 10, offsetYCm: -25 })
  })

  it('describes appearance tweaks', () => {
    expect(describeLook({ flipX: true, flipY: false, tint: '#FFFFFF', opacity: 0.8, locked: true })).toBe(
      'flipped horizontally · fill #FFFFFF · 80% opacity · locked',
    )
    expect(describeLook({ flipX: false, flipY: false, tint: null, opacity: 1, locked: false })).toBe('')
  })
})

describe('keep-out zone (HONEG mark)', () => {
  const keepOut = { xMin: 0.05, xMax: 0.12, yMin: 0.45, yMax: 0.5 }
  const overlaps = (t: { widthCm: number; offsetXCm: number; offsetYCm: number }, anchor: [number, number], aspect = 1) => {
    const w = t.widthCm / 100, h = w / aspect
    const cx = anchor[0] + t.offsetXCm / 100, cy = anchor[1] + t.offsetYCm / 100
    return cx + w / 2 > keepOut.xMin && cx - w / 2 < keepOut.xMax && cy + h / 2 > keepOut.yMin && cy - h / 2 < keepOut.yMax
  }

  it('leaves logos that already clear it untouched', () => {
    const t = { widthCm: 8, rotationDeg: 0, offsetXCm: 0, offsetYCm: 0 }
    expect(clampTransform(t, 1, area, [-0.1, 0.475], keepOut)).toEqual(t)
  })

  it('moves an overlapping logo to the nearest clear position', () => {
    const t = clampTransform({ widthCm: 8, rotationDeg: 0, offsetXCm: 0, offsetYCm: 0 }, 1, area, [0.07, 0.475], keepOut)
    expect(overlaps(t, [0.07, 0.475])).toBe(false)
    expect(t.widthCm).toBe(8)
  })

  it('shrinks the logo only when no position inside the print area can clear it', () => {
    const narrow = { xMin: 0.02, xMax: 0.15, yMin: 0.42, yMax: 0.53 }
    const t = clampTransform({ widthCm: 10, rotationDeg: 0, offsetXCm: 0, offsetYCm: 0 }, 1, narrow, [0.085, 0.475], keepOut)
    expect(t.widthCm).toBeLessThan(10)
  })
})
