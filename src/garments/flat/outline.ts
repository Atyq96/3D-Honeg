import type { TeeParams } from './teeParams'
import { add, lerp2, mirrorX, norm, quadBezier, scale, sub, type V2 } from './geom2d'

/** Kind of outline edge: a seam, the neckline, or an opening (hem / sleeve opening). */
export type BoundaryKind = 'seam' | 'neck' | 'open'

export interface OutlineSegment {
  kind: BoundaryKind
  /** Dense polyline; consecutive segments share endpoints. */
  pts: V2[]
}

export interface PanelOutline {
  side: 'front' | 'back'
  /** Closed loop of segments (clockwise, starting at centre neck). */
  segments: OutlineSegment[]
  /** Body/sleeve split lines, right then left, each running from top to armpit. */
  chords: V2[][]
}

export interface TeeOutline {
  front: PanelOutline
  back: PanelOutline
  key: { hps: V2; shoulder: V2; armpit: V2; cuffTop: V2; cuffBottom: V2; hem: V2 }
}

const STEPS = 24

function neckArc(p: TeeParams, dip: number, t0: number, t1: number): V2[] {
  const out: V2[] = []
  for (let i = 0; i <= STEPS; i++) {
    const t = t0 + ((t1 - t0) * i) / STEPS
    out.push([p.hpsX * Math.sin(t), p.hpsY - dip * Math.cos(t)])
  }
  return out
}

function catmullRom(points: V2[], steps: number): V2[] {
  const pts = [points[0], ...points, points[points.length - 1]]
  const out: V2[] = []
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]]
    for (let s = i === 1 ? 0 : 1; s <= steps; s++) {
      const t = s / steps
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  return out
}

const reverseMirror = (pts: V2[]) => pts.map(mirrorX).reverse()

export function buildTeeOutline(p: TeeParams): TeeOutline {
  const theta = (p.sleeve.angleDeg * Math.PI) / 180
  const dir: V2 = [Math.cos(theta), -Math.sin(theta)]
  const down: V2 = [-Math.sin(theta), -Math.cos(theta)]

  const hps: V2 = [p.hpsX, p.hpsY]
  const shoulder: V2 = [p.shoulderX, p.shoulderY]
  const cuffTop = add(shoulder, scale(dir, p.sleeve.length))
  const cuffBottom = add(cuffTop, scale(down, p.sleeve.cuffWidth))
  const armpit: V2 = [p.chestHalf, p.armpitY]
  const hem: V2 = [p.hemHalf, 0]

  // Shoulder fillet between shoulder seam and sleeve top.
  const rS = 0.026
  const s1 = add(shoulder, scale(norm(sub(hps, shoulder)), rS))
  const s2 = add(shoulder, scale(norm(sub(cuffTop, shoulder)), rS))
  const shoulderFillet = quadBezier(s1, shoulder, s2, 8)
  const shoulderMid = shoulderFillet[4]

  // Underarm fillet between the sleeve underside and the side seam.
  const rA = 0.024
  const a1 = add(armpit, scale(norm(sub(cuffBottom, armpit)), rA))
  const a2 = add(armpit, [0.004, -rA])
  const armFillet = quadBezier(a1, armpit, a2, 8)
  const armMid = armFillet[4]

  const sideSeam = catmullRom([a2, [p.waistHalf, p.waistY], hem], 12)

  // Shoulder seam + sleeve top as one seam run (front view silhouette).
  const shoulderRun: V2[] = [hps, ...shoulderFillet, cuffTop]
  const underRun: V2[] = [cuffBottom, ...armFillet, ...sideSeam.slice(1)]

  // Set-in armhole seam (also the fallback split line for raglan cuts).
  const formMid = lerp2(shoulderMid, armMid, 0.5)
  const formChord = quadBezier(shoulderMid, add(formMid, [0.014, 0]), armMid, 20)

  const raglanT = p.sleeve.style === 'raglan' ? Math.asin(p.sleeve.raglanNeckT ?? 0.45) : null

  const panel = (side: 'front' | 'back'): PanelOutline => {
    const dip = side === 'front' ? p.neckDipFront : p.neckDipBack

    // Right half, from centre neck going clockwise to centre hem.
    const right: OutlineSegment[] = []
    if (raglanT !== null) {
      right.push({ kind: 'neck', pts: neckArc(p, dip, 0, raglanT) })
      right.push({ kind: 'neck', pts: neckArc(p, dip, raglanT, Math.PI / 2) })
    } else {
      right.push({ kind: 'neck', pts: neckArc(p, dip, 0, Math.PI / 2) })
    }
    right.push({ kind: 'seam', pts: shoulderRun })
    right.push({ kind: 'open', pts: [cuffTop, cuffBottom] })
    right.push({ kind: 'seam', pts: underRun })
    right.push({ kind: 'open', pts: [hem, [0, 0]] })

    // Left half mirrors the right half in reverse.
    const left: OutlineSegment[] = right
      .slice()
      .reverse()
      .map((s) => ({ kind: s.kind, pts: reverseMirror(s.pts) }))

    let chord: V2[]
    if (raglanT !== null) {
      const chordTop: V2 = [p.hpsX * Math.sin(raglanT), p.hpsY - dip * Math.cos(raglanT)]
      const mid = lerp2(chordTop, armMid, 0.5)
      chord = quadBezier(chordTop, add(mid, [-0.012, -0.018]), armMid, 20)
    } else {
      chord = formChord
    }

    return {
      side,
      segments: [...right, ...left],
      chords: [chord, chord.map(mirrorX)],
    }
  }

  return {
    front: panel('front'),
    back: panel('back'),
    key: { hps, shoulder, armpit, cuffTop, cuffBottom, hem },
  }
}

/** Flattened closed polygon of a panel outline (dense, no duplicate joints). */
export function outlinePolygon(panel: PanelOutline): V2[] {
  const out: V2[] = []
  for (const seg of panel.segments) out.push(...seg.pts.slice(0, -1))
  return out
}
