/**
 * Geometry helpers. Pattern geometry only uses + − × ÷ and √ (which IEEE 754
 * rounds the same way on every machine) plus the sine/cosine below, instead of
 * Math.sin/cos (whose last bits may differ between browsers). That keeps the
 * SVG byte-identical wherever it is generated.
 */

export type Pt = [number, number]

/** The pattern tile is 1000 × 1000 units. */
export const TILE = 1000

const PI = 3.141592653589793
const HALF_PI = PI / 2
const TWO_PI = 2 * PI

export const rad = (deg: number) => (deg * PI) / 180

/** Sine from its Taylor series (error < 1e-11), arithmetic only. */
export function dsin(x: number): number {
  x -= TWO_PI * Math.round(x / TWO_PI)
  if (x > HALF_PI) x = PI - x
  else if (x < -HALF_PI) x = -PI - x
  const x2 = x * x
  return x * (1 - (x2 / 6) * (1 - (x2 / 20) * (1 - (x2 / 42) * (1 - (x2 / 72) * (1 - (x2 / 110) * (1 - (x2 / 156) * (1 - x2 / 210)))))))
}

export const dcos = (x: number) => dsin(x + HALF_PI)

/** Unit vector for an angle in degrees, counter-clockwise as seen (tile y points down). */
export const dir = (deg: number): Pt => [dcos(rad(deg)), -dsin(rad(deg))]

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}
/** Always-positive remainder. */
export const mod = (v: number, m: number) => ((v % m) + m) % m

export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]]
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]]
export const scale = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k]
export const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0]

/** Where the line p + t·d meets the line q + s·e, as t (null when parallel). */
export function intersectT(p: Pt, d: Pt, q: Pt, e: Pt): number | null {
  const den = cross(d, e)
  return Math.abs(den) < 1e-9 ? null : cross(sub(q, p), e) / den
}

/**
 * A direction that closes on itself on the tile's torus: the integer step
 * (p, q) nearest to `deg`. Bands and streaks laid out along it in the frame's
 * (s, t) coordinates tile seamlessly — s repeats every `sPeriod` units, and the
 * pattern repeats across it every `tPeriod` units.
 */
export interface TorusFrame {
  along: Pt
  across: Pt
  sPeriod: number
  tPeriod: number
  /** Tile coordinates of (s, t). */
  at: (s: number, t: number) => Pt
}

const STEPS: Pt[] = [
  [1, 0], [2, -1], [1, -1], [1, -2], [0, -1], [-1, -2], [-1, -1], [-2, -1],
  [-1, 0], [-2, 1], [-1, 1], [-1, 2], [0, 1], [1, 2], [1, 1], [2, 1],
]

export function torusFrame(deg: number): TorusFrame {
  const want = dir(deg)
  let best = STEPS[0]
  let bestDot = -2
  for (const s of STEPS) {
    const len = Math.sqrt(s[0] * s[0] + s[1] * s[1])
    const d = (s[0] * want[0] + s[1] * want[1]) / len
    if (d > bestDot + 1e-9) {
      bestDot = d
      best = s
    }
  }
  const len = Math.sqrt(best[0] * best[0] + best[1] * best[1])
  const along: Pt = [best[0] / len, best[1] / len]
  // Rotated 90° counter-clockwise as seen (towards "up" for a rightward band).
  const across: Pt = [along[1], -along[0]]
  return {
    along,
    across,
    sPeriod: TILE * len,
    tPeriod: TILE / len,
    at: (s, t) => [s * along[0] + t * across[0], s * along[1] + t * across[1]],
  }
}

export function bbox(pts: Pt[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of pts) {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return [x0, y0, x1, y1]
}

/** Signed area (shoelace); positive when clockwise as seen. */
export function polygonArea(pts: Pt[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % pts.length]
    a += x0 * y1 - x1 * y0
  }
  return a / 2
}
