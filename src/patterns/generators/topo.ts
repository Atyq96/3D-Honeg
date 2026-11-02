import { clamp, type Pt } from '../math'
import { fbm } from '../noise'
import { smoothD, wrapOffsets } from '../svg'
import type { PatternTypeDef } from '../types'

/**
 * Topographic map: contour lines of a tileable noise field (marching squares),
 * chained into continuous lines, simplified and smoothed. Lines alternate
 * between the first inks; every fourth one is a bold index contour in the last.
 */

const N = 125 // grid cells across the tile (8 units each)

/** Ramer–Douglas–Peucker: drops points within `tol` of the line through their neighbours. */
function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const [ax, ay] = pts[a]
    const dx = pts[b][0] - ax
    const dy = pts[b][1] - ay
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    let worst = -1
    let at = -1
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len
      if (d > worst) {
        worst = d
        at = i
      }
    }
    if (worst > tol) {
      keep[at] = 1
      stack.push([a, at], [at, b])
    }
  }
  return pts.filter((_, i) => keep[i])
}

/** Contour lines of `values` (N × N, wrapping) at `level`, as unwrapped polylines. */
function contours(values: Float64Array, level: number): { pts: Pt[]; closed: boolean }[] {
  const w = (i: number) => (i === N ? 0 : i)
  const V = (i: number, j: number) => values[w(j) * N + w(i)]
  const X = (i: number) => (i * 1000) / N
  // Each crossing is identified by its (wrapped) cell edge, so neighbouring cells — and the
  // cells either side of the tile edge — agree on it exactly. Even ids: top edges; odd: left edges.
  const segIds: number[] = []
  const segPts: number[] = []
  const add = (e1: number, x1: number, y1: number, e2: number, x2: number, y2: number) => {
    segIds.push(e1, e2)
    segPts.push(x1, y1, x2, y2)
  }
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const va = V(i, j), vb = V(i + 1, j), vc = V(i + 1, j + 1), vd = V(i, j + 1)
      const code = (va > level ? 8 : 0) | (vb > level ? 4 : 0) | (vc > level ? 2 : 0) | (vd > level ? 1 : 0)
      if (code === 0 || code === 15) continue
      // Crossing points on the four edges: top, bottom, left, right.
      const T = () => [2 * (j * N + i), X(i + (level - va) / (vb - va)), X(j)] as const
      const B = () => [2 * (w(j + 1) * N + i), X(i + (level - vd) / (vc - vd)), X(j + 1)] as const
      const L = () => [2 * (j * N + i) + 1, X(i), X(j + (level - va) / (vd - va))] as const
      const R = () => [2 * (j * N + w(i + 1)) + 1, X(i + 1), X(j + (level - vb) / (vc - vb))] as const
      const seg = (p: readonly [number, number, number], q: readonly [number, number, number]) => add(p[0], p[1], p[2], q[0], q[1], q[2])
      const centreHigh = (va + vb + vc + vd) / 4 > level
      switch (code) {
        case 1: case 14: seg(L(), B()); break
        case 2: case 13: seg(B(), R()); break
        case 3: case 12: seg(L(), R()); break
        case 4: case 11: seg(T(), R()); break
        case 6: case 9: seg(T(), B()); break
        case 7: case 8: seg(L(), T()); break
        case 5: // b, d high
          if (centreHigh) {
            seg(L(), T())
            seg(B(), R())
          } else {
            seg(T(), R())
            seg(L(), B())
          }
          break
        case 10: // a, c high
          if (centreHigh) {
            seg(T(), R())
            seg(L(), B())
          } else {
            seg(L(), T())
            seg(B(), R())
          }
          break
      }
    }

  // Every crossing joins exactly two segments: index them both.
  const count = segIds.length / 2
  const first = new Int32Array(2 * N * N).fill(-1)
  const second = new Int32Array(2 * N * N).fill(-1)
  for (let k = 0; k < segIds.length; k++) {
    const e = segIds[k]
    if (first[e] < 0) first[e] = k >> 1
    else second[e] = k >> 1
  }
  const used = new Uint8Array(count)
  const lines: { pts: Pt[]; closed: boolean }[] = []
  for (let k = 0; k < count; k++) {
    if (used[k]) continue
    used[k] = 1
    const ids = [segIds[2 * k], segIds[2 * k + 1]]
    const pts: Pt[] = [[segPts[4 * k], segPts[4 * k + 1]], [segPts[4 * k + 2], segPts[4 * k + 3]]]
    // Chain segments end to end; a piece found across the tile edge is shifted to continue the line.
    const extend = (atEnd: boolean) => {
      for (;;) {
        const id = atEnd ? ids[ids.length - 1] : ids[0]
        const here = atEnd ? pts[pts.length - 1] : pts[0]
        const next = !used[first[id]] && first[id] >= 0 ? first[id] : second[id] >= 0 && !used[second[id]] ? second[id] : -1
        if (next < 0) return
        used[next] = 1
        const fromFirst = segIds[2 * next] === id
        const [fx, fy, tx, ty] = fromFirst ? [segPts[4 * next], segPts[4 * next + 1], segPts[4 * next + 2], segPts[4 * next + 3]] : [segPts[4 * next + 2], segPts[4 * next + 3], segPts[4 * next], segPts[4 * next + 1]]
        const to = segIds[2 * next + (fromFirst ? 1 : 0)]
        const pt: Pt = [tx + here[0] - fx, ty + here[1] - fy]
        if (atEnd) {
          ids.push(to)
          pts.push(pt)
        } else {
          ids.unshift(to)
          pts.unshift(pt)
        }
      }
    }
    extend(true)
    extend(false)
    // A loop closes on itself only if it came back to the same spot (not one tile over).
    const p0 = pts[0], p1 = pts[pts.length - 1]
    const closed = ids.length > 3 && ids[0] === ids[ids.length - 1] && Math.abs(p0[0] - p1[0]) < 1 && Math.abs(p0[1] - p1[1]) < 1
    lines.push({ pts: closed ? pts.slice(0, -1) : pts, closed })
  }
  return lines
}

