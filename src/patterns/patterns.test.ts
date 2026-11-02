import { describe, expect, it } from 'vitest'
import { clearPatternCache, generatePattern, layerCount, normalizeColor, PATTERN_TYPES } from './generate'
import { countLayers, geometryOf, layerColors, recolor } from './svg'
import { parseLayered } from './layered'
import { PALETTES } from './palettes'
import { PRESETS, SPORTS } from './presets'
import { printPixels, printSvg, withDpi } from './raster'
import { dcos, dsin, torusFrame } from './math'

const COLORS = ['#1F5BD8', '#F2762E', '#14234A', '#5FB3E8', '#0E0E12']
const OTHER = ['#FFFFFF', '#000000', '#ED1C24', '#00A6A6', '#FFD100']

/** Plain bitwise CRC-32 (independent of the table-driven one under test). */
const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff
  for (const b of bytes) {
    c ^= b
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

/** FNV-1a, to pin outputs without storing whole SVGs. */
const hash = (s: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0
  return h.toString(16)
}

describe.each(PATTERN_TYPES.map((t) => [t.id, t] as const))('%s', (type, def) => {
  it('same type + seed + options → byte-identical SVG, even when regenerated from scratch', () => {
    const opts = { colors: COLORS, seed: 1234, scale: 1.2, density: 0.7 }
    const a = generatePattern(type, opts).svg
    clearPatternCache()
    const b = generatePattern(type, opts).svg
    expect(b).toBe(a)
  })

  it('a different seed gives a different design', () => {
    expect(generatePattern(type, { colors: COLORS, seed: 1 }).svg).not.toBe(generatePattern(type, { colors: COLORS, seed: 2 }).svg)
  })

  it('outputs a valid layered tile with one flat colour per layer', () => {
    for (const n of [3, 4, 5, 6]) {
      const { svg, layers } = generatePattern(type, { colors: [...COLORS, '#FFFFFF'].slice(0, n), seed: 99 })
      expect(layers).toBe(layerCount(def, n))
      expect(layers).toBeGreaterThanOrEqual(3)
      expect(layers).toBeLessThanOrEqual(6)
      const parsed = parseLayered(svg)
      expect(parsed.width).toBe(1000)
      expect(parsed.layers).toBe(layers)
      expect(svg).not.toMatch(/NaN|undefined|Infinity|gradient|opacity/i)
      // Light enough to rasterise quickly on phones.
      expect(svg.length).toBeLessThan(260_000)
    }
  })

  it('recolouring changes the colours and never the geometry', () => {
    const { svg, layers } = generatePattern(type, { colors: COLORS, seed: 7 })
    const next = OTHER.slice(0, layers)
    const re = recolor(svg, next)
    expect(geometryOf(re)).toBe(geometryOf(svg))
    expect(layerColors(re)).toEqual(next)
    // …and it's exactly what generating with those colours gives.
    expect(re).toBe(generatePattern(type, { colors: next, seed: 7 }).svg)
  })

  it('options are clamped, so out-of-range input still regenerates the same design', () => {
    const a = generatePattern(type, { colors: COLORS, seed: 5, scale: 9, density: -3 }).svg
    const b = generatePattern(type, { colors: COLORS, seed: 5, scale: 2, density: 0 }).svg
    expect(a).toBe(b)
  })
})

describe('pattern library', () => {
  it('pins the flagship preset, so saved designs keep looking (and printing) the same', () => {
    const p = PRESETS.find((x) => x.id === 'shards-electric')!
    const { svg } = generatePattern(p.type, { colors: p.colors, seed: p.seed, scale: p.scale, density: p.density, angle: p.angle })
    // If a generator change is intended, every saved design using it changes too: bump with care.
    expect(hash(geometryOf(svg))).toBe('c0084fa8')
  })

  it('accepts short and lowercase hex, rejects anything else', () => {
    expect(normalizeColor('#abc')).toBe('#AABBCC')
    expect(normalizeColor('1f5bd8')).toBe('#1F5BD8')
    expect(normalizeColor('red')).toBeNull()
    expect(() => generatePattern('shards', { colors: ['red'], seed: 1 })).toThrow()
    expect(() => generatePattern('nope' as never, { colors: COLORS, seed: 1 })).toThrow()
  })

  it('repeats colours when given fewer than the type needs', () => {
    const { svg, layers } = generatePattern('waves', { colors: ['#111111', '#EEEEEE'], seed: 3 })
    expect(layers).toBe(3)
    expect(layerColors(svg)).toEqual(['#111111', '#EEEEEE', '#111111'])
    expect(countLayers(svg)).toBe(3)
  })

  it('its own sine and cosine match Math closely (they exist to be identical on every engine)', () => {
    for (let x = -10; x <= 10; x += 0.37) {
      expect(dsin(x)).toBeCloseTo(Math.sin(x), 10)
      expect(dcos(x)).toBeCloseTo(Math.cos(x), 10)
    }
  })

  it('snaps directions to ones that close on the tile, so bands tile seamlessly', () => {
    const f = torusFrame(30)
    // (2, −1): 26.6° up to the right.
    expect(f.along[0]).toBeCloseTo(2 / Math.sqrt(5))
    expect(f.along[1]).toBeCloseTo(-1 / Math.sqrt(5))
    expect(f.sPeriod).toBeCloseTo(1000 * Math.sqrt(5))
    // Going one loop along the band lands on the same tile position.
    const [x, y] = f.at(f.sPeriod, 0)
    expect(((x % 1000) + 1000) % 1000).toBeCloseTo(0)
    expect(((y % 1000) + 1000) % 1000).toBeCloseTo(0)
  })
})

describe('palettes and presets', () => {
  it('ships 8–10 named sport palettes of 4–6 colours', () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(8)
    expect(PALETTES.length).toBeLessThanOrEqual(10)
    for (const p of PALETTES) {
      expect(p.colors.length).toBeGreaterThanOrEqual(4)
      expect(p.colors.length).toBeLessThanOrEqual(6)
      for (const c of p.colors) expect(normalizeColor(c)).toBe(c)
    }
    expect(PALETTES.find((p) => p.id === 'electric')!.colors).toEqual(COLORS)
  })

  it('has 30 unique presets covering every sport and type', () => {
    expect(PRESETS).toHaveLength(30)
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(30)
    for (const s of SPORTS) expect(PRESETS.filter((p) => p.sport === s).length).toBeGreaterThanOrEqual(6)
    for (const t of PATTERN_TYPES) expect(PRESETS.some((p) => p.type === t.id)).toBe(true)
  })

  it.each(PRESETS.map((p) => [p.id, p] as const))('%s generates within its type’s layer range', (_, p) => {
    const def = PATTERN_TYPES.find((t) => t.id === p.type)!
    expect(p.colors.length).toBeGreaterThanOrEqual(def.minLayers)
    expect(p.colors.length).toBeLessThanOrEqual(def.maxLayers)
    const { layers } = generatePattern(p.type, { colors: p.colors, seed: p.seed, scale: p.scale, density: p.density, angle: p.angle })
    expect(layers).toBe(p.colors.length)
  })
})

