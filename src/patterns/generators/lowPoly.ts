import { clamp, dsin, mod, torusFrame, type Pt } from '../math'
import { fbm } from '../noise'
import { wrappedPoly } from '../svg'
import type { PatternTypeDef } from '../types'

/**
 * Low-poly facets: a jittered triangle grid coloured by a smooth field that
 * flows diagonally (a wave along the main direction plus noise), quantised to
 * the ink layers. Triangles near a colour boundary sometimes take the
 * neighbouring colour, which gives the crystalline, faceted edge.
 */
export const lowPoly: PatternTypeDef = {
  id: 'lowPoly',
  minLayers: 3,
  maxLayers: 6,
  uses: { scale: true, angle: true, density: true },
  defaultAngle: 45,
  generate({ rng, inks, scale, angle, density }) {
    const n = clamp(Math.round(16 / scale), 6, 32)
    const cell = 1000 / n
    const jitter = Array.from({ length: n * n }, () => [rng.range(-0.36, 0.36) * cell, rng.range(-0.36, 0.36) * cell] as const)
    // Unwrapped lattice point (i, j may run past the edge; the jitter wraps with it).
    const P = (i: number, j: number): Pt => {
      const k = mod(j, n) * n + mod(i, n)
      return [i * cell + jitter[k][0], j * cell + jitter[k][1]]
    }

    const frame = torusFrame(angle)
    const noise = fbm(rng.fork(), 2, 3)
    const phase = rng.next()
    const value = ([x, y]: Pt) => {
      const t = (x * frame.across[0] + y * frame.across[1]) / frame.tPeriod
      const wave = 0.5 + 0.5 * dsin(2 * Math.PI * (t + phase))
      return 0.62 * wave + 0.38 * (0.5 + 0.5 * noise(x, y))
    }

    const tris: { pts: Pt[]; v: number }[] = []
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1)
        const pair = rng.chance(0.5) ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]]
        for (const pts of pair) {
          const centre: Pt = [(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3]
          tris.push({ pts, v: value(centre) })
        }
      }

    // Equal shares per colour (base included), from the sorted field values.
    const levels = inks + 1
    const sorted = tris.map((t) => t.v).sort((p, q) => p - q)
    const cuts = Array.from({ length: levels - 1 }, (_, k) => sorted[Math.floor(((k + 1) * sorted.length) / levels)])
    const spread = (sorted[sorted.length - 1] - sorted[0]) / levels
    const dither = 0.15 + 0.5 * density
    const paths: string[] = Array.from({ length: inks }, () => '')
    for (const t of tris) {
      let level = cuts.filter((c) => t.v >= c).length
      // Near a boundary, sometimes jump to the neighbouring colour.
      const near = cuts.findIndex((c) => Math.abs(t.v - c) < spread * 0.35)
      if (near >= 0 && rng.chance(dither * (1 - Math.abs(t.v - cuts[near]) / (spread * 0.35)))) level = t.v >= cuts[near] ? near : near + 1
      // Each layer also covers everything above it, so neighbouring colours never leave a hairline of base between them.
      const d = wrappedPoly(t.pts)
      for (let l = 1; l <= level; l++) paths[l - 1] += d
    }
    return paths.map((d) => ({ d }))
  },
}
