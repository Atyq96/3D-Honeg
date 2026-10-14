import { createElement } from 'react'
import { useDesignStore } from './designStore'
import { useUiStore } from './uiStore'
import { resolvedColor, type Design, type LogoLayer } from './design'
import { colorRegions } from './useColorRegions'
import { describeLook } from '../lib/logoTransform'
import { describePatterns } from '../patterns/describe'
import { describeBrand } from '../garments/brand'
import { getGarment } from '../garments/catalog'
import { presetName } from '../config/palette'
import { downloadBlob, exportDesignJson, readDesignFile, saveDesignLocally, stamp } from '../lib/persistence'
import { viewerBridge } from '../components/viewer/viewerBridge'
import { FlatPreview } from '../components/viewer/FlatPreview'

const notify = (...args: Parameters<ReturnType<typeof useUiStore.getState>['notify']>) => useUiStore.getState().notify(...args)

export function saveLocally() {
  const res = saveDesignLocally(useDesignStore.getState().design)
  if (!res.ok) notify('error', res.reason)
  else if (res.withoutLogo) notify('info', 'Saved in this browser — without the logos, which are too large for local storage. Use Export design to keep them.')
  else notify('success', 'Design saved in this browser.')
}

export function exportJson() {
  exportDesignJson(useDesignStore.getState().design)
  notify('success', 'Design exported as JSON.')
}

export async function importJson(file: File) {
  try {
    const design = await readDesignFile(file)
    useDesignStore.getState().replaceDesign(design)
    notify('success', `Imported “${file.name}”.`)
  } catch (err) {
    notify('error', err instanceof Error ? err.message : "That file couldn't be imported.")
  }
}

