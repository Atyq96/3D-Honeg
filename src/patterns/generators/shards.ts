import { add, cross, dir, scale as mul, smoothstep, type Pt } from '../math'
import { fbm } from '../noise'
import type { Rng } from '../rng'
import { wrappedPoly } from '../svg'
import type { PatternTypeDef } from '../types'

/**
 * Fractured geometric camo. Long blades whose edges follow a few dominant
 * directions — the main grain, a steeper one and a shallower one — with ends
 * cut at a sharp angle so every blade has two points. Big blades overlap into
 * fractured masses in the lower inks, smaller pieces break off their ends in
 * the middle inks, and long hairline slivers cut across in the top ink.
 * Masses gather where a slow noise field is high, leaving calm base areas.
 */

type Kind = 'large' | 'medium' | 'small' | 'sliver'

interface Blade {
  centre: Pt
  axis: number
  length: number
  kind: Kind
}

const SPEC: Record<Kind, { len: [number, number]; thick: [number, number] }> = {
  large: { len: [420, 700], thick: [0.15, 0.26] },
  medium: { len: [200, 360], thick: [0.13, 0.24] },
  small: { len: [80, 170], thick: [0.12, 0.22] },
  sliver: { len: [260, 540], thick: [0.028, 0.055] },
}

const lerpPt = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** Angle between two line directions, 0–90°. */
const lineGap = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 180) + 180) % 180)
  return Math.min(d, 180 - d)
}

/** A blade: long edges on its axis, both ends cut 18–40° off it, sometimes with a corner clipped. */
function outline(rng: Rng, b: Blade, dirs: number[]): Pt[] {
  // Prefer cutting along another dominant direction when it gives a sharp enough point.
  const usable = dirs.filter((d) => lineGap(d, b.axis) >= 18 && lineGap(d, b.axis) <= 40)
  const cut = usable.length && rng.chance(0.7) ? rng.pick(usable) + rng.range(-3, 3) : b.axis + (rng.chance(0.5) ? 1 : -1) * rng.range(20, 36)
  const ua = dir(b.axis)
  const ub = dir(cut)
  const spec = SPEC[b.kind]
  const thickness = b.length * rng.range(...spec.thick)
  const side = thickness / Math.abs(cross(ua, ub)) // slanted end length giving that thickness
  const h = b.length / 2
  const corner = (along: number, across: number) => add(b.centre, add(mul(ua, along), mul(ub, across)))
  // c0→c1 and c2→c3 are the long edges; c1→c2 and c3→c0 the slanted ends.
  const c: Pt[] = [corner(-h, -side / 2), corner(h, -side / 2), corner(h, side / 2), corner(-h, side / 2)]
  if (b.kind === 'sliver' || rng.chance(0.45)) return c

  // Clip a blunt corner: that end then reaches its point in two cuts.
  const blunt = ua[0] * ub[0] + ua[1] * ub[1] > 0 ? [1, 3] : [0, 2]
  const i = rng.pick(blunt)
  const longBefore = i === 1 || i === 3
  const back = rng.range(0.1, 0.3)
  const end = rng.range(0.3, 0.7)
  const a = lerpPt(c[i], c[(i + 3) % 4], longBefore ? back : end)
  const z = lerpPt(c[i], c[(i + 1) % 4], longBefore ? end : back)
  return [...c.slice(0, i), a, z, ...c.slice(i + 1)]
}

export const shards: PatternTypeDef = {
  id: 'shards',
  minLayers: 3,
  maxLayers: 6,
  uses: { scale: true, angle: true, density: true },
  defaultAngle: 28,
  generate({ rng, inks, scale, angle, density }) {
    const main = angle + rng.range(-3, 3)
    // Third grain well off the main one: near-flat hairlines would read as print seams.
    const dirs = [main, main + rng.range(34, 42), main - rng.range(34, 42)]
    const axisWeights = [0.64, 0.24, 0.12]
    const mass = fbm(rng.fork(), 2, 2)
    const area = 1 / (scale * scale)
    const k = 0.6 + 0.8 * density
    const counts: Record<Kind, number> = {
      large: Math.round(8 * k * area),
      medium: Math.round(17 * k * area),
      small: Math.round(26 * k * area),
      sliver: Math.round(7 * k * area),
    }

    // Big blades where the mass field is high (rejection sampling keeps calm areas of base).
    const inMass = (): Pt => {
      let p: Pt = [0, 0]
      for (let i = 0; i < 14; i++) {
        p = [rng.range(0, 1000), rng.range(0, 1000)]
        if (rng.next() < 0.06 + 0.94 * smoothstep(-0.3, 0.35, mass(p[0], p[1]))) break
      }
      return p
    }
    const blades: Blade[] = []
    for (const kind of ['large', 'medium', 'small', 'sliver'] as Kind[]) {
      for (let n = 0; n < counts[kind]; n++) {
        // Slivers cut along the two main grains only.
        let axis = dirs[rng.weighted(kind === 'sliver' ? [0.75, 0.25, 0] : axisWeights)]
        let centre: Pt
        const bigger = blades.filter((b) => b.kind === 'large' || (kind === 'small' && b.kind === 'medium'))
        if ((kind === 'medium' || kind === 'small') && bigger.length && rng.chance(kind === 'small' ? 0.75 : 0.5)) {
          // Breaks off a bigger blade's end, mostly along its grain.
          const parent = rng.pick(bigger)
          const ua = dir(parent.axis)
          const along = parent.length * rng.range(0.35, 0.85) * (rng.chance(0.5) ? 1 : -1)
          const across = parent.length * rng.range(-0.14, 0.14)
          centre = add(parent.centre, add(mul(ua, along), mul([ua[1], -ua[0]], across)))
          if (rng.chance(0.7)) axis = parent.axis
        } else centre = inMass()
        const [lo, hi] = SPEC[kind].len
        blades.push({ centre, axis: axis + rng.range(-2.5, 2.5), length: scale * rng.range(lo, hi), kind })
      }
    }

    // Large blades low in the stack, small pieces higher, slivers on top.
    const weights = (kind: Kind) =>
      Array.from({ length: inks }, (_, i) => {
        const up = inks === 1 ? 0.5 : i / (inks - 1)
        if (kind === 'sliver') return inks > 2 && i === inks - 1 ? 1 : 0.02
        const w = kind === 'large' ? 1.3 - up * 1.1 : kind === 'medium' ? 1 - Math.abs(up - 0.45) : 0.25 + up
        // The top ink is mostly kept for slivers and a few splinters.
        return inks > 2 && i === inks - 1 ? w * 0.25 : w
      })
    const paths: string[] = Array.from({ length: inks }, () => '')
    for (const b of blades) paths[rng.weighted(weights(b.kind))] += wrappedPoly(outline(rng, b, dirs))
    return paths.map((d) => ({ d }))
  },
}
