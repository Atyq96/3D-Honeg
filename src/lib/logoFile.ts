import type { LogoAsset } from '../state/design'

/** Phone photos are often 4–8 MB. */
export const MAX_LOGO_BYTES = 10 * 1024 * 1024
export const LOGO_ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml'
const MAX_DIM = 1024
const LOW_RES = 300

export class LogoFileError extends Error {}

type Kind = 'png' | 'jpeg' | 'webp' | 'svg'

const formatMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1)

function detectKind(file: File): Kind | null {
  const type = file.type.toLowerCase()
  if (type === 'image/png') return 'png'
  if (type === 'image/jpeg' || type === 'image/jpg') return 'jpeg'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/svg+xml') return 'svg'
  // Some systems report an empty MIME type; fall back to the extension.
  const ext = file.name.toLowerCase().split('.').pop()
  if (!type && ext === 'png') return 'png'
  if (!type && (ext === 'jpg' || ext === 'jpeg')) return 'jpeg'
  if (!type && ext === 'webp') return 'webp'
  if (!type && ext === 'svg') return 'svg'
  return null
}

async function checkSignature(file: File, kind: Kind) {
  if (kind === 'svg') return
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to))
  const ok =
    kind === 'png'
      ? head[0] === 0x89 && ascii(1, 4) === 'PNG'
      : kind === 'webp'
        ? ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
        : head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
  if (!ok) throw new LogoFileError(`"${file.name}" doesn't look like a real ${kind.toUpperCase()} file. It may be renamed or corrupted.`)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new LogoFileError("This image couldn't be decoded. It may be corrupted."))
    img.src = src
  })
}

function parseLength(value: string | null): number | null {
  if (!value) return null
  const m = /^\s*([\d.]+)\s*(px)?\s*$/i.exec(value)
  const n = m ? parseFloat(m[1]) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Rasterises an SVG safely: strips scripts, event handlers, foreignObject and
 * external references, then renders it through an <img> (which never executes
 * script) into a canvas.
 */
async function rasterizeSvg(file: File): Promise<{ source: HTMLImageElement; width: number; height: number }> {
  const text = await file.text()
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement
  if (doc.getElementsByTagName('parsererror').length || svg.nodeName.toLowerCase() !== 'svg')
    throw new LogoFileError("This SVG couldn't be read. Check that it's a valid SVG file.")

  doc.querySelectorAll('script, foreignObject, iframe, object, embed').forEach((n) => n.remove())
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on')) el.removeAttribute(attr.name)
      else if ((name === 'href' || name === 'xlink:href') && !/^(#|data:image\/(png|jpe?g|gif|webp);)/i.test(attr.value.trim()))
        el.removeAttribute(attr.name)
    }
  }

  let w = parseLength(svg.getAttribute('width'))
  let h = parseLength(svg.getAttribute('height'))
  const vb = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
  const hasViewBox = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0
  if (!w || !h) {
    if (hasViewBox) {
      w = vb[2]
      h = vb[3]
    } else {
      w = 512
      h = 512
    }
  }
  if (!hasViewBox) svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  const s = MAX_DIM / Math.max(w, h)
  svg.setAttribute('width', String(Math.round(w * s)))
  svg.setAttribute('height', String(Math.round(h * s)))

  const blob = new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    return { source: img, width: Math.round(w * s), height: Math.round(h * s) }
  } catch {
    throw new LogoFileError("This SVG couldn't be rendered. Try exporting it as PNG.")
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function decodeRaster(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file)
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
    } catch {
      // Fall through to <img> decoding, which some browsers handle more leniently.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    return { source: img, width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** True when any pixel is see-through (such images stay PNG; opaque photos are stored as JPEG). */
function hasTransparency(canvas: HTMLCanvasElement): boolean {
  const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true
  return false
}

/** Crops fully transparent borders so the logo's visible extent drives its size on the shirt. */
function trimTransparent(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!
  const { width, height } = canvas
  const data = ctx.getImageData(0, 0, width, height).data
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 < 0) throw new LogoFileError('This image is fully transparent, so there is nothing to print.')
  const pad = 2
  x0 = Math.max(0, x0 - pad)
  y0 = Math.max(0, y0 - pad)
  x1 = Math.min(width - 1, x1 + pad)
  y1 = Math.min(height - 1, y1 + pad)
  if (x0 === 0 && y0 === 0 && x1 === width - 1 && y1 === height - 1) return canvas
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 1
  out.height = y1 - y0 + 1
  out.getContext('2d')!.drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

export interface ProcessedLogo {
  asset: LogoAsset
  warning: string | null
}

export async function processLogoFile(file: File): Promise<ProcessedLogo> {
  const kind = detectKind(file)
  if (!kind) throw new LogoFileError(`"${file.name}" isn't supported. Upload a PNG, JPG, WebP or SVG.`)
  if (file.size === 0) throw new LogoFileError(`"${file.name}" is empty.`)
  if (file.size > MAX_LOGO_BYTES)
    throw new LogoFileError(`"${file.name}" is ${formatMb(file.size)} MB. The maximum is ${formatMb(MAX_LOGO_BYTES)} MB.`)
  await checkSignature(file, kind)

  const decoded = kind === 'svg' ? await rasterizeSvg(file) : await decodeRaster(file)
  try {
    const { width: sw, height: sh } = decoded
    if (!sw || !sh) throw new LogoFileError("This image has no size, so it can't be placed.")
    const s = Math.min(1, MAX_DIM / Math.max(sw, sh))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sw * s))
    canvas.height = Math.max(1, Math.round(sh * s))
    // Read back for trimming and the transparency check.
    canvas.getContext('2d', { willReadFrequently: true })!.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)

    let out: HTMLCanvasElement
    try {
      out = kind === 'jpeg' ? canvas : trimTransparent(canvas)
    } catch (err) {
      if (err instanceof LogoFileError) throw err
      throw new LogoFileError('This file uses features that can\'t be rendered safely. Try exporting it as PNG.')
    }
    // Opaque images (photos, logos on a solid background) are much smaller as JPEG,
    // which keeps three photos within browser storage.
    const dataUrl = kind === 'jpeg' || (kind !== 'svg' && !hasTransparency(out)) ? out.toDataURL('image/jpeg', 0.9) : out.toDataURL('image/png')
    const warning =
      kind !== 'svg' && Math.min(sw, sh) < LOW_RES
        ? `Low resolution (${sw}×${sh}px). It may look soft when printed large — a 1000px+ file or an SVG works best.`
        : null
    return {
      asset: { dataUrl, name: file.name, width: out.width, height: out.height, bytes: file.size, mime: file.type || `image/${kind}` },
      warning,
    }
  } finally {
    if ('close' in decoded) decoded.close?.()
  }
}

/** Loads a bundled sample logo through the same pipeline as user uploads. */
export async function fetchSampleLogo(url: string, name: string): Promise<ProcessedLogo> {
  const res = await fetch(url)
  if (!res.ok) throw new LogoFileError("The sample logo couldn't be loaded.")
  const blob = await res.blob()
  return processLogoFile(new File([blob], name, { type: blob.type || 'image/png' }))
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${formatMb(bytes)} MB`
}
