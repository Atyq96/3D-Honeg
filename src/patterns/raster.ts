import { parseLayered, type Layered, type Matrix } from './layered'

/**
 * Rasterising (browser only). Patterns are drawn straight onto a canvas with
 * Path2D — synchronous, no image decoding, and the same result in every
 * browser that renders SVG path data.
 */

/** Draws one tile `size` px wide with its top-left at (x, y), clipped to the tile (shapes overhang its edges). */
function draw(ctx: CanvasRenderingContext2D, art: Layered, x: number, y: number, size: number) {
  const k = size / art.width
  const apply = (m: Matrix | null) => m && ctx.transform(...m)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, size, art.height * k)
  ctx.clip()
  for (const g of art.groups) {
    ctx.save()
    ctx.setTransform(k, 0, 0, k, x, y)
    apply(g.transform)
    for (const it of g.items) {
      ctx.save()
      apply(it.transform)
      if (it.kind === 'rect') {
        if (g.fill) {
          ctx.fillStyle = g.fill
          ctx.fillRect(0, 0, it.width, it.height)
        }
      } else {
        const p = new Path2D(it.d)
        if (g.fill) {
          ctx.fillStyle = g.fill
          ctx.fill(p, g.evenOdd ? 'evenodd' : 'nonzero')
        }
        if (g.stroke) {
          ctx.strokeStyle = g.stroke
          ctx.lineWidth = it.strokeWidth ?? g.strokeWidth
          ctx.lineCap = g.cap
          ctx.lineJoin = g.join
          ctx.stroke(p)
        }
      }
      ctx.restore()
    }
    ctx.restore()
  }
  ctx.restore()
}

/** One tile, `sizePx` square (for 3D textures and thumbnails). */
export function toCanvas(svg: string, sizePx: number, canvas: HTMLCanvasElement = document.createElement('canvas')): HTMLCanvasElement {
  const art = parseLayered(svg)
  const size = Math.max(1, Math.round(sizePx))
  canvas.width = size
  canvas.height = Math.max(1, Math.round((size * art.height) / art.width))
  draw(canvas.getContext('2d')!, art, 0, 0, size)
  return canvas
}

export interface PrintOptions {
  dpi: number
  widthMm: number
  heightMm: number
  /** Printed width of one pattern repeat; default `widthMm` (one repeat across). The repeat is centred. */
  tileMm?: number
}

/** Above this the browser may refuse to allocate the canvas (iOS Safari stops at 16.7 MP). */
const MAX_SIDE = 16384
const MAX_PIXELS = 120_000_000

/** Pixel size of a print, or an error message if it's too big for a browser canvas. */
export function printPixels({ dpi, widthMm, heightMm }: PrintOptions): { width: number; height: number } {
  const width = Math.round((widthMm / 25.4) * dpi)
  const height = Math.round((heightMm / 25.4) * dpi)
  if (!(width > 0 && height > 0)) throw new RangeError('Print size and resolution must be positive')
  if (width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS)
    throw new RangeError(`${width} × ${height} px is too large to render in a browser; lower the dpi (the SVG has no limit)`)
  return { width, height }
}

/** Repeat positions (top-left, in mm) covering the print with the tile centred. */
function tiles(widthMm: number, heightMm: number, tileMm: number, tileHeightMm: number): [number, number][] {
  const x0 = widthMm / 2 - tileMm / 2 - Math.ceil((widthMm / 2 - tileMm / 2) / tileMm) * tileMm
  const y0 = heightMm / 2 - tileHeightMm / 2 - Math.ceil((heightMm / 2 - tileHeightMm / 2) / tileHeightMm) * tileHeightMm
  const out: [number, number][] = []
  for (let y = y0; y < heightMm; y += tileHeightMm) for (let x = x0; x < widthMm; x += tileMm) out.push([x, y])
  return out
}

/**
 * The print as a true-size vector file: the tile repeated over widthMm ×
 * heightMm, each repeat a nested <svg> so it's clipped to its own square
 * (layers stay recolourable).
 */
export function printSvg(svg: string, { widthMm, heightMm, tileMm = widthMm }: Omit<PrintOptions, 'dpi'>): string {
  const art = parseLayered(svg)
  const inner = svg.trim().replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  const th = (art.height * tileMm) / art.width
  const r = (v: number) => +v.toFixed(4)
  const copies = tiles(widthMm, heightMm, tileMm, th)
    .map(([x, y]) => `<svg x="${r(x)}" y="${r(y)}" width="${r(tileMm)}" height="${r(th)}" viewBox="0 0 ${art.width} ${art.height}">${inner}</svg>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r(widthMm)}mm" height="${r(heightMm)}mm" viewBox="0 0 ${r(widthMm)} ${r(heightMm)}">${copies}</svg>`
}

/** PNG chunks are CRC-32 checked. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Adds a pHYs chunk so print software opens the PNG at its true physical size. */
export function withDpi(png: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
  const ppm = Math.round(dpi / 0.0254)
  const chunk = new Uint8Array(21)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, 9)
  chunk.set([0x70, 0x48, 0x59, 0x73], 4) // "pHYs"
  view.setUint32(8, ppm)
  view.setUint32(12, ppm)
  chunk[16] = 1 // unit: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)))
  // Right after the IHDR chunk (8-byte signature + 25-byte IHDR).
  const out = new Uint8Array(png.length + chunk.length)
  out.set(png.subarray(0, 33))
  out.set(chunk, 33)
  out.set(png.subarray(33), 33 + chunk.length)
  return out
}

/**
 * Print files for the factory: a high-resolution PNG (with its dpi recorded)
 * and the vector SVG at true size, both covering widthMm × heightMm.
 */
export async function exportForPrint(svg: string, opts: PrintOptions): Promise<{ png: Blob; svg: Blob }> {
  const { width, height } = printPixels(opts)
  const art = parseLayered(svg)
  const tileMm = opts.tileMm ?? opts.widthMm
  const pxPerMm = width / opts.widthMm
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  for (const [x, y] of tiles(opts.widthMm, opts.heightMm, tileMm, (tileMm * art.height) / art.width)) draw(ctx, art, x * pxPerMm, y * pxPerMm, tileMm * pxPerMm)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'))
  const png = withDpi(new Uint8Array(await blob.arrayBuffer()), opts.dpi)
  // Free the large canvas straight away (mobile browsers keep a tight budget).
  canvas.width = canvas.height = 0
  return { png: new Blob([png], { type: 'image/png' }), svg: new Blob([printSvg(svg, opts)], { type: 'image/svg+xml' }) }
}