export function pickDesignFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) void importJson(file)
  }
  input.click()
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Flat sketches as images, used when there is no WebGL renderer to capture. */
async function renderFlats(design: Design): Promise<string[]> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const garment = getGarment(design.productId)
  return (['front', 'back'] as const).map((side) => {
    const markup = renderToStaticMarkup(
      createElement(FlatPreview, { garment, side, colors: design.colors, patterns: design.patterns, brand: design.brand, logos: design.logos }),
    )
    const svg = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="900" height="1100"')
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

/** "Left chest · 8 cm wide · 0°" — the long form adds flips, fill, opacity and lock. */
function describeLogo(design: Design, layer: LogoLayer, long: boolean) {
  const p = layer.placement
  const preset = getGarment(design.productId).placements.find((x) => x.id === p.placement)
  if (!long) return `${preset?.label ?? ''} ${p.widthCm} cm${p.rotationDeg ? ` ${p.rotationDeg}°` : ''}`
  const look = describeLook(p)
  return `${preset?.label ?? ''} · ${p.widthCm} cm wide · ${p.rotationDeg}°${look ? ` · ${look}` : ''}`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Composes a branded preview sheet (front + back + spec line) and downloads it as PNG. */
export async function exportPreviewImage() {
  const design = useDesignStore.getState().design
  const garment = getGarment(design.productId)
  try {
    await document.fonts.ready
    const api = viewerBridge.get()
    const renders = api ? api.capture(['front', 'back'], 900, 1100) : await renderFlats(design)
    const [front, back, brand] = await Promise.all([loadImage(renders[0]), loadImage(renders[1]), loadImage('/brand/honeg-logo-black.png')])

    const W = 1800
    const H = 1240
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#F6F5F2'
    ctx.fillRect(0, 0, W, H)

    const brandH = 64
    ctx.drawImage(brand, 72, 52, (brand.width / brand.height) * brandH, brandH)
    ctx.fillStyle = '#0E0E0E'
    ctx.font = '700 34px "Manrope Variable", Manrope, system-ui, sans-serif'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(`${garment.name} — custom design`, 190, 92)
    ctx.fillStyle = '#6B6A67'
    ctx.font = '500 20px "Manrope Variable", Manrope, system-ui, sans-serif'
    ctx.fillText(garment.tagline, 190, 122)
    ctx.textAlign = 'right'
    ctx.fillText(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), W - 72, 92)
    ctx.textAlign = 'left'

    const panelY = 168
    const panelH = 880
    const panelW = (W - 72 * 2 - 32) / 2
    ;[front, back].forEach((img, i) => {
      const x = 72 + i * (panelW + 32)
      roundRect(ctx, x, panelY, panelW, panelH, 24)
      const g = ctx.createRadialGradient(x + panelW / 2, panelY + panelH * 0.45, 40, x + panelW / 2, panelY + panelH / 2, panelW * 0.75)
      g.addColorStop(0, '#FFFFFF')
      g.addColorStop(1, '#EEECE7')
      ctx.fillStyle = g
      ctx.fill()
      const s = Math.min((panelW - 40) / img.width, (panelH - 70) / img.height)
      ctx.drawImage(img, x + (panelW - img.width * s) / 2, panelY + 20 + (panelH - 70 - img.height * s) / 2, img.width * s, img.height * s)
      ctx.fillStyle = '#484847'
      ctx.font = '700 15px "Manrope Variable", Manrope, system-ui, sans-serif'
      ctx.letterSpacing = '3px'
      ctx.fillText(i === 0 ? 'FRONT' : 'BACK', x + 28, panelY + panelH - 26)
      ctx.letterSpacing = '0px'
    })

    // Spec line.
    let x = 72
    const y = panelY + panelH + 72
    const chip = (label: string, hex: string) => {
      ctx.fillStyle = '#6B6A67'
      ctx.font = '600 15px "Manrope Variable", Manrope, system-ui, sans-serif'
      ctx.fillText(label.toUpperCase(), x, y - 26)
      roundRect(ctx, x, y - 16, 26, 26, 7)
      ctx.fillStyle = hex
      ctx.fill()
      ctx.strokeStyle = 'rgba(14,14,14,0.18)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.fillStyle = '#0E0E0E'
      ctx.font = '600 20px "Manrope Variable", Manrope, system-ui, sans-serif'
      const text = `${presetName(hex) ?? 'Custom'} ${hex}`
      ctx.fillText(text, x + 38, y + 4)
      x += 38 + ctx.measureText(text).width + 56
    }
    const regions = colorRegions(design.productId, useUiStore.getState().modelRegions)
    chip('Body', resolvedColor(design.colors, 'body'))
    if (regions.includes('sleeves')) chip('Sleeves', resolvedColor(design.colors, 'sleeves'))
    if (regions.includes('collar')) chip('Collar', resolvedColor(design.colors, 'collar'))
    if (design.logos.length) {
      ctx.fillStyle = '#6B6A67'
      ctx.font = '600 15px "Manrope Variable", Manrope, system-ui, sans-serif'
      ctx.fillText(design.logos.length > 1 ? `LOGOS (${design.logos.length})` : 'LOGO', x, y - 26)
      ctx.fillStyle = '#0E0E0E'
      ctx.font = '600 20px "Manrope Variable", Manrope, system-ui, sans-serif'
      const text =
        design.logos.length === 1
          ? describeLogo(design, design.logos[0], true)
          : design.logos.map((l) => describeLogo(design, l, false)).join('   ·   ')
      ctx.fillText(text, x, y + 4, W - 72 - x)
    }
    const patternLines = describePatterns(design.patterns, regions)
    const details = [
      ...(patternLines.length ? [`Pattern — ${patternLines.map((p) => `${p.label}: ${p.text}`).join(' · ')}`] : []),
      `HONEG mark — ${describeBrand(design.brand, design.colors.body)}`,
    ]
    ctx.fillStyle = '#0E0E0E'
    ctx.font = '600 17px "Manrope Variable", Manrope, system-ui, sans-serif'
    ctx.fillText(details.join('     |     '), 72, y + 50, W - 144)
    ctx.fillStyle = '#6B6A67'
    ctx.font = '500 15px "Manrope Variable", Manrope, system-ui, sans-serif'
    ctx.fillText('Prototype preview generated in the browser — on-screen colors are indicative.', 72, H - 36)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('empty')
    downloadBlob(blob, `honeg-${garment.id}-${stamp()}.png`)
    notify('success', 'Preview image downloaded.')
  } catch (err) {
    console.error(err)
    notify('error', "The preview image couldn't be created. Try again, or export the design as JSON.")
  }
}
