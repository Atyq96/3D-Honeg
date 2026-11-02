import { dcos, dsin, mod, TILE } from './math'
import type { Rng } from './rng'

/**
 * Tileable gradient (Perlin-style) noise. The lattice wraps every `period`
 * cells, and one period spans the whole tile, so anything built from it tiles
 * seamlessly. Arithmetic only (see math.ts), so it's identical everywhere.
 */
export type Field = (x: number, y: number) => number

const GRADIENTS = Array.from({ length: 16 }, (_, i) => [dcos((i * Math.PI) / 8), dsin((i * Math.PI) / 8)] as const)
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/** Noise over tile coordinates (0–1000) with `period` lattice cells across the tile; roughly −0.7…0.7. */
export function periodicNoise(rng: Rng, period: number): Field {
  const p = Math.max(1, Math.round(period))
  const grads = Array.from({ length: p * p }, () => GRADIENTS[Math.floor(rng.next() * 16)])
  const cell = TILE / p
  return (x, y) => {
    const fx = mod(x, TILE) / cell
    const fy = mod(y, TILE) / cell
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const tx = fx - x0
    const ty = fy - y0
    const g = (i: number, j: number, dx: number, dy: number) => {
      const v = grads[mod(j, p) * p + mod(i, p)]
      return v[0] * dx + v[1] * dy
    }
    const u = fade(tx)
    const v = fade(ty)
    const a = g(x0, y0, tx, ty) + u * (g(x0 + 1, y0, tx - 1, ty) - g(x0, y0, tx, ty))
    const b = g(x0, y0 + 1, tx, ty - 1) + u * (g(x0 + 1, y0 + 1, tx - 1, ty - 1) - g(x0, y0 + 1, tx, ty - 1))
    return a + v * (b - a)
  }
}

/** Fractal sum of `octaves` noise layers, each twice as fine and half as strong; normalised to about −1…1. */
export function fbm(rng: Rng, period: number, octaves: number, gain = 0.5): Field {
  const layers = Array.from({ length: octaves }, (_, i) => periodicNoise(rng, Math.round(period) * 2 ** i))
  let norm = 0
  for (let i = 0, a = 1; i < octaves; i++, a *= gain) norm += a
  const k = 1.45 / norm
  return (x, y) => {
    let sum = 0
    for (let i = 0, a = 1; i < octaves; i++, a *= gain) sum += a * layers[i](x, y)
    return sum * k
  }
}

/** Tileable 1-D noise along x (one period = the tile width), about −1…1. */
export function periodicNoise1d(rng: Rng, period: number): (x: number) => number {
  const p = Math.max(1, Math.round(period))
  const values = Array.from({ length: p }, () => rng.next() * 2 - 1)
  const cell = TILE / p
  return (x) => {
    const f = mod(x, TILE) / cell
    const i = Math.floor(f)
    const t = fade(f - i)
    return values[mod(i, p)] + t * (values[mod(i + 1, p)] - values[mod(i, p)])
  }
}
