import { torusFrame } from '../math'
import { rectD, wrappedPoly } from '../svg'
import type { PatternTypeDef } from '../types'

/**
 * Road-cycling kit: body colour, a chest band edged with thin pinstripes, and
 * by seed a second narrow band and/or a diagonal sash. The tile is centred on
 * the chest, so at the preset size (about the jersey's height) the band lands
 * across the chest. Inks: band, pinstripes, sash, sash trim.
 */
export const bands: PatternTypeDef = {
  id: 'bands',
  minLayers: 3,
  maxLayers: 5,
  uses: { scale: true, angle: false, density: true },
  defaultAngle: 0,
  generate({ rng, inks, scale, density }) {
    const band: string[] = []
    const pin: string[] = []
    const sash: string[] = []
    const trim: string[] = []
    const full = (y: number, h: number) => rectD(-1, y, 1002, h)

    // Chest band with pinstripes just off both edges.
    const h = scale * rng.range(95, 165)
    const top = rng.range(390, 470) - h / 2
    const gap = scale * rng.range(9, 16)
    const pinW = scale * rng.range(7, 12)
    band.push(full(top, h))
    pin.push(full(top - gap - pinW, pinW), full(top + h + gap, pinW))
    // Often a double pinstripe above, as on classic team kits.
    if (rng.chance(0.45)) pin.push(full(top - 2 * (gap + pinW), pinW))

    // A second, narrower band lower down (by seed, more likely with density).
    if (rng.chance(0.25 + 0.5 * density)) {
      const h2 = h * rng.range(0.28, 0.42)
      const y2 = top + h + rng.range(150, 230) * scale
      band.push(full(y2, h2))
      if (rng.chance(0.5)) pin.push(full(y2 + h2 + gap, pinW))
    }

    // Diagonal sash, shoulder to hip, with fine trim lines.
    if (rng.chance(0.2 + 0.6 * density)) {
      const f = torusFrame(rng.chance(0.5) ? -45 : -135)
      const w = scale * rng.range(70, 110)
      const mid = f.tPeriod / 2
      const strip = (t0: number, t1: number) =>
        [0, f.sPeriod / 2].map((s) => wrappedPoly([f.at(s - 2, t0), f.at(s + f.sPeriod / 2 + 2, t0), f.at(s + f.sPeriod / 2 + 2, t1), f.at(s - 2, t1)])).join('')
      sash.push(strip(mid - w / 2, mid + w / 2))
      const t = pinW * 0.8
      trim.push(strip(mid - w / 2 - gap - t, mid - w / 2 - gap), strip(mid + w / 2 + gap, mid + w / 2 + gap + t))
    }

    // Fewer inks: fold the extras into the ones available, keeping the order band → pinstripes → sash → trim.
    const parts = [band, pin, sash, trim]
    const out: string[] = Array.from({ length: inks }, () => '')
    parts.forEach((p, i) => (out[Math.min(i, inks - 1)] += p.join('')))
    return out.map((d) => ({ d }))
  },
}
