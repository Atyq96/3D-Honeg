import { clamp, torusFrame, type Pt } from '../math'
import { wrappedPoly } from '../svg'
import type { PatternTypeDef } from '../types'

/**
 * Speed chevrons: runs of arrowheads along a band, each run growing in size
 * and weight towards its head for a sense of acceleration. The band itself is
 * the first ink; the chevrons step through the others, smallest to largest.
 */
export const chevrons: PatternTypeDef = {
  id: 'chevrons',
  minLayers: 3,
  maxLayers: 5,
  uses: { scale: true, angle: true, density: true },
  defaultAngle: 45,
  generate({ rng, inks, scale, angle, density }) {
    const frame = torusFrame(angle)
    const { sPeriod, tPeriod } = frame
    const centre = tPeriod * rng.range(0.42, 0.58)
    const bandHalf = clamp(tPeriod * rng.range(0.13, 0.24) * scale, 40, tPeriod * 0.3)
    const at = (s: number, t: number) => frame.at(s, t)
    // A strip along the whole loop (two halves so each polygon stays a sane size).
    const strip = (t0: number, t1: number) =>
      [0, sPeriod / 2].map((s0) => wrappedPoly([at(s0 - 2, t0), at(s0 + sPeriod / 2 + 2, t0), at(s0 + sPeriod / 2 + 2, t1), at(s0 - 2, t1)])).join('')
    const band = strip(centre - bandHalf, centre + bandHalf)

    // Look, by seed: arrowhead sharpness and weight, and pinstripes along the band.
    const sharp = rng.range(0.6, 1.05)
    const weight = rng.range(0.32, 0.5)
    const chevronInks = Math.max(1, inks - 1)
    const paths: string[] = Array.from({ length: chevronInks }, () => '')
    if (rng.chance(0.5)) {
      const gap = bandHalf * 0.12
      const w = bandHalf * 0.07
      paths[chevronInks - 1] += strip(centre - bandHalf - gap - w, centre - bandHalf - gap) + strip(centre + bandHalf + gap, centre + bandHalf + gap + w)
    }

    // Runs of chevrons, each growing towards its head.
    const runs = Math.max(1, Math.round((sPeriod / 1000) * (1 + density * 1.2)))
    const runLength = sPeriod / runs
    for (let r = 0; r < runs; r++) {
      const count = Math.round(4 + density * 3 + rng.int(0, 1))
      const startH = bandHalf * rng.range(0.32, 0.45)
      const endH = bandHalf * rng.range(1.15, 1.5)
      // Heads point along +s; a run fills most of its share of the loop.
      let s = r * runLength + runLength * rng.range(0.05, 0.12)
      const sizes = Array.from({ length: count }, (_, k) => startH + ((endH - startH) * k) / Math.max(1, count - 1))
      const total = sizes.reduce((a, h) => a + h * 1.05, 0)
      const fit = Math.min(1, (runLength * 0.86) / total)
      sizes.forEach((h, k) => {
        const reach = h * sharp // arm length along the band: the shorter, the steeper the arrowhead
        const thick = h * weight
        s += h * 1.05 * fit
        const tip = s
        const pts: Pt[] = [
          at(tip - reach, centre - h),
          at(tip - reach + thick, centre - h),
          at(tip + thick, centre),
          at(tip - reach + thick, centre + h),
          at(tip - reach, centre + h),
          at(tip, centre),
        ]
        // Smallest chevrons in the first chevron ink, the head in the last.
        const ink = Math.min(chevronInks - 1, Math.floor((k / count) * chevronInks))
        paths[ink] += wrappedPoly(pts)
      })
    }
    return [{ d: band }, ...paths.map((d) => ({ d }))]
  },
}
