import { beforeEach, describe, expect, it } from 'vitest'
import { logoRect, useDesignStore } from './designStore'
import { cleanTextContent, createDefaultDesign, letterHeightCm, MAX_LOGOS, MAX_TEXT_LINE_CHARS, MAX_TEXTS, parseDesign, type LogoAsset } from './design'
import { DEFAULT_GARMENT_ID, getGarment } from '../garments/catalog'
import { brandPlacement, describeBrand } from '../garments/brand'
import { brandFabric, describeZones } from './paint'

const logo: LogoAsset = { dataUrl: 'data:image/png;base64,AAAA', name: 'logo.png', width: 400, height: 200, bytes: 1234, mime: 'image/png' }
const store = () => useDesignStore.getState()
/** Adds a logo and returns its id. */
const add = (asset: LogoAsset = logo) => store().addLogo(asset)!
const first = () => store().design.logos[0]
const placement = () => first().placement

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
    const id = add()
    const before = store().past.length
    for (const w of [9, 10, 11, 12]) store().updateTransform(id, { widthCm: w }, { coalesce: 'size' })
    expect(store().past.length).toBe(before + 1)
    store().undo()
    expect(placement().widthCm).toBe(8)
  })

  it('ignores no-op commits', () => {
    store().setColor('body', '#0E0E0E')
    expect(store().past).toHaveLength(0)
  })

  it('switching side picks a preset on that side', () => {
    store().setSide(add(), 'back')
    const p = placement()
    expect(p.side).toBe('back')
    expect(getGarment(store().design.productId).placements.find((x) => x.id === p.placement)?.side).toBe('back')
  })

  it('clamps transforms to the printable area', () => {
    store().updateTransform(add(), { offsetXCm: 500, widthCm: 500 })
    const p = placement()
    const g = getGarment(store().design.productId)
    const preset = g.placements.find((x) => x.id === p.placement)!
    const area = g.printAreas[preset.side]
    expect(p.widthCm / 100).toBeLessThanOrEqual(area.xMax - area.xMin + 1e-6)
    const right = preset.anchor[0] + p.offsetXCm / 100 + p.widthCm / 200
    expect(right).toBeLessThanOrEqual(area.xMax + 1e-6)
  })

  it('reset all transforms keeps opacity, fill and lock (OpenMerch resetLayer semantics)', () => {
    const id = add()
    store().updateTransform(id, { rotationDeg: 30, flipX: true, opacity: 0.6, tint: '#FFFFFF', locked: true, widthCm: 12 })
    store().resetTransform(id)
    const p = placement()
    expect([p.rotationDeg, p.flipX, p.widthCm]).toEqual([0, false, 8])
    expect([p.opacity, p.tint, p.locked]).toEqual([0.6, '#FFFFFF', true])
  })

  it('changing placement keeps rotation, flips and appearance', () => {
    const id = add()
    store().updateTransform(id, { rotationDeg: 15, flipY: true, opacity: 0.5 })
    store().setPlacement(id, 'centerChest')
    const p = placement()
    expect([p.placement, p.rotationDeg, p.flipY, p.opacity]).toEqual(['centerChest', 15, true, 0.5])
  })

  it('resetAll is undoable', () => {
    store().setColor('body', '#ED1C24')
    add()
    store().resetAll()
    expect(store().design.logos).toEqual([])
    store().undo()
    expect(first().asset).toBe(logo)
    expect(store().design.colors.body).toBe('#ED1C24')
  })
})

