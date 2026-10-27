import { afterEach, describe, expect, it } from 'vitest'
import { en } from './en'
import { fr } from './fr'
import { getLang, useLang } from '.'
import { PATTERNS } from '../patterns/library'
import { COLOR_PRESETS, presetName } from '../config/palette'
import { PAINT_ZONE_IDS, REGION_IDS } from '../garments/zones'
import { GARMENTS } from '../garments/catalog'
import { describePatterns } from '../patterns/describe'
import { parseDesign } from '../state/design'
import { num } from '../lib/format'

/** Same keys and value kinds (text, function, list, group) at every level. */
function shape(v: unknown): unknown {
  if (typeof v === 'function') return 'fn'
  if (Array.isArray(v)) return 'list'
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, shape((v as Record<string, unknown>)[k])]))
  return typeof v
}

afterEach(() => useLang.setState({ lang: 'en' }))

describe('dictionaries', () => {
  it('English is the default', () => {
    expect(getLang()).toBe('en')
  })

  it('French has exactly the same keys and kinds of values as English', () => {
    expect(shape(fr)).toEqual(shape(en))
  })

  it('every pattern, palette colour, zone, placement and product has a name in both languages', () => {
    for (const d of [en, fr]) {
      for (const p of PATTERNS) expect(d.pattern.names[p.id], p.id).toBeTruthy()
      for (const c of COLOR_PRESETS) expect(d.palette[c.hex], c.hex).toBeTruthy()
      for (const z of [...REGION_IDS, ...PAINT_ZONE_IDS]) expect(d.zones.items[z].label, z).toBeTruthy()
      for (const g of GARMENTS) {
        expect(d.garments[g.id]?.name, g.id).toBeTruthy()
        for (const p of g.placements) expect(d.placements[p.id].label, p.id).toBeTruthy()
      }
    }
  })
})

describe('switching to French', () => {
  const fill = { id: 'houndstooth', color: '#0E0E0E', sizeCm: 2.5, angle: 15, density: 0.5, opacity: 0.8, seed: 42 }

  it('describes designs in French, with a decimal comma', () => {
    useLang.setState({ lang: 'fr' })
    expect(describePatterns({ body: fill, sleeves: null, collar: null }, ['body'])).toEqual([
      { zone: 'body', label: 'Corps', text: 'Pied-de-poule #0E0E0E · 2,5 cm · 15° · opacité 80\u00a0%' },
    ])
    expect(num(5.5)).toBe('5,5')
    expect(presetName('#ED1C24')).toBe('Rouge course')
  })

  it('reports invalid files in French', () => {
    useLang.setState({ lang: 'fr' })
    expect(() => parseDesign(null)).toThrow(/n’est pas un design Lunar 3D valide/)
  })

  it('goes back to English', () => {
    useLang.setState({ lang: 'fr' })
    useLang.setState({ lang: 'en' })
    expect(num(5.5)).toBe('5.5')
    expect(presetName('#ED1C24')).toBe('Race red')
  })
})
