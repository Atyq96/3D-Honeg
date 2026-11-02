import { clamp, type Pt } from '../math'
import { periodicNoise1d } from '../noise'
import type { Rng } from '../rng'
import { lineD, polyD } from '../svg'
import type { PatternTypeDef } from '../types'

/**
 * Mountain ranges: ridgelines layered back to front (far ridges high and in
 * the first inks, the nearest low and in the later ones), with an optional
 * climb profile line across the sky in the last ink. Ridges wrap left to
 * right; the tile is designed to be printed about as tall as the garment, with
 * the range across the lower body.
 */

/** Sharp-crested ridge height, 0–1, tileable along x. */
function ridge(rng: Rng, roughness: number): (x: number) => number {
  const octaves = [2, 4, 9, 19].map((p, i) => ({ n: periodicNoise1d(rng, p + (i < 2 ? rng.int(0, 1) : 0)), a: [1, 0.55, 0.22 * roughness, 0.09 * roughness][i] }))
  const total = octaves.reduce((s, o) => s + o.a, 0)
  return (x) => {
    let sum = 0
    for (const o of octaves) {
      const crest = 1 - Math.abs(o.n(x))
      sum += o.a * crest * crest
    }
    return sum / total
  }
}

export const elevation: PatternTypeDef = {
  id: 'elevation',
  minLayers: 3,
  maxLayers: 6,
  uses: { scale: true, angle: false, density: true },
  defaultAngle: 0,
  generate({ rng, inks, scale, density }) {
    // The profile line is the "optional" element: it needs a spare ink and some density.
    const withProfile = inks >= 3 && density >= 0.25
    const ridges = withProfile ? inks - 1 : inks
    const step = 5
    const out: { d: string; stroke?: { width: number } }[] = []
    let highest = 1000
    for (let r = 0; r < ridges; r++) {
      const depth = ridges === 1 ? 1 : r / (ridges - 1) // 0 = farthest
      const base = 470 + depth * 300
      // Far ranges tall and jagged, near ones lower and smoother.
      const height = scale * (330 - depth * 170) * rng.range(0.85, 1.1)
      const h = ridge(rng.fork(), (0.6 + density) * (1.2 - 0.5 * depth))
      const pts: Pt[] = []
      for (let x = 0; x <= 1000; x += step) pts.push([x, clamp(base - height * h(x), 40, 1000)])
      highest = Math.min(highest, ...pts.map((p) => p[1]))
      // Down to the bottom edge; the next tile starts with sky again.
      out.push({ d: polyD([...pts, [1000, 1000.5], [0, 1000.5]]) })
    }

    if (withProfile) {
      // Climb profile: a jagged line across the sky with a tick at the summit.
      const n1 = periodicNoise1d(rng.fork(), 4)
      const n2 = periodicNoise1d(rng.fork(), 13)
      const n3 = periodicNoise1d(rng.fork(), 37)
      const top = Math.max(120, highest - 200 * scale)
      const amp = 85 * scale
      const pts: Pt[] = []
      for (let x = 0; x <= 1000; x += 12.5) pts.push([x, top + amp * (0.6 * n1(x) + 0.3 * n2(x) + 0.12 * n3(x))])
      const summit = pts.reduce((a, b) => (b[1] < a[1] ? b : a))
      // Summit flag: a pole and a small pennant.
      const pole = 46 * scale
      const flag = lineD([summit, [summit[0], summit[1] - pole], [summit[0] + 26 * scale, summit[1] - pole + 9 * scale], [summit[0], summit[1] - pole + 18 * scale]])
      out.push({ d: lineD(pts) + flag, stroke: { width: 6.5 * scale } })
    }
    return out.map((o) => (o.stroke ? { d: o.d, stroke: { ...o.stroke, cap: 'round' as const, join: 'miter' as const } } : o))
  },
}
