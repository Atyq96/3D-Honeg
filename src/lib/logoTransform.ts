import type { PrintArea } from '../garments/types'
import type { V2 } from '../garments/flat/geom2d'
import { t } from '../i18n'

/** Logo transform as edited in the UI. Offsets are in the view space of the chosen side. */
export interface LogoTransform {
  widthCm: number
  rotationDeg: number
  offsetXCm: number
  offsetYCm: number
}

export const MIN_LOGO_CM = 3
export const MAX_LOGO_CM = 34

const round1 = (v: number) => Math.round(v * 10) / 10

/** Axis-aligned extents (metres) of a rotated logo of the given width and aspect (w / h). */
export function rotatedExtents(widthM: number, aspect: number, deg: number): [number, number] {
  const h = widthM / aspect
  const r = (deg * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  return [widthM * c + h * s, widthM * s + h * c]
}

/** Largest logo width (cm) that fits the print area at this rotation. */
export function maxWidthCm(area: PrintArea, aspect: number, deg: number): number {
  const [ew, eh] = rotatedExtents(1, aspect, deg)
  const w = Math.min((area.xMax - area.xMin) / ew, (area.yMax - area.yMin) / eh)
  return Math.max(MIN_LOGO_CM, Math.min(MAX_LOGO_CM, Math.floor(w * 1000) / 10))
}

/** Allowed offset range (cm) around `anchor` so the logo stays inside the print area. */
export function offsetRange(t: LogoTransform, aspect: number, area: PrintArea, anchor: V2) {
  const [ew, eh] = rotatedExtents(t.widthCm / 100, aspect, t.rotationDeg)
  const span = (min: number, max: number, extent: number, a: number): [number, number] => {
    const lo = min + extent / 2 - a
    const hi = max - extent / 2 - a
    if (lo > hi) {
      const mid = (min + max) / 2 - a
      return [round1(mid * 100), round1(mid * 100)]
    }
    return [Math.ceil(lo * 1000) / 10, Math.floor(hi * 1000) / 10]
  }
  return {
    x: span(area.xMin, area.xMax, ew, anchor[0]),
    y: span(area.yMin, area.yMax, eh, anchor[1]),
  }
}

/**
 * Clamps size first, then position, so the logo never leaves the printable
 * fabric. With `keepOut` (the brand mark plus clear space), a logo that would
 * overlap it moves to the nearest position that clears it, and is only shrunk
 * when no position inside the print area can.
 */
export function clampTransform(t: LogoTransform, aspect: number, area: PrintArea, anchor: V2, keepOut?: PrintArea): LogoTransform {
  const rotationDeg = ((((Math.round(t.rotationDeg) + 180) % 360) + 360) % 360) - 180
  let widthCm = round1(Math.min(maxWidthCm(area, aspect, rotationDeg), Math.max(MIN_LOGO_CM, t.widthCm)))
  for (;;) {
    const placed = placeInArea({ ...t, widthCm, rotationDeg }, aspect, area, anchor)
    if (!keepOut) return placed
    const cleared = clearKeepOut(placed, aspect, area, anchor, keepOut)
    if (cleared) return cleared
    if (widthCm <= MIN_LOGO_CM) return placed
    widthCm = round1(Math.max(MIN_LOGO_CM, widthCm * 0.9))
  }
}

function placeInArea(t: LogoTransform, aspect: number, area: PrintArea, anchor: V2): LogoTransform {
  const range = offsetRange(t, aspect, area, anchor)
  const clamp = (v: number, [lo, hi]: [number, number]) => round1(Math.min(hi, Math.max(lo, v)))
  return { ...t, offsetXCm: clamp(t.offsetXCm, range.x), offsetYCm: clamp(t.offsetYCm, range.y) }
}

/** Moves the logo out of the keep-out zone along one axis (nearest option), or null if it can't fit. */
function clearKeepOut(t: LogoTransform, aspect: number, area: PrintArea, anchor: V2, k: PrintArea): LogoTransform | null {
  const [ew, eh] = rotatedExtents(t.widthCm / 100, aspect, t.rotationDeg)
  const cx = anchor[0] + t.offsetXCm / 100
  const cy = anchor[1] + t.offsetYCm / 100
  // Centre positions whose bounding box would overlap the keep-out (Minkowski sum).
  const kx0 = k.xMin - ew / 2, kx1 = k.xMax + ew / 2, ky0 = k.yMin - eh / 2, ky1 = k.yMax + eh / 2
  if (cx <= kx0 || cx >= kx1 || cy <= ky0 || cy >= ky1) return t
  const eps = 1e-9
  const fits = ([x, y]: V2) =>
    x >= area.xMin + ew / 2 - eps && x <= area.xMax - ew / 2 + eps && y >= area.yMin + eh / 2 - eps && y <= area.yMax - eh / 2 + eps
  // 1.5 mm of slack so rounding to whole millimetres can't slip back inside.
  const pad = 0.0015
  const options = ([[kx0 - pad, cy], [kx1 + pad, cy], [cx, ky0 - pad], [cx, ky1 + pad]] as V2[])
    .filter(fits)
    .sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy))
  if (!options.length) return null
  const [x, y] = options[0]
  return { ...t, offsetXCm: round1((x - anchor[0]) * 100), offsetYCm: round1((y - anchor[1]) * 100) }
}

