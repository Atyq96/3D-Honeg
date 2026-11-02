import { describe, expect, it } from 'vitest'
import { ArtworkError, importSvg } from './importSvg'
import { parseLayered } from './layered'
import { geometryOf, layerColors, recolor } from './svg'

/** What a design tool typically exports: XML prolog, DOCTYPE, class styles, groups with transforms. */
const ILLUSTRATOR = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" [
  <!ENTITY ns_svg "http://www.w3.org/2000/svg">
]>
<svg version="1.1" xmlns="&ns_svg;" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 200 100" onload="alert(1)">
  <style type="text/css"><![CDATA[
    .st0{fill:#1F5BD8;}
    .st1{fill:#F2762E;stroke:none}
    /* comment */
    @media print { .st0 { fill: red } }
  ]]></style>
  <rect class="st0" width="200" height="100"/>
  <g transform="translate(10 10) rotate(15)">
    <path class="st1" d="M0 0L80 0L40 60Z" onclick="steal()"/>
  </g>
  <polygon style="fill: rgb(14, 14, 18)" points="120,10 190,10 150,90"/>
  <script>alert(document.cookie)</script>
  <image href="https://example.com/x.png" width="10" height="10"/>
  <text x="5" y="5">Hello</text>
  <a href="javascript:alert(1)"><circle cx="20" cy="80" r="8" fill="#f2762e"/></a>
</svg>`

describe('importSvg', () => {
  const art = importSvg(ILLUSTRATOR)

  it('turns each flat colour into a layer, the most used one first (the base)', () => {
    // Blue background, then the dark triangle (2800 units²), then the orange triangle + dot (≈2530).
    expect(art.colors).toEqual(['#1F5BD8', '#0E0E12', '#F2762E'])
    expect(art.layers).toBe(3)
    const parsed = parseLayered(art.svg)
    expect(parsed.width).toBe(1000)
    expect(parsed.layers).toBe(3)
  })

  it('keeps only geometry: no scripts, handlers, links, images or text survive', () => {
    expect(art.svg).not.toMatch(/script|alert|onload|onclick|javascript|href|image|<text|example\.com/i)
    expect(art.warnings).toEqual(expect.arrayContaining(['text', 'images']))
  })

  it('applies class styles, inline styles, inherited fills and transforms', () => {
    // The rotated triangle carries its group's transform, scaled to the 1000-unit tile (×10, centred).
    expect(art.svg).toMatch(/<g data-layer="2" fill="#F2762E"><path d="M0 0L80 0L40 60Z" transform="matrix\(9\.659 2\.588 -2\.588 9\.659 -400 100\)"\/>/)
    // The circle inside the link has the same orange: same layer.
    expect(art.svg.match(/data-layer="2"/g)!.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps stacking order by repeating a layer group when colours interleave', () => {
    const groups = [...art.svg.matchAll(/<g data-layer="(\d)"/g)].map((m) => +m[1])
    expect(groups).toEqual([0, 0, 2, 1, 2])
  })

  it('is recolourable like a generated pattern', () => {
    const re = recolor(art.svg, ['#FFFFFF', '#000000', '#ED1C24'])
    expect(layerColors(re)).toEqual(['#FFFFFF', '#000000', '#ED1C24'])
    expect(geometryOf(re)).toBe(geometryOf(art.svg))
  })

  it('flattens gradients and merges near-identical colours', () => {
    const out = importSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="100px" height="100px">
      <defs><linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="0.5" style="stop-color:#00a6a6"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
      <rect width="100" height="100" fill="#FFFFFF"/>
      <rect x="10" y="10" width="30" height="30" fill="url(#g)"/>
      <rect x="50" y="10" width="30" height="30" fill="#FF0000"/>
      <rect x="50" y="50" width="20" height="20" fill="#FE0102"/>
    </svg>`)
    expect(out.colors).toEqual(['#FFFFFF', '#FF0000', '#00A6A6'])
    expect(out.warnings).toEqual(expect.arrayContaining(['gradients', 'merged']))
  })

  it('handles strokes, groups, <use> and named colours', () => {
    const out = importSvg(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="white"/>
      <g fill="navy"><circle id="dot" cx="10" cy="10" r="5"/></g>
      <use xlink:href="#dot" x="50" fill="navy"/>
      <line x1="0" y1="90" x2="100" y2="90" stroke="red" stroke-width="4" stroke-linecap="round"/>
    </svg>`)
    // The 100 × 4 line outweighs the two small dots.
    expect(out.colors).toEqual(['#FFFFFF', '#FF0000', '#000080'])
    expect(out.svg).toContain('<g data-layer="1" fill="none" stroke="#FF0000" stroke-linecap="round" stroke-linejoin="miter">')
    expect(out.svg).toContain('stroke-width="4"')
    // The <use> copy is there, shifted 50 units (500 on the tile).
    expect(out.svg).toMatch(/matrix\(10 0 0 10 500 0\)/)
  })

  it('puts single-colour art on a contrasting base', () => {
    const out = importSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0H5V5Z" fill="#111"/></svg>')
    expect(out.colors).toEqual(['#FFFFFF', '#111111'])
  })

  it('rejects files that aren’t SVG or have nothing to print', () => {
    expect(() => importSvg('hello')).toThrow(ArtworkError)
    expect(() => importSvg('<html><body/></html>')).toThrow(/notSvg/)
    expect(() => importSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text>hi</text></svg>')).toThrow(/empty/)
  })
})