export const topo: PatternTypeDef = {
  id: 'topo',
  minLayers: 3,
  maxLayers: 5,
  uses: { scale: true, angle: false, density: true },
  defaultAngle: 0,
  generate({ rng, inks, scale, density }) {
    const field = fbm(rng.fork(), clamp(Math.round(3 / scale), 2, 6), 2, 0.4)
    const values = new Float64Array(N * N)
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) values[j * N + i] = field((i * 1000) / N, (j * 1000) / N)
    const sorted = [...values].sort((a, b) => a - b)
    const lo = sorted[Math.floor(sorted.length * 0.02)]
    const hi = sorted[Math.floor(sorted.length * 0.98)]
    const count = Math.round(9 + 9 * density)
    const step = (hi - lo) / count
    const offset = rng.next()

    const thin = Math.max(1, inks - 1)
    const thinW = 4.2 * scale
    const boldW = 9 * scale
    const paths: string[] = Array.from({ length: inks }, () => '')
    let thinLines = 0
    for (let k = 0; k < count; k++) {
      const level = lo + (k + offset) * step
      const index = k % 4 === 2
      const layer = index ? inks - 1 : thinLines++ % thin
      const width = index ? boldW : thinW
      for (const line of contours(values, level)) {
        const pts = simplify(line.pts, 0.9)
        // Tiny closed loops read as specks once printed.
        if (pts.length < 2 || (line.closed && pts.length < 9)) continue
        for (const [dx, dy] of wrapOffsets(pts, width)) {
          paths[layer] += smoothD(pts.map(([x, y]): Pt => [x + dx, y + dy]), line.closed)
        }
      }
    }
    return paths.map((d, i) => ({ d, stroke: { width: i === inks - 1 ? boldW : thinW } }))
  },
}
