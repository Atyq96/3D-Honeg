import { clamp, mod, smoothstep, torusFrame, type Pt } from '../math'
import { fbm } from '../noise'
import { circleD, wrapOffsets, wrappedPoly } from '../svg'
import type { PatternTypeDef } from '../types'

/**
 * Halftone fade: a solid band whose dots shrink away from it (first ink), a
 * second dot colour that blooms mid-fade in the gaps (second ink), and an
 * optional racing stripe through the band (third ink). Dot size follows the
 * distance from the band, broken up by noise.
 */
export const halftone: PatternTypeDef = {
  id: 'halftone',
  minLayers: 3,
  maxLayers: 4,
  uses: { scale: true, angle: true, density: true },
  defaultAngle: 0,
  generate({ rng, inks, scale, angle, density }) {
    const n = clamp(Math.round(20 / scale), 8, 48)
    const cell = 1000 / n
    const frame = torusFrame(angle)
    const { tPeriod, sPeriod } = frame
    const noise = fbm(rng.fork(), 3, 2)
    const centre = rng.range(0, tPeriod)
    const solidHalf = rng.range(0.07, 0.13) * tPeriod
    const reach = solidHalf + (0.2 + 0.18 * density) * tPeriod

    // Fade strength at a point: 1 inside the solid band, easing to 0 at `reach`.
    const strength = ([x, y]: Pt) => {
      const t = x * frame.across[0] + y * frame.across[1]
      const d = Math.abs(mod(t - centre + tPeriod / 2, tPeriod) - tPeriod / 2)
      return clamp(1 - smoothstep(solidHalf, reach, d) + 0.2 * noise(x, y), 0, 1)
    }
    const dot = (cx: number, cy: number, r: number) =>
      wrapOffsets([[cx - r, cy - r], [cx + r, cy + r]]).map(([dx, dy]) => circleD(cx + dx, cy + dy, r)).join('')

    const strip = (t0: number, t1: number) =>
      [0, sPeriod / 2].map((s) => wrappedPoly([frame.at(s - 2, t0), frame.at(s + sPeriod / 2 + 2, t0), frame.at(s + sPeriod / 2 + 2, t1), frame.at(s - 2, t1)])).join('')

    let main = strip(centre - solidHalf, centre + solidHalf)
    let second = ''
    // Classic 45° screen: rows half a cell apart, every other row offset by half a cell.
    // Second-colour dots sit in the holes of that lattice.
    for (let j = 0; j < 2 * n; j++)
      for (let i = 0; i < n; i++) {
        const y = (j + 0.5) * (cell / 2)
        const a: Pt = [(i + (j % 2) / 2) * cell, y]
        // Powers via √ only (exact everywhere): g^0.75 and m^1.5. At 0.52 cell the dots merge into solid.
        const g = strength(a)
        const ra = 0.52 * cell * Math.sqrt(g) * Math.sqrt(Math.sqrt(g))
        if (ra > 0.06 * cell) main += dot(a[0], a[1], ra)
        const b: Pt = [(i + 0.5 + (j % 2) / 2) * cell, y]
        // Second colour trails at the outer edge of the fade (strongest where the main dots are small).
        const tail = clamp(1 - Math.abs(strength(b) - 0.28) / 0.28, 0, 1)
        const rb = 0.3 * cell * tail * Math.sqrt(tail)
        if (rb > 0.06 * cell) second += dot(b[0], b[1], rb)
      }
    const out = [{ d: main }, { d: second }]
    if (inks >= 3) out.push({ d: strip(centre - solidHalf * 0.22, centre + solidHalf * 0.22) })
    return out
  },
}
