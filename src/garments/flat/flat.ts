import type { FlatOutline, FlatSide } from '../types'
import type { TeeParams } from './teeParams'
import { buildTeeOutline, outlinePolygon, type PanelOutline } from './outline'
import { dist, type V2 } from './geom2d'

function nearestIndex(poly: V2[], p: V2) {
  let best = 0
  let bestD = Infinity
  poly.forEach((q, i) => {
    const d = dist(p, q)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

function flatSide(panel: PanelOutline): FlatSide {
  const body = outlinePolygon(panel)
  const sleeves = panel.chords.map((chord) => {
    const a = nearestIndex(body, chord[0])
    const b = nearestIndex(body, chord[chord.length - 1])
    const [i0, i1] = a < b ? [a, b] : [b, a]
    const run = body.slice(i0, i1 + 1)
    const end = run[run.length - 1]
    const closing = dist(chord[0], end) < dist(chord[chord.length - 1], end) ? chord : chord.slice().reverse()
    return [...run, ...closing.slice(1, -1)]
  })
  const neck = panel.segments.filter((s) => s.kind === 'neck')
  // Neck segments are first (right half) and last (left half) in the loop; join left → right.
  const half = Math.ceil(neck.length / 2)
  const right = neck.slice(0, half).flatMap((s) => s.pts)
  const left = neck.slice(half).flatMap((s) => s.pts)
  return { body, sleeves, neckline: [...left, ...right] }
}

/** Front/back flat sketches. The tee is symmetric, so the back outline is valid in back view space too. */
export function buildTeeFlat(params: TeeParams): FlatOutline {
  const outline = buildTeeOutline(params)
  return { front: flatSide(outline.front), back: flatSide(outline.back) }
}
