import { generatePattern, recolor, svgDataUrl, toCanvas, type Preset } from '../patterns'
import type { PatternFill } from './design'
import { hexToRgb } from '../lib/color'

/**
 * From a zone's pattern fill to SVG, pixels and thumbnails. Everything is
 * cached by what changes the picture, so switching zones, steps or views
 * doesn't regenerate or re-rasterise anything.
 */

/** Imported artwork can be large; it's identified by a short id rather than hashed on every render. */
const artIds = new Map<string, number>()
const artId = (art: string) => {
  let id = artIds.get(art)
  if (id === undefined) artIds.set(art, (id = artIds.size + 1))
  return id
}

/** Everything that changes the tile's pixels (size and angle only move it). */
export const fillKey = (fill: PatternFill, bg: string) =>
  [fill.type, fill.seed, fill.scale, fill.direction, fill.density, fill.opacity, bg, ...fill.colors, fill.art ? artId(fill.art) : ''].join('|')

/** `ink` printed at `alpha` over `bg`, as the flat colour it looks like. */
function mix(bg: string, ink: string, alpha: number): string {
  const a = hexToRgb(bg)
  const b = hexToRgb(ink)
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * alpha).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/**
 * The fill's 1000 × 1000 tile, layer 0 in the fabric colour `bg`. Ink opacity
 * is applied by mixing each ink with the fabric — the exact same picture as
 * translucent inks, but still flat colours, so the print file matches.
 */
export function fillSvg(fill: PatternFill, bg: string): string {
  const colors = [bg, ...fill.colors.map((c) => (fill.opacity < 1 ? mix(bg, c, fill.opacity) : c))]
  if (fill.type === 'artwork') return recolor(fill.art ?? '', colors)
  return generatePattern(fill.type, { colors, seed: fill.seed, scale: fill.scale, angle: fill.direction, density: fill.density }).svg
}

/** Small least-recently-used cache. */
function lru<V>(limit: number, dispose?: (v: V) => void) {
  const map = new Map<string, V>()
  return (key: string, make: () => V): V => {
    let v = map.get(key)
    if (v !== undefined) map.delete(key)
    else {
      v = make()
      if (map.size >= limit) {
        const [oldKey, old] = map.entries().next().value!
        map.delete(oldKey)
        dispose?.(old)
      }
    }
    map.set(key, v)
    return v
  }
}

const render = (fill: PatternFill, bg: string, px: number) => toCanvas(fillSvg(fill, bg), px)

/**
 * Texture resolution: 2048 px on desktops, 1024 on phones and tablets (a
 * 2048² canvas is 16 MB of memory; mobile browsers budget tightly).
 */
export function textureSize(): number {
  if (typeof window === 'undefined') return 1024
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const small = Math.min(window.screen?.width ?? 1920, window.screen?.height ?? 1080) < 700
  return coarse || small ? 1024 : 2048
}

// Large canvases: only the few most recent are kept here (a texture still using an evicted one keeps it alive).
const textureCache = lru<HTMLCanvasElement>(4)
export const fillCanvas = (fill: PatternFill, bg: string, px = textureSize()) => textureCache(`${fillKey(fill, bg)}@${px}`, () => render(fill, bg, px))

const thumbCache = lru<string>(160)
/** PNG data URL of a small tile (zone swatches, the current pattern). */
export const fillThumb = (fill: PatternFill, bg: string, px = 96) =>
  thumbCache(`${fillKey(fill, bg)}@${px}`, () => render(fill, bg, px).toDataURL('image/png'))

const svgUrlCache = lru<string>(24)
/** SVG data URL of the full-quality tile (the flat preview and export sheet). */
export const fillSvgUrl = (fill: PatternFill, bg: string) => svgUrlCache(fillKey(fill, bg), () => svgDataUrl(fillSvg(fill, bg)))

/** Preset thumbnails, generated progressively so the library opens instantly even on phones. */
const presetThumbs = new Map<string, string>()
const listeners = new Set<() => void>()
const queue: Preset[] = []
let scheduled = false
const idle = (cb: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(cb, { timeout: 120 }) : setTimeout(cb, 16))

function pump() {
  scheduled = false
  const start = performance.now()
  // A few per slice, then let the page breathe.
  while (queue.length && performance.now() - start < 12) {
    const p = queue.shift()!
    if (presetThumbs.has(p.id)) continue
    const canvas = toCanvas(generatePattern(p.type, { colors: p.colors, seed: p.seed, scale: p.scale, density: p.density, angle: p.angle }).svg, 128)
    presetThumbs.set(p.id, canvas.toDataURL('image/png'))
  }
  listeners.forEach((l) => l())
  if (queue.length) schedule()
}
function schedule() {
  if (!scheduled) {
    scheduled = true
    idle(pump)
  }
}

export const presetThumb = (id: string) => presetThumbs.get(id)

/** Queues thumbnails for the given presets; `onReady` runs as batches arrive. Returns an unsubscribe. */
export function loadPresetThumbs(presets: Preset[], onReady: () => void): () => void {
  listeners.add(onReady)
  const missing = presets.filter((p) => !presetThumbs.has(p.id) && !queue.includes(p))
  if (missing.length) {
    queue.push(...missing)
    schedule()
  }
  return () => listeners.delete(onReady)
}
