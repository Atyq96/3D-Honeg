import { clamp, dsin, type Pt } from '../math'
import { wrappedPoly } from '../svg'
import type { PatternTypeDef } from '../types'

/**
 * Stacked flowing wave bands (swim / triathlon). Each major boundary is the
 * same wave, phase-shifted a little more than the one above, so the bands
 * swell and pinch as they flow; thin accent bands ride parallel to the band
 * above them. Phases add up to whole turns over the tile, so it tiles both ways.
 */
export const waves: PatternTypeDef = {
  id: 'waves',
  minLayers: 3,
  maxLayers: 6,
  uses: { scale: true, angle: false, density: true },
  defaultAngle: 0,
  generate({ rng, inks, scale, density }) {
    const majors = clamp(Math.round((3 + 3 * density) / scale), 2, 10)
    // Band list: majors with occasional thin accent bands after them.
    const bands: { weight: number; accent: boolean }[] = []
    for (let k = 0; k < majors; k++) {
      bands.push({ weight: rng.range(0.75, 1.35), accent: false })
      if (rng.chance(0.35 + 0.3 * density)) bands.push({ weight: rng.range(0.12, 0.2), accent: true })
    }
    const total = bands.reduce((s, b) => s + b.weight, 0)
    const heights = bands.map((b) => (b.weight / total) * 1000)

    const freq = rng.pick([1, 1, 2])
    const turns = rng.pick([1, 1, 2])
    const shift = turns / majors
    // Big enough to flow, small enough that major bands never pinch shut.
    const minMajor = Math.min(...heights.filter((_, i) => !bands[i].accent))
    const amp = Math.min(minMajor * 0.42 / Math.max(0.2, 2 * dsin(Math.PI * shift)), (1000 / majors) * 0.55)
    const phase0 = rng.next()
    const curve = (y: number, phase: number) => (x: number) =>
      y + amp * (dsin(2 * Math.PI * (freq * (x / 1000) + phase)) + 0.3 * dsin(2 * Math.PI * (2 * freq * (x / 1000) + 2 * phase + 0.25)))

    // Boundary k is the top of band k; boundary K repeats boundary 0 one tile down.
    const y0 = rng.range(0, 1000)
    const bounds: ((x: number) => number)[] = []
    let y = y0
    let phase = phase0
    for (let k = 0; k <= bands.length; k++) {
      bounds.push(curve(y, phase))
      if (k < bands.length) {
        y += heights[k]
        if (!bands[k].accent) phase += shift
      }
    }

    // Colours: majors cycle base + the lower inks; accents use the top ink. Neighbours (wrapping) never match.
    const accentInk = inks
    const majorColours = Array.from({ length: Math.max(2, inks) }, (_, i) => i) // 0 = base
    const colours: number[] = []
    let m = rng.int(0, majorColours.length - 1)
    for (const b of bands) colours.push(b.accent ? accentInk : majorColours[m++ % majorColours.length])
    for (let i = 0; i < colours.length; i++) {
      const prev = colours[(i + colours.length - 1) % colours.length]
      const next = colours[(i + 1) % colours.length]
      if (colours[i] === prev || colours[i] === next) colours[i] = majorColours.find((c) => c !== prev && c !== next) ?? colours[i]
    }

    const paths: string[] = Array.from({ length: inks }, () => '')
    const xs = Array.from({ length: 101 }, (_, i) => i * 10)
    bands.forEach((_, k) => {
      if (colours[k] === 0) return
      const top = xs.map((x): Pt => [x, bounds[k](x)])
      // A hair of overlap into the band below hides antialiasing seams.
      const bottom = xs.map((x): Pt => [x, bounds[k + 1](x) + 0.8]).reverse()
      paths[colours[k] - 1] += wrappedPoly([...top, ...bottom])
    })
    return paths.map((d) => ({ d }))
  },
}
