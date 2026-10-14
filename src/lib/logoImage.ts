export interface LogoLook {
  tint: string | null
  flipX: boolean
  flipY: boolean
}

/**
 * Renders the logo with flips and an optional single-colour fill. The fill uses
 * `source-atop` so only the logo's visible pixels are recoloured (same approach
 * as OpenMerch's useTintedImage); transparency is preserved.
 */
export function renderLogo(img: CanvasImageSource & { width: number; height: number }, look: LogoLook): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.translate(look.flipX ? canvas.width : 0, look.flipY ? canvas.height : 0)
  ctx.scale(look.flipX ? -1 : 1, look.flipY ? -1 : 1)
  ctx.drawImage(img, 0, 0)
  ctx.restore()
  if (look.tint) {
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = look.tint
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  return canvas
}
