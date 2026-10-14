import { beforeEach, describe, expect, it } from 'vitest'
import { useDesignStore } from './designStore'
import { createDefaultDesign, parseDesign, type LogoAsset } from './design'
import { DEFAULT_GARMENT_ID, getGarment } from '../garments/catalog'
import { brandPlacement } from '../garments/brand'

const logo: LogoAsset = { dataUrl: 'data:image/png;base64,AAAA', name: 'logo.png', width: 400, height: 200, bytes: 1234, mime: 'image/png' }
const store = () => useDesignStore.getState()

beforeEach(() => {
  useDesignStore.setState({ design: createDefaultDesign(), past: [], future: [], lastCommit: null })
})

describe('design store', () => {
  it('changes colour and undoes / redoes it', () => {
    store().setColor('body', '#2563EB')
    expect(store().design.colors.body).toBe('#2563EB')
    store().undo()
    expect(store().design.colors.body).toBe('#0E0E0E')
    store().redo()
    expect(store().design.colors.body).toBe('#2563EB')
  })

  it('coalesces continuous slider updates into one undo step', () => {
    store().setLogo(logo)
    const before = store().past.length
    for (const w of [9, 10, 11, 12]) store().updateTransform({ widthCm: w }, { coalesce: 'size' })
    expect(store().past.length).toBe(before + 1)
    store().undo()
    expect(store().design.placement.widthCm).toBe(8)
  })

  it('ignores no-op commits', () => {
    store().setColor('body', '#0E0E0E')
    expect(store().past).toHaveLength(0)
  })

  it('switching side picks a preset on that side', () => {
    store().setSide('back')
    const p = store().design.placement
    expect(p.side).toBe('back')
    expect(getGarment(store().design.productId).placements.find((x) => x.id === p.placement)?.side).toBe('back')
  })

  it('clamps transforms to the printable area', () => {
    store().setLogo(logo)
    store().updateTransform({ offsetXCm: 500, widthCm: 500 })
    const p = store().design.placement
    const g = getGarment(store().design.productId)
    const preset = g.placements.find((x) => x.id === p.placement)!
    const area = g.printAreas[preset.side]
    expect(p.widthCm / 100).toBeLessThanOrEqual(area.xMax - area.xMin + 1e-6)
    const right = preset.anchor[0] + p.offsetXCm / 100 + p.widthCm / 200
    expect(right).toBeLessThanOrEqual(area.xMax + 1e-6)
  })

  it('reset all transforms keeps opacity, fill and lock (OpenMerch resetLayer semantics)', () => {
    store().setLogo(logo)
    store().updateTransform({ rotationDeg: 30, flipX: true, opacity: 0.6, tint: '#FFFFFF', locked: true, widthCm: 12 })
    store().resetTransform()
    const p = store().design.placement
    expect([p.rotationDeg, p.flipX, p.widthCm]).toEqual([0, false, 8])
    expect([p.opacity, p.tint, p.locked]).toEqual([0.6, '#FFFFFF', true])
  })

  it('changing placement keeps rotation, flips and appearance', () => {
    store().setLogo(logo)
    store().updateTransform({ rotationDeg: 15, flipY: true, opacity: 0.5 })
    store().setPlacement('centerChest')
    const p = store().design.placement
    expect([p.placement, p.rotationDeg, p.flipY, p.opacity]).toEqual(['centerChest', 15, true, 0.5])
  })

  it('resetAll is undoable', () => {
    store().setColor('body', '#ED1C24')
    store().setLogo(logo)
    store().resetAll()
    expect(store().design.logo).toBeNull()
    store().undo()
    expect(store().design.logo).toBe(logo)
    expect(store().design.colors.body).toBe('#ED1C24')
  })
})

describe('parseDesign', () => {
  it('round-trips an exported design', () => {
    const d = { ...createDefaultDesign(), logo, colors: { body: '#fa0', sleeves: null, collar: '#003a96' } }
    const parsed = parseDesign(JSON.parse(JSON.stringify(d)))
    expect(parsed.colors).toEqual({ body: '#FFAA00', sleeves: null, collar: '#003A96' })
    expect(parsed.logo?.width).toBe(400)
  })

  it('accepts older exports without appearance fields, and unknown products', () => {
    const old = { version: 1, productId: 'classic', colors: { body: '#000' }, placement: { side: 'front', placement: 'leftChest', widthCm: 9 } }
    const parsed = parseDesign(old)
    expect(parsed.productId).toBe(DEFAULT_GARMENT_ID)
    expect(parsed.placement).toMatchObject({ widthCm: 9, flipX: false, flipY: false, opacity: 1, tint: null, locked: false })
  })

  it.each([
    [null, /JSON object/],
    [{ version: 2 }, /version/],
    [{ version: 1 }, /missing product/],
    [{ version: 1, productId: 'raglan', colors: { body: 'blue' } }, /body color/],
    [{ version: 1, productId: 'raglan', colors: { body: '#000' }, logo: { dataUrl: 'javascript:alert(1)', width: 1, height: 1 } }, /PNG or JPEG/],
  ])('rejects invalid input %#', (input, message) => {
    expect(() => parseDesign(input)).toThrow(message)
  })
})

