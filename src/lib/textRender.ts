import { fontCss, getFont } from '../config/fonts'
import type { LogoAsset, TextSpec } from '../state/design'
import { trimTransparent } from './logoFile'

/** Font size the lettering is drawn at before any downscaling. */
const BASE_PX = 200
/** Longest side of the rendered image; long lines are drawn smaller to fit. */
const MAX_SIDE = 2048

export interface RenderedText {
  asset: LogoAsset
  capPx: number
}

/**
 * Draws a text block in black on a transparent canvas, cropped to the ink.
 * The layer's fill colour recolours it (same as a logo's "Fill color"), so
 * changing the colour never needs a re-render.
 */
export async function renderText({ content, font: fontId, align }: Pick<TextSpec, 'content' | 'font' | 'align'>): Promise<RenderedText> {
  const font = getFont(fontId)
  const css = fontCss(font, BASE_PX)
  // Canvas silently falls back to another font if the face isn't loaded yet.
  await document.fonts.load(css, content)

  const lines = content.split('\n')
  const probe = document.createElement('canvas').getContext('2d')!
  probe.font = css
  const cap = probe.measureText('H').actualBoundingBoxAscent || BASE_PX * 0.7
  const ascent = probe.measureText('Hg').fontBoundingBoxAscent || BASE_PX
  const widths = lines.map((l) => probe.measureText(l).width)
  const maxW = Math.max(1, ...widths)
  // Leading relative to cap height looks even across fonts with very different metrics.
  const lineH = cap * 1.55
  // Generous room for swashes and slanted glyphs; the result is cropped to the ink anyway.
  const pad = BASE_PX * 0.6
  const w = maxW + pad * 2
  const h = ascent + lineH * (lines.length - 1) + BASE_PX * 0.5 + pad * 2
  const scale = Math.min(1, MAX_SIDE / w, MAX_SIDE / h)

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(w * scale)
  canvas.height = Math.ceil(h * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.scale(scale, scale)
  ctx.font = css
  ctx.fillStyle = '#000'
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = align
  const x = align === 'left' ? pad : align === 'right' ? pad + maxW : pad + maxW / 2
  lines.forEach((line, i) => ctx.fillText(line, x, pad + ascent + i * lineH))

  const out = trimTransparent(canvas)
  return {
    asset: {
      dataUrl: out.toDataURL('image/png'),
      name: content.replace(/\s*\n\s*/g, ' / ').slice(0, 60),
      width: out.width,
      height: out.height,
      bytes: 0,
      mime: 'image/png',
    },
    capPx: cap * scale,
  }
}
