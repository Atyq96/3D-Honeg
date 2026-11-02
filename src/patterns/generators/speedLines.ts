import { dsin, torusFrame, type Pt } from '../math'
import { wrappedPoly } from '../svg'
import type { PatternTypeDef } from '../types'

/**
 * Speed lines: streaks along the main direction, thick and tightly packed in
 * the middle of a curving "swoosh" band and thinning out towards its edges.
 * Each streak is a long blade with a sharp tail and a square-cut head.
 */
export const speedLines: PatternTypeDef = {
  id: 'speedLines',
  minLayers: 3,
  maxLayers: 5,
  uses: { scale: true, angle: true, density: true },
  defaultAngle: 27,
  generate({ rng, inks, scale, angle, density }) {
    const frame = torusFrame(angle)
    const { sPeriod, tPeriod } = frame
    // Swoosh: the band's centre line waves gently along the loop.
    const centre0 = tPeriod * rng.range(0.4, 0.6)
    const sway = tPeriod * rng.range(0.06, 0.12)
    const phase = rng.next()
    const waves = Math.max(1, Math.round(sPeriod / 1000))
    const centreAt = (s: number) => centre0 + sway * dsin(2 * Math.PI * ((s / sPeriod) * waves + phase))
    const half = Math.min(tPeriod * 0.36, 210 * scale)

    const paths: string[] = Array.from({ length: inks }, () => '')
    const count = Math.round(((sPeriod / 1000) * (40 + 60 * density)) / Math.sqrt(scale))
    for (let k = 0; k < count; k++) {
      // Concentrated near the centre (sum of uniforms ≈ bell curve).
      const offset = (rng.next() + rng.next() + rng.next() - 1.5) / 1.5
      const core = 1 - Math.abs(offset)
      const s0 = rng.range(0, sPeriod)
      const t = centreAt(s0) + offset * half
      // Long, heavy streaks in the core; short hairlines at the edges.
      const len = scale * rng.range(90, 260) * (0.6 + 1.6 * core * core) * (rng.chance(0.12) ? 1.8 : 1)
      const weight = scale * (3 + 30 * core * core * rng.range(0.4, 1))
      const tail = s0 - len
      const pts: Pt[] = [
        frame.at(tail, t),
        frame.at(s0 - weight * 0.6, t - weight / 2),
        frame.at(s0, t - weight / 2),
        frame.at(s0, t + weight / 2),
        frame.at(s0 - weight * 0.6, t + weight / 2),
      ]
      // Heavy streaks in the first inks, fine ones in the top inks (accent colours sit on top).
      const ink = Math.min(inks - 1, Math.floor((1 - core) * inks * rng.range(0.7, 1.15)))
      paths[ink] += wrappedPoly(pts)
    }
    return paths.map((d) => ({ d }))
  },
}
