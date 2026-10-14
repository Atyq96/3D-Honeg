/** Minimal 2D vector helpers for the flat garment outlines. */

export type V2 = readonly [number, number]

export const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]]
export const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]]
export const scale = (a: V2, s: number): V2 => [a[0] * s, a[1] * s]
export const dist = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1])
export const lerp2 = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
export const norm = (a: V2): V2 => {
  const l = Math.hypot(a[0], a[1]) || 1
  return [a[0] / l, a[1] / l]
}
export const mirrorX = (a: V2): V2 => [-a[0], a[1]]

export function quadBezier(p0: V2, c: V2, p1: V2, steps: number): V2[] {
  const out: V2[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]])
  }
  return out
}
