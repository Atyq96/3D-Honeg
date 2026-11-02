import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import type { PatternFill } from '../../state/design'
import { fillCanvas, fillKey } from '../../state/patternArt'
import { PAINT_ZONE_IDS, REGION_IDS, type ZoneId } from '../../garments/zones'

const ZONES: ZoneId[] = [...REGION_IDS, ...PAINT_ZONE_IDS]

/** A patterned part or paint zone: the pattern and the fabric colour under it (its layer 0). */
export type PatternSources = Partial<Record<ZoneId, { fill: PatternFill; bg: string }>>

type Entry = { key: string; texture: CanvasTexture }

/**
 * One repeating texture per patterned part or paint zone. A zone is
 * re-rasterised only when its own pixels change (identical patterns share
 * the cached canvas); stale and removed textures are disposed.
 */
export function usePatternTextures(sources: PatternSources) {
  const wanted = useMemo(() => {
    const out: Partial<Record<ZoneId, { key: string; fill: PatternFill; bg: string }>> = {}
    for (const z of ZONES) {
      const src = sources[z]
      if (src) out[z] = { key: fillKey(src.fill, src.bg), ...src }
    }
    return out
  }, [sources])

  const [textures, setTextures] = useState<Partial<Record<ZoneId, Entry>>>({})
  const live = useRef({ wanted, textures })
  useEffect(() => {
    live.current = { wanted, textures }
  })

  const signature = ZONES.map((r) => wanted[r]?.key ?? '-').join('§')
  useEffect(() => {
    const next: Partial<Record<ZoneId, Entry>> = {}
    let changed = false
    for (const r of ZONES) {
      const want = wanted[r]
      if (!want || live.current.textures[r]?.key === want.key) continue
      const texture = new CanvasTexture(fillCanvas(want.fill, want.bg))
      texture.colorSpace = SRGBColorSpace
      texture.wrapS = texture.wrapT = RepeatWrapping
      texture.anisotropy = 8
      next[r] = { key: want.key, texture }
      changed = true
    }
    if (changed) {
      // Textures are GPU resources made from the new inputs; state hands them to the materials.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTextures((prev) => {
        for (const r of Object.keys(next) as ZoneId[]) prev[r]?.texture.dispose()
        return { ...prev, ...next }
      })
    }
    // Pattern removed: free GPU memory now. The entry is ignored below (key mismatch),
    // and three.js re-uploads it transparently if the same pattern comes back.
    for (const r of ZONES) if (!wanted[r]) live.current.textures[r]?.texture.dispose()
    // `signature` captures every pixel-affecting input of `wanted`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  useEffect(() => () => Object.values(live.current.textures).forEach((t) => t?.texture.dispose()), [])

  const out: Partial<Record<ZoneId, CanvasTexture>> = {}
  for (const r of ZONES) {
    const t = textures[r]
    if (t && t.key === wanted[r]?.key) out[r] = t.texture
  }
  return out
}

/**
 * Applies size, angle and position. UVs are in metres (times `uvScale`), so
 * one repeat is `sizeCm` wide on the fabric, rotation is clockwise as seen,
 * and the tile's centre sits on `origin` (garment metres; UV u = x + 0.5) —
 * on the chest, where compositions like bands and chevrons are designed to land.
 */
export function placePattern(texture: CanvasTexture, fill: PatternFill, uvScale: number, origin: [number, number]) {
  const repeat = uvScale / (fill.sizeCm / 100)
  texture.repeat.set(repeat, repeat)
  texture.rotation = (-fill.angle * Math.PI) / 180
  // Rotate and scale about the origin, then shift so it lands on the tile's centre.
  const cu = (origin[0] + 0.5) / uvScale
  const cv = origin[1] / uvScale
  texture.center.set(cu, cv)
  texture.offset.set(0.5 - cu, 0.5 - cv)
}
