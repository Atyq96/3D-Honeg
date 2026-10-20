import { describe, expect, it } from 'vitest'
import { CATEGORY_LABELS, getPattern, PATTERNS, tileSvg } from './library'
import { describePatterns } from './describe'

const params = (density: number, seed = 42) => ({ color: '#0E0E0E', bg: '#F6F5F2', density, seed })

describe('pattern library (adapted from inkjet)', () => {
  it('has a broad, uniquely named set', () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(60)
    expect(new Set(PATTERNS.map((p) => p.id)).size).toBe(PATTERNS.length)
    for (const p of PATTERNS) expect(Object.keys(CATEGORY_LABELS)).toContain(p.category)
  })

  it.each(PATTERNS.map((p) => [p.id]))('%s renders valid markup at every density', (id) => {
    const def = getPattern(id)!
    for (const d of [0, 0.5, 1]) {
      const svg = def.render(params(d))
      expect(svg.length).toBeGreaterThan(20)
      expect(svg).not.toMatch(/NaN|undefined|Infinity/)
    }
    expect(def.tile[0]).toBeGreaterThan(0)
    expect(def.tile[1]).toBeGreaterThan(0)
    expect(def.defaultSizeCm).toBeGreaterThan(0)
  })

  it('flags exactly the patterns whose layout depends on the seed', () => {
    for (const p of PATTERNS) {
      const changes = p.render(params(0.5, 1)) !== p.render(params(0.5, 99))
      expect([p.id, changes]).toEqual([p.id, p.usesSeed])
    }
  })

  it('flags exactly the patterns that react to density', () => {
    for (const p of PATTERNS) {
      const changes = p.render(params(0.1)) !== p.render(params(0.9))
      expect([p.id, changes]).toEqual([p.id, p.usesDensity])
    }
  })

  it('builds a standalone tile SVG with the fabric colour underneath', () => {
    const svg = tileSvg(getPattern('honeycomb')!, { ...params(0.5), opacity: 0.8 }, 100)
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="100" height="173"/)
    expect(svg).toContain('fill="#F6F5F2"')
    expect(svg).toContain('opacity="0.8"')
  })

  it('describes applied patterns per zone', () => {
    const fill = { id: 'houndstooth', color: '#0E0E0E', sizeCm: 2.5, angle: 15, density: 0.5, opacity: 0.8, seed: 42 }
    expect(describePatterns({ body: fill, sleeves: null, collar: null }, ['body', 'sleeves'])).toEqual([
      { zone: 'body', label: 'Corps', text: 'Pied-de-poule #0E0E0E · 2,5 cm · 15° · opacité 80 %' },
    ])
  })
})
