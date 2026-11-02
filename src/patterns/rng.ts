/**
 * Seeded randomness. Every pattern draws all of its random choices from one
 * mulberry32 stream, so the same type + seed + params always produce the same
 * design, on every device.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number
  /** Uniform in [lo, hi). */
  range(lo: number, hi: number): number
  /** Integer in [lo, hi], both inclusive. */
  int(lo: number, hi: number): number
  pick<T>(items: readonly T[]): T
  /** True with probability p. */
  chance(p: number): boolean
  /** Index into `weights`, chosen in proportion to the weights. */
  weighted(weights: readonly number[]): number
  /** A fresh, independent stream (for a sub-part that shouldn't shift the others). */
  fork(): Rng
}

/** mulberry32 — small, fast 32-bit PRNG with good statistics; integer maths only, so identical everywhere. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed)
  const rng: Rng = {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
    weighted: (weights) => {
      let r = next() * weights.reduce((a, b) => a + b, 0)
      for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i
      return weights.length - 1
    },
    fork: () => createRng(Math.floor(next() * 4294967296)),
  }
  return rng
}

/** Mixes a seed with a label (e.g. the pattern type), so two types with the same seed don't share random streams. */
export function mixSeed(seed: number, label: string): number {
  let h = (seed >>> 0) ^ 0x9e3779b9
  for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 0x85ebca6b) >>> 0
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/** A random seed for "Shuffle" (1 … 2^31 − 2, the range designs store). */
export const randomSeed = () => 1 + Math.floor(Math.random() * 2147483645)
