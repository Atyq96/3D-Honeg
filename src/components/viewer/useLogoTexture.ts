import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { renderLogo, type LogoLook } from '../../lib/logoImage'

/**
 * Loads the logo once per data URL, then derives a GPU texture for the current
 * look (fill colour, flips). Textures are disposed when the look or logo changes.
 */
export function useLogoTexture(url: string | undefined, look: LogoLook): CanvasTexture | null {
  const [loaded, setLoaded] = useState<{ url: string; img: HTMLImageElement } | null>(null)

  useEffect(() => {
    if (!url) return
    let alive = true
    const img = new Image()
    img.onload = () => alive && setLoaded({ url, img })
    img.src = url
    return () => {
      alive = false
    }
  }, [url])

  const img = url && loaded?.url === url ? loaded.img : null
  const { tint, flipX, flipY } = look
  const texture = useMemo(() => {
    if (!img) return null
    const t = new CanvasTexture(renderLogo(img, { tint, flipX, flipY }))
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [img, tint, flipX, flipY])

  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}