/* ------------------------------------------------------------------ */
/* Direct-manipulation helpers (ported from the OpenMerch editor's    */
/* Konva transformer behaviour, adapted to garment view space).       */
/* ------------------------------------------------------------------ */

/** Rotation snaps every 45° within ±8°, like OpenMerch's transformer (rotationSnaps / rotationSnapTolerance). */
export function snapRotation(deg: number, step = 45, tolerance = 8): number {
  const nearest = Math.round(deg / step) * step
  return Math.abs(deg - nearest) <= tolerance ? nearest : deg
}

export interface SnapGuides {
  /** Vertical guide lines at these view-space x positions (metres). */
  x: number[]
  /** Horizontal guide lines at these view-space y positions (metres). */
  y: number[]
}

/**
 * Snaps a dragged logo centre to the print area's centre lines and edges when
 * within `threshold` (metres), returning the guides to draw. Per axis, the
 * closest candidate wins so centre and edge snaps never fight.
 */
export function snapCenter(center: V2, extents: [number, number], area: PrintArea, threshold: number): { center: V2; guides: SnapGuides } {
  const axis = (value: number, min: number, max: number, extent: number) => {
    const candidates: [target: number, guide: number][] = [
      [(min + max) / 2, (min + max) / 2],
      [min + extent / 2, min],
      [max - extent / 2, max],
    ]
    let best: [number, number] | null = null
    for (const c of candidates) {
      const d = Math.abs(value - c[0])
      if (d <= threshold && (!best || d < Math.abs(value - best[0]))) best = c
    }
    return best
  }
  const sx = axis(center[0], area.xMin, area.xMax, extents[0])
  const sy = axis(center[1], area.yMin, area.yMax, extents[1])
  return {
    center: [sx ? sx[0] : center[0], sy ? sy[0] : center[1]],
    guides: { x: sx ? [sx[1]] : [], y: sy ? [sy[1]] : [] },
  }
}

export type AlignX = 'left' | 'center' | 'right'
export type AlignY = 'top' | 'center' | 'bottom'

/** Offsets (cm) that place the logo at one of the nine print-area alignment points (OpenMerch "Position" grid). */
export function alignOffsets(t: LogoTransform, aspect: number, area: PrintArea, anchor: V2, ax: AlignX, ay: AlignY) {
  const [ew, eh] = rotatedExtents(t.widthCm / 100, aspect, t.rotationDeg)
  const x = ax === 'left' ? area.xMin + ew / 2 : ax === 'right' ? area.xMax - ew / 2 : (area.xMin + area.xMax) / 2
  // View space is y-up: "top" is the print area's yMax.
  const y = ay === 'top' ? area.yMax - eh / 2 : ay === 'bottom' ? area.yMin + eh / 2 : (area.yMin + area.yMax) / 2
  return { offsetXCm: round1((x - anchor[0]) * 100), offsetYCm: round1((y - anchor[1]) * 100) }
}

/** Short human description of the logo's appearance tweaks, e.g. "flipped · fill #FFFFFF · 80% opacity". */
export function describeLook(p: { flipX: boolean; flipY: boolean; tint: string | null; opacity: number; locked: boolean }): string {
  const parts: string[] = []
  const m = t().look
  if (p.flipX || p.flipY) parts.push(p.flipX && p.flipY ? m.flippedBoth : p.flipX ? m.flippedH : m.flippedV)
  if (p.tint) parts.push(m.fill(p.tint))
  if (p.opacity < 1) parts.push(m.opacity(Math.round(p.opacity * 100)))
  if (p.locked) parts.push(m.locked)
  return parts.join(' · ')
}
