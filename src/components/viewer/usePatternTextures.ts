import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import type { PatternFill } from '../../state/design'
import { PAINT_ZONE_IDS, REGION_IDS, type ZoneId } from '../../garments/zones'
import { getPattern, svgDataUrl, tileSvg } from '../../patterns/library'

const TILE_PX = 512
const ZONES: ZoneId[] = [...REGION_IDS, ...PAINT_ZONE_IDS]

/** A patterned part or paint zone: the pattern and the fabric colour under it. */
export type PatternSources = Partial<Record<ZoneId, { fill: PatternFill; bg: string }>>

type Entry = { key: string; texture: CanvasTexture }

/** Rasterises one seamless pattern tile (ink over the zone's fabric colour). */
export async function rasterizeTile(fill: PatternFill, bg: string, px = TILE_PX): Promise<HTMLCanvasElement> {
  const def = getPattern(fill.id)
  if (!def) throw new Error(`Unknown pattern ${fill.id}`)
  const img = new Image()
  img.src = svgDataUrl(tileSvg(def, { color: fill.color, bg, density: fill.density, seed: fill.seed, opacity: fill.opacity }, px))
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext('2d')!.drawImage(img, 0, 0)
  return canvas
}

/** Inputs that change the pixels; size and angle only change the texture transform. */
const rasterKey = (fill: PatternFill, bg: string) => [fill.id, fill.color, bg, fill.density, fill.opacity, fill.seed].join('|')

/**
 * One repeating texture per patterned part or paint zone. A zone is
 * re-rasterised only when its own pixels change; stale and removed textures
 * are disposed.
 */
export function usePatternTextures(sources: PatternSources) {
  const wanted = useMemo(() => {
    const out: Partial<Record<ZoneId, { key: string; fill: PatternFill; bg: string }>> = {}
    for (const z of ZONES) {
      const src = sources[z]
      if (src) out[z] = { key: rasterKey(src.fill, src.bg), ...src }
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
    for (const r of ZONES) {
      const want = wanted[r]
      if (!want || live.current.textures[r]?.key === want.key) continue
      void rasterizeTile(want.fill, want.bg).then((canvas) => {
        if (live.current.wanted[r]?.key !== want.key) return // superseded while rasterising
        const texture = new CanvasTexture(canvas)
        texture.colorSpace = SRGBColorSpace
        texture.wrapS = texture.wrapT = RepeatWrapping
        texture.anisotropy = 8
        setTextures((prev) => {
          prev[r]?.texture.dispose()
          return { ...prev, [r]: { key: want.key, texture } }
        })
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
 * Applies size and angle. UVs are in metres (times `uvScale`), so one repeat is
 * `sizeCm` wide on the fabric; rotation is clockwise as seen.
 */
export function placePattern(texture: CanvasTexture, fill: PatternFill, uvScale: number) {
  const [w, h] = getPattern(fill.id)?.tile ?? [1, 1]
  const sizeM = fill.sizeCm / 100
  texture.repeat.set(uvScale / sizeM, uvScale / (sizeM * (h / w)))
  texture.rotation = (-fill.angle * Math.PI) / 180
}