describe('patterns', () => {
  const fill = { id: 'breton', color: '#001d4b', sizeCm: 4, angle: 0, density: 0.5, opacity: 1, seed: 42 }

  it('sets, adjusts (clamped) and removes a zone pattern with undo', () => {
    store().setPattern('body', fill)
    expect(store().design.patterns.body).toMatchObject({ id: 'breton', color: '#001D4B' })
    store().updatePattern('body', { sizeCm: 999, angle: 270, opacity: 0 })
    expect(store().design.patterns.body).toMatchObject({ sizeCm: 40, angle: -90, opacity: 0.1 })
    store().setPattern('body', null)
    expect(store().design.patterns.body).toBeNull()
    store().undo()
    store().undo()
    expect(store().design.patterns.body).toMatchObject({ sizeCm: 4 })
  })

  it('copies a zone pattern to other zones', () => {
    store().setPattern('sleeves', { ...fill, id: 'houndstooth' })
    store().copyPattern('sleeves', ['body', 'collar'])
    expect(store().design.patterns.body?.id).toBe('houndstooth')
    expect(store().design.patterns.collar?.id).toBe('houndstooth')
    expect(store().design.patterns.body).not.toBe(store().design.patterns.sleeves)
  })

  it('ignores unknown pattern ids', () => {
    store().setPattern('body', { ...fill, id: 'does-not-exist' })
    expect(store().design.patterns.body).toBeNull()
  })

  it('round-trips patterns through export and drops unknown ones on import', () => {
    const d = { ...createDefaultDesign(), patterns: { body: fill, sleeves: { ...fill, id: 'nope' }, collar: null } }
    const parsed = parseDesign(JSON.parse(JSON.stringify(d)))
    expect(parsed.patterns.body).toMatchObject({ id: 'breton', color: '#001D4B', seed: 42 })
    expect(parsed.patterns.sleeves).toBeNull()
    // Exports from before patterns existed still load.
    const old = parseDesign({ version: 1, productId: 'raglan', colors: { body: '#000' } })
    expect(old.patterns).toEqual({ body: null, sleeves: null, collar: null })
  })
})

describe('HONEG mark', () => {
  const rect = () => brandPlacement(getGarment(store().design.productId), store().design.brand).rect
  const logoBox = () => {
    const d = store().design
    const g = getGarment(d.productId)
    const preset = g.placements.find((p) => p.id === d.placement.placement)!
    const w = d.placement.widthCm / 100
    const h = w / (d.logo ? d.logo.width / d.logo.height : 1)
    const cx = preset.anchor[0] + d.placement.offsetXCm / 100
    const cy = preset.anchor[1] + d.placement.offsetYCm / 100
    return { xMin: cx - w / 2, xMax: cx + w / 2, yMin: cy - h / 2, yMax: cy + h / 2 }
  }
  const overlaps = (a: ReturnType<typeof logoBox>, b: ReturnType<typeof rect>) => a.xMax > b.xMin && a.xMin < b.xMax && a.yMax > b.yMin && a.yMin < b.yMax

  it('defaults to the chest opposite the default left-chest logo', () => {
    expect(store().design.brand).toEqual({ side: 'right', style: 'logo', color: 'auto' })
    expect(store().design.placement.placement).toBe('leftChest')
  })

  it('moves to the free chest when the logo takes its side', () => {
    store().setLogo(logo)
    store().setPlacement('rightChest')
    expect(store().design.brand.side).toBe('left')
    expect(overlaps(logoBox(), rect())).toBe(false)
  })

  it('pushes a chest logo across when the mark takes its side, keeping the logo size', () => {
    store().setLogo(logo)
    store().updateTransform({ widthCm: 9.5 })
    store().setBrand({ side: 'left' })
    expect(store().design.placement.placement).toBe('rightChest')
    expect(store().design.placement.widthCm).toBe(9.5)
    store().undo()
    expect(store().design.brand.side).toBe('right')
    expect(store().design.placement.placement).toBe('leftChest')
  })

  it('keeps large front prints clear of the mark', () => {
    store().setLogo(logo)
    store().setPlacement('centerChest')
    store().updateTransform({ widthCm: 30, offsetYCm: 20 })
    expect(overlaps(logoBox(), rect())).toBe(false)
  })

  it('back prints are unaffected', () => {
    store().setLogo(logo)
    store().setPlacement('upperBack')
    expect(store().design.brand.side).toBe('right')
  })

  it('cannot be removed by importing an old design, and conflicts are resolved', () => {
    const old = parseDesign({ version: 1, productId: 'raglan', colors: { body: '#000' }, placement: { side: 'front', placement: 'rightChest', widthCm: 8 } })
    expect(old.brand).toEqual({ side: 'right', style: 'logo', color: 'auto' })
    store().replaceDesign(old)
    expect(store().design.brand.side).toBe('left')
  })
})