describe('parseDesign', () => {
  it('round-trips an exported design', () => {
    add()
    store().setColor('body', '#fa0')
    store().setColor('collar', '#003a96')
    const parsed = parseDesign(JSON.parse(JSON.stringify(store().design)))
    expect(parsed.colors).toEqual({ body: '#FFAA00', sleeves: null, collar: '#003A96' })
    expect(parsed.logos).toHaveLength(1)
    expect(parsed.logos[0].asset.width).toBe(400)
    expect(parsed.logos[0].id).toBe(first().id)
  })

  it('accepts older single-logo exports without appearance fields, and unknown products', () => {
    const old = { version: 1, productId: 'classic', colors: { body: '#000' }, logo, placement: { side: 'front', placement: 'leftChest', widthCm: 9 } }
    const parsed = parseDesign(old)
    expect(parsed.productId).toBe(DEFAULT_GARMENT_ID)
    expect(parsed.logos).toHaveLength(1)
    expect(parsed.logos[0].placement).toMatchObject({ widthCm: 9, flipX: false, flipY: false, opacity: 1, tint: null, locked: false })
    // A placement without a logo (the old default) adds nothing.
    expect(parseDesign({ ...old, logo: null }).logos).toEqual([])
  })

  it('keeps at most MAX_LOGOS logos and gives duplicate ids new ones', () => {
    const layer = { id: 'same', asset: logo, placement: {} }
    const parsed = parseDesign({ version: 1, productId: 'raglan', colors: { body: '#000' }, logos: [layer, layer, layer, layer] })
    expect(parsed.logos).toHaveLength(MAX_LOGOS)
    expect(new Set(parsed.logos.map((l) => l.id)).size).toBe(MAX_LOGOS)
  })

  it.each([
    [null, /objet JSON/],
    [{ version: 2 }, /version/],
    [{ version: 1 }, /produit manquant/],
    [{ version: 1, productId: 'raglan', colors: { body: 'blue' } }, /couleur du corps/],
    [{ version: 1, productId: 'raglan', colors: { body: '#000' }, logo: { dataUrl: 'javascript:alert(1)', width: 1, height: 1 } }, /PNG ou JPEG/],
    [{ version: 1, productId: 'raglan', colors: { body: '#000' }, logos: [{ asset: { dataUrl: 'data:text/html;base64,AA', width: 1, height: 1 } }] }, /PNG ou JPEG/],
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
  const logoBox = (i = 0) => logoRect(store().design, store().design.logos[i])
  const overlaps = (a: ReturnType<typeof logoBox>, b: ReturnType<typeof rect>) => a.xMax > b.xMin && a.xMin < b.xMax && a.yMax > b.yMin && a.yMin < b.yMax

  it('defaults to the chest opposite where the first logo goes', () => {
    expect(store().design.brand).toEqual({ side: 'right', style: 'logo', color: 'auto' })
    add()
    expect(placement().placement).toBe('leftChest')
  })

  it('moves to the free chest when a logo takes its side', () => {
    store().setPlacement(add(), 'rightChest')
    expect(store().design.brand.side).toBe('left')
    expect(overlaps(logoBox(), rect())).toBe(false)
  })

  it('pushes a chest logo across when the mark takes its side, keeping the logo size', () => {
    store().updateTransform(add(), { widthCm: 9.5 })
    store().setBrand({ side: 'left' })
    expect(placement().placement).toBe('rightChest')
    expect(placement().widthCm).toBe(9.5)
    store().undo()
    expect(store().design.brand.side).toBe('right')
    expect(placement().placement).toBe('leftChest')
  })

  it('keeps large front prints clear of the mark', () => {
    const id = add()
    store().setPlacement(id, 'centerChest')
    store().updateTransform(id, { widthCm: 30, offsetYCm: 20 })
    expect(overlaps(logoBox(), rect())).toBe(false)
  })

  it('back prints are unaffected', () => {
    store().setPlacement(add(), 'upperBack')
    expect(store().design.brand.side).toBe('right')
  })

  it('cannot be removed by importing an old design, and conflicts are resolved', () => {
    const old = parseDesign({ version: 1, productId: 'raglan', colors: { body: '#000' }, logo, placement: { side: 'front', placement: 'rightChest', widthCm: 8 } })
    expect(old.brand).toEqual({ side: 'right', style: 'logo', color: 'auto' })
    store().replaceDesign(old)
    expect(store().design.brand.side).toBe('left')
  })

  it("won't let a second logo take the mark's chest when the other chest is taken", () => {
    add() // left chest
    const second = add()
    store().setPlacement(second, 'rightChest')
    expect(store().design.logos.find((l) => l.id === second)!.placement.placement).not.toBe('rightChest')
    expect(store().design.brand.side).toBe('right')
  })

  it('moves every chest logo on its new side across', () => {
    const a = add()
    const b = add()
    store().setPlacement(b, 'leftChest')
    store().setBrand({ side: 'left' })
    expect(store().design.logos.map((l) => l.placement.placement)).toEqual(['rightChest', 'rightChest'])
    expect(store().design.logos.map((l) => l.id)).toEqual([a, b])
  })

  it('hand-edited files with logos on both chests move the conflicting one to the centre', () => {
    const both = parseDesign({
      version: 1,
      productId: 'raglan',
      colors: { body: '#000' },
      logos: [
        { asset: logo, placement: { placement: 'leftChest' } },
        { asset: logo, placement: { placement: 'rightChest' } },
      ],
    })
    store().replaceDesign(both)
    expect(store().design.logos.map((l) => l.placement.placement)).toEqual(['leftChest', 'centerChest'])
    expect(store().design.logos.every((_, i) => !overlaps(logoBox(i), rect()))).toBe(true)
  })
})

describe('multiple logos', () => {
  const square: LogoAsset = { ...logo, name: 'photo.jpg', width: 300, height: 300 }
  const box = (i: number) => logoRect(store().design, store().design.logos[i])
  const overlaps = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) => a.xMax > b.xMin && a.xMin < b.xMax && a.yMax > b.yMin && a.yMin < b.yMax

  it('adds up to MAX_LOGOS, each on its own print position', () => {
    const ids = [add(), add(square), add()]
    expect(new Set(ids).size).toBe(MAX_LOGOS)
    expect(store().addLogo(logo)).toBeNull()
    const used = store().design.logos.map((l) => l.placement.placement)
    expect(new Set(used).size).toBe(MAX_LOGOS)
    // Never on the HONEG mark's chest.
    expect(used).not.toContain('rightChest')
  })

  it('places a new logo where it does not cover the others', () => {
    add(square)
    add(square)
    const [a, b] = store().design.logos
    expect(a.placement.side === b.placement.side && overlaps(box(0), box(1))).toBe(false)
  })

  it('edits, removes and reorders one logo without touching the others', () => {
    const a = add()
    const b = add(square)
    store().updateTransform(b, { widthCm: 12 })
    expect(store().design.logos.find((l) => l.id === a)!.placement.widthCm).toBe(8)
    store().moveLogo(b, -1)
    expect(store().design.logos.map((l) => l.id)).toEqual([b, a])
    store().moveLogo(b, -1) // already at the bottom
    expect(store().design.logos.map((l) => l.id)).toEqual([b, a])
    store().removeLogo(b)
    expect(store().design.logos.map((l) => l.id)).toEqual([a])
    store().undo()
    expect(store().design.logos.map((l) => l.id)).toEqual([b, a])
  })

  it('replacing an image keeps its position and re-clamps for the new shape', () => {
    const id = add()
    store().updateTransform(id, { offsetYCm: 1, rotationDeg: 10 })
    store().replaceLogo(id, square)
    expect(first().asset).toBe(square)
    expect(placement()).toMatchObject({ placement: 'leftChest', rotationDeg: 10 })
  })

  it('keeps quick slider edits on two logos as separate undo steps', () => {
    const a = add()
    const b = add(square)
    const before = store().past.length
    store().updateTransform(a, { widthCm: 9 }, { coalesce: 'size' })
    store().updateTransform(b, { widthCm: 9 }, { coalesce: 'size' })
    expect(store().past.length).toBe(before + 2)
  })
})

describe('text', () => {
  // A one-line rendering 500 × 200 px whose capitals are 140 px tall.
  const lettering = (width = 500): LogoAsset => ({ dataUrl: 'data:image/png;base64,AAAA', name: 'TEAM', width, height: 200, bytes: 0, mime: 'image/png' })
  const spec = { content: 'TEAM', font: 'anton', align: 'center' as const, capPx: 140, sizeCm: 4 }
  const addText = (asset = lettering()) => store().addText(spec, asset, '#FFFFFF')!
  const text = (id: string) => store().design.logos.find((l) => l.id === id)!

  it('adds text across the chest in its colour, at the default letter height', () => {
    const id = addText()
    const t = text(id)
    expect(t.placement.placement).toBe('centerChest')
    expect(t.placement.tint).toBe('#FFFFFF')
    expect(letterHeightCm(t)).toBe(5.5)
    expect(t.text?.sizeCm).toBe(5.5)
  })

  it('counts text separately from logos', () => {
    add()
    add()
    add()
    const ids = [addText(), addText(), addText()]
    expect(ids.every(Boolean)).toBe(true)
    expect(store().addText(spec, lettering(), '#000000')).toBeNull()
    expect(store().addLogo(logo)).toBeNull()
  })

  it('keeps the letter height when the wording changes', () => {
    const id = addText()
    const before = letterHeightCm(text(id))
    store().setText(id, { ...spec, content: 'TEAMS', sizeCm: text(id).text!.sizeCm }, lettering(625))
    expect(letterHeightCm(text(id))).toBe(before)
    expect(text(id).placement.widthCm).toBeGreaterThan(20)
  })

  it('sets overlong text smaller, and grows it back when shortened', () => {
    const id = addText()
    const size = text(id).text!.sizeCm
    store().setText(id, { ...spec, content: 'A VERY LONG TEAM NAME', sizeCm: size }, lettering(6000))
    expect(letterHeightCm(text(id))).toBeLessThan(size)
    expect(text(id).text!.sizeCm).toBe(size)
    store().setText(id, { ...spec, sizeCm: size }, lettering())
    expect(letterHeightCm(text(id))).toBe(size)
  })

  it('resizing on the garment changes the chosen letter height', () => {
    const id = addText()
    store().updateTransform(id, { widthCm: 10 })
    expect(text(id).text!.sizeCm).toBe(letterHeightCm(text(id)))
    expect(letterHeightCm(text(id))).toBe(2.8)
  })

  it('round-trips through export and keeps the per-kind limits on import', () => {
    const id = addText()
    const parsed = parseDesign(JSON.parse(JSON.stringify(store().design)))
    expect(parsed.logos[0]).toMatchObject({ id, text: { content: 'TEAM', font: 'anton', align: 'center', capPx: 140 } })
    const layer = { asset: lettering(), text: spec, placement: {} }
    const many = parseDesign({ version: 1, productId: 'raglan', colors: { body: '#000' }, logos: [layer, layer, layer, layer, { asset: logo }] })
    expect(many.logos.filter((l) => l.text)).toHaveLength(MAX_TEXTS)
    expect(many.logos.filter((l) => !l.text)).toHaveLength(1)
  })

  it('drops empty wording on import, leaving a plain image', () => {
    const parsed = parseDesign({ version: 1, productId: 'raglan', colors: { body: '#000' }, logos: [{ asset: lettering(), text: { ...spec, content: '  ' } }] })
    expect(parsed.logos[0].text).toBeUndefined()
  })

  it('limits wording to three lines of 32 characters', () => {
    expect(cleanTextContent('a\r\nb\nc\nd')).toBe('a\nb\nc')
    expect(cleanTextContent('x'.repeat(40))).toHaveLength(MAX_TEXT_LINE_CHARS)
  })
})

describe('paint zones', () => {
  it('paints a zone with a colour, and clearing removes it', () => {
    store().setColor('halfLeft', '#ED1C24')
    expect(store().design.zones.halfLeft).toEqual({ color: '#ED1C24', pattern: null })
    store().setColor('halfLeft', null)
    expect(store().design.zones.halfLeft).toBeUndefined()
    store().undo()
    expect(store().design.zones.halfLeft?.color).toBe('#ED1C24')
  })

  it('a pattern on an unpainted zone takes the body colour underneath', () => {
    store().setColor('body', '#003A96')
    store().setPattern('halfBottom', { id: 'pinstripe', color: '#ffffff', sizeCm: 2, angle: 0, density: 0.5, opacity: 1, seed: 42 })
    expect(store().design.zones.halfBottom).toMatchObject({ color: '#003A96', pattern: { id: 'pinstripe', color: '#FFFFFF' } })
    store().updatePattern('halfBottom', { sizeCm: 3 })
    expect(store().design.zones.halfBottom?.pattern?.sizeCm).toBe(3)
    // Removing the pattern keeps the zone's colour.
    store().setPattern('halfBottom', null)
    expect(store().design.zones.halfBottom).toEqual({ color: '#003A96', pattern: null })
  })

  it('reset all colours clears the zones too', () => {
    store().setColor('sash', '#ED1C24')
    store().resetColors()
    expect(store().design.zones).toEqual({})
  })

  it('round-trips through export and drops unknown zones and bad colours on import', () => {
    store().setColor('sash', '#ED1C24')
    const parsed = parseDesign(JSON.parse(JSON.stringify(store().design)))
    expect(parsed.zones).toEqual({ sash: { color: '#ED1C24', pattern: null } })
    const odd = parseDesign({ version: 1, productId: 'raglan', colors: { body: '#000' }, zones: { sash: { color: 'red' }, cape: { color: '#fff' }, hemBand: { color: '#fff' } } })
    expect(odd.zones).toEqual({ hemBand: { color: '#FFFFFF', pattern: null } })
    // Older designs have no zones.
    expect(parseDesign({ version: 1, productId: 'raglan', colors: { body: '#000' } }).zones).toEqual({})
  })

  it('the HONEG mark reads the fabric under it, so Auto ink follows a painted zone', () => {
    store().setColor('body', '#F6F5F2')
    expect(brandFabric(store().design)).toBe('#F6F5F2')
    // Mark on the wearer's right chest; the sash runs from the right shoulder through it.
    store().setColor('sash', '#ED1C24')
    expect(brandFabric(store().design)).toBe('#ED1C24')
    // The left half doesn't reach the right chest.
    store().setColor('halfLeft', '#001D4B')
    expect(brandFabric(store().design)).toBe('#ED1C24')
    expect(describeZones(store().design).map((z) => z.label)).toEqual(['Moitié gauche', 'Écharpe'])
  })
})

describe('HONEG mark centred', () => {
  const rect = () => brandPlacement(getGarment(store().design.productId), store().design.brand).rect
  const overlaps = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => a.xMax > b.xMin && a.xMin < b.xMax && a.yMax > b.yMin && a.yMin < b.yMax

  it('sits on the centre line and leaves chest logos where they are', () => {
    const id = add() // left chest
    store().setBrand({ side: 'center' })
    expect(store().design.brand.side).toBe('center')
    const r = rect()
    expect((r.xMin + r.xMax) / 2).toBeCloseTo(0)
    expect(store().design.logos.find((l) => l.id === id)!.placement.placement).toBe('leftChest')
  })

  it('frees both chests: a second logo can take the right chest without moving the mark', () => {
    store().setBrand({ side: 'center' })
    add() // left chest
    const second = add()
    store().setPlacement(second, 'rightChest')
    expect(store().design.logos.find((l) => l.id === second)!.placement.placement).toBe('rightChest')
    expect(store().design.brand.side).toBe('center')
  })

  it('keeps a centre-chest print clear of it', () => {
    store().setBrand({ side: 'center' })
    const id = add()
    store().setPlacement(id, 'centerChest')
    expect(overlaps(logoRect(store().design, store().design.logos[0]), rect())).toBe(false)
  })

  it('round-trips through export and reads well', () => {
    store().setBrand({ side: 'center' })
    expect(parseDesign(JSON.parse(JSON.stringify(store().design))).brand.side).toBe('center')
    expect(describeBrand(store().design.brand, '#0E0E0E')).toBe('Centre poitrine · Logo · Auto (blanc)')
  })
})
