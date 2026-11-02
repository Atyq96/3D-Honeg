import { clamp } from '../math'
import { fbm } from '../noise'
import { rectD } from '../svg'
import type { PatternTypeDef } from '../types'

/**
 * Digital (pixel) camo. Each ink is its own blob field sampled on a coarse
 * 2 × 2 block grid with a little single-pixel detail, so edges step in a mix
 * of big and small blocks like real digital camo — clustered, not noisy.
 * Coverage per ink is set exactly from the field's quantiles.
 */
const GRIDS = [16, 24, 32, 40, 48, 64]
/** Bottom-to-top share of the tile each ink covers (before density). */
const COVERAGE = [0.44, 0.3, 0.2, 0.12, 0.08]

export const digitalCamo: PatternTypeDef = {
  id: 'digitalCamo',
  minLayers: 3,
  maxLayers: 5,
  uses: { scale: true, angle: false, density: true },
  defaultAngle: 0,
  generate({ rng, inks, scale, density }) {
    const want = 32 / scale
    const n = GRIDS.reduce((best, g) => (Math.abs(g - want) < Math.abs(best - want) ? g : best))
    const cell = 1000 / n
    const paths: string[] = []
    for (let layer = 0; layer < inks; layer++) {
      const blob = fbm(rng.fork(), 2, 3, 0.5)
      const grain = fbm(rng.fork(), 8, 1)
      const values: number[] = []
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          // Sample at the 2 × 2 block centre for chunky edges, plus a touch of per-pixel grain.
          const bx = (Math.floor(i / 2) * 2 + 1) * cell
          const by = (Math.floor(j / 2) * 2 + 1) * cell
          values.push(blob(bx, by) + 0.12 * grain((i + 0.5) * cell, (j + 0.5) * cell))
        }
      const share = clamp(COVERAGE[layer] * (0.65 + 0.7 * density), 0.03, 0.75)
      const cut = [...values].sort((a, b) => b - a)[Math.floor(share * values.length)]
      let d = ''
      for (let j = 0; j < n; j++) {
        // One rectangle per horizontal run; a hair of overlap hides antialiasing seams between colours.
        for (let i = 0; i < n; ) {
          if (values[j * n + i] <= cut) {
            i++
            continue
          }
          const start = i
          while (i < n && values[j * n + i] > cut) i++
          d += rectD(start * cell, j * cell, (i - start) * cell + 0.6, cell + 0.6)
        }
      }
      paths.push(d)
    }
    return paths.map((d) => ({ d }))
  },
}