describe('print files', () => {
  const tile = generatePattern('bands', { colors: COLORS, seed: 1 }).svg

  it('repeats the tile over the print area at true size, each repeat clipped to itself', () => {
    const svg = printSvg(tile, { widthMm: 600, heightMm: 800, tileMm: 400 })
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="600mm" height="800mm" viewBox="0 0 600 800">/)
    // Centred 400 mm repeats over 600 × 800 mm: 3 columns × 3 rows.
    expect(svg.match(/<svg x=/g)).toHaveLength(9)
    // Still recolourable: the layer groups survive in every repeat.
    expect(layerColors(recolor(svg, OTHER))).toEqual(OTHER)
  })

  it('refuses PNG sizes a browser canvas can’t hold, with the reason', () => {
    expect(printPixels({ dpi: 300, widthMm: 600, heightMm: 600 })).toEqual({ width: 7087, height: 7087 })
    expect(() => printPixels({ dpi: 600, widthMm: 1000, heightMm: 1000 })).toThrow(/too large/)
  })

  it('records the dpi in the PNG (pHYs chunk after IHDR, valid CRC)', () => {
    const png = new Uint8Array(45)
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const out = withDpi(png, 300)
    const view = new DataView(out.buffer)
    expect(String.fromCharCode(...out.subarray(37, 41))).toBe('pHYs')
    expect(view.getUint32(41)).toBe(11811) // 300 dpi in pixels per metre
    expect(out[49]).toBe(1)
    expect(view.getUint32(50)).toBe(crc32(out.subarray(37, 50)))
    // The rest of the file follows untouched.
    expect(out.subarray(0, 33)).toEqual(png.subarray(0, 33))
    expect(out.subarray(54)).toEqual(png.subarray(33))
  })
})
