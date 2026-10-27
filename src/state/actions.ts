import { createElement } from 'react'
import { useDesignStore } from './designStore'
import { useUiStore } from './uiStore'
import { resolvedColor, type Design, type LogoLayer } from './design'
import { colorRegions } from './useColorRegions'
import { describeLook } from '../lib/logoTransform'
import { describePatterns } from '../patterns/describe'
import { describeBrand } from '../garments/brand'
import { brandFabric, describeZones } from './paint'
import { fr } from '../lib/format'
import { APP_NAME, CRESCENT_PATH, LUNAR_ACCENT, LUNAR_INK } from '../config/lunar'
import { describeText } from './describeText'
import { getGarment } from '../garments/catalog'
import { presetName } from '../config/palette'
import { downloadBlob, exportDesignJson, readDesignFile, saveDesignLocally, stamp } from '../lib/persistence'
import { viewerBridge } from '../components/viewer/viewerBridge'
import { FlatPreview } from '../components/viewer/FlatPreview'

const notify = (...args: Parameters<ReturnType<typeof useUiStore.getState>['notify']>) => useUiStore.getState().notify(...args)

export function saveLocally() {
  const res = saveDesignLocally(useDesignStore.getState().design)
  if (!res.ok) notify('error', res.reason)
  else if (res.withoutLogo) notify('info', 'Enregistré dans ce navigateur, sans les logos (trop lourds pour le stockage local). Exportez le design pour les conserver.')
  else notify('success', 'Design enregistré dans ce navigateur.')
}

export function exportJson() {
  exportDesignJson(useDesignStore.getState().design)
  notify('success', 'Design exporté en JSON.')
}

export async function importJson(file: File) {
  try {
    const design = await readDesignFile(file)
    useDesignStore.getState().replaceDesign(design)
    notify('success', `«\u00a0${file.name}\u00a0» importé.`)
  } catch (err) {
    notify('error', err instanceof Error ? err.message : 'Ce fichier n’a pas pu être importé.')
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
      createElement(FlatPreview, { garment, side, colors: design.colors, patterns: design.patterns, brand: design.brand, zones: design.zones, logos: design.logos }),
    )
    const svg = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="900" height="1100"')
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

/** "Poitrine gauche · 8 cm de large · 0°" — the long form adds flips, fill, opacity and lock. */
function describeLogo(design: Design, layer: LogoLayer, long: boolean) {
  const p = layer.placement
  const preset = getGarment(design.productId).placements.find((x) => x.id === p.placement)
  if (!long) return `${preset?.label ?? ''} ${fr(p.widthCm)} cm${p.rotationDeg ? ` ${p.rotationDeg}°` : ''}`
  const look = describeLook(p)
  return `${preset?.label ?? ''} · ${fr(p.widthCm)} cm de large · ${p.rotationDeg}°${look ? ` · ${look}` : ''}`
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
    const [front, back] = await Promise.all([loadImage(renders[0]), loadImage(renders[1])])

    // One detail line each for text, pattern and the brand mark; the sheet grows to fit them.
    const regions = colorRegions(design.productId, useUiStore.getState().modelRegions)
    const patternLines = describePatterns(design.patterns, regions)
    const zoneLines = describeZones(design)
    const details = [
      ...design.logos.filter((l) => l.text).map((t) => `Texte — ${describeText(design, t)}`),
      ...(patternLines.length ? [`Motif — ${patternLines.map((p) => `${p.label}\u00a0: ${p.text}`).join(' · ')}`] : []),
      ...(zoneLines.length ? [`Zones — ${zoneLines.map((z) => `${z.label}\u00a0: ${z.text}`).join('  ·  ')}`] : []),
      `Logo de marque — ${describeBrand(design.brand, brandFabric(design))}`,
    ]
    const LINE = 28
    const W = 1800
    const H = 1240 + (details.length - 1) * LINE
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#F6F5F2'
    ctx.fillRect(0, 0, W, H)

    // Lunar 3D tile: amber crescent on ink (the favicon artwork, scaled from its 32-unit box).
    roundRect(ctx, 72, 52, 64, 64, 16)
    ctx.fillStyle = LUNAR_INK
    ctx.fill()
    ctx.save()
    ctx.translate(72, 52)
    ctx.scale(2, 2)
    ctx.fillStyle = LUNAR_ACCENT
    ctx.fill(new Path2D(CRESCENT_PATH))
    ctx.restore()
    ctx.fillStyle = '#0E0E0E'
    ctx.font = '700 34px "Manrope Variable", Manrope, system-ui, sans-serif'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(`${garment.name} — design personnalisé`, 190, 92)
    ctx.fillStyle = '#6B6A67'
    ctx.font = '500 20px "Manrope Variable", Manrope, system-ui, sans-serif'
    ctx.fillText(garment.tagline, 190, 122)
    ctx.textAlign = 'right'
    ctx.fillText(new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }), W - 72, 92)
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
      ctx.fillText(i === 0 ? 'DEVANT' : 'DOS', x + 28, panelY + panelH - 26)
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
      const text = `${presetName(hex) ?? 'Personnalisée'} ${hex}`
      ctx.fillText(text, x + 38, y + 4)
      x += 38 + ctx.measureText(text).width + 56
    }
    chip('Corps', resolvedColor(design.colors, 'body'))
    if (regions.includes('sleeves')) chip('Manches', resolvedColor(design.colors, 'sleeves'))
    if (regions.includes('collar')) chip('Col', resolvedColor(design.colors, 'collar'))
    const images = design.logos.filter((l) => !l.text)
    if (images.length) {
      ctx.fillStyle = '#6B6A67'
      ctx.font = '600 15px "Manrope Variable", Manrope, system-ui, sans-serif'
      ctx.fillText(images.length > 1 ? `LOGOS (${images.length})` : 'LOGO', x, y - 26)
      ctx.fillStyle = '#0E0E0E'
      ctx.font = '600 20px "Manrope Variable", Manrope, system-ui, sans-serif'
      const text = images.length === 1 ? describeLogo(design, images[0], true) : images.map((l) => describeLogo(design, l, false)).join('   ·   ')
      ctx.fillText(text, x, y + 4, W - 72 - x)
    }
    ctx.fillStyle = '#0E0E0E'
    ctx.font = '600 17px "Manrope Variable", Manrope, system-ui, sans-serif'
    details.forEach((line, i) => ctx.fillText(line, 72, y + 50 + i * LINE, W - 144))
    ctx.fillStyle = '#6B6A67'
    ctx.font = '500 15px "Manrope Variable", Manrope, system-ui, sans-serif'
    ctx.fillText(`Démo ${APP_NAME} — aperçu généré dans le navigateur, les couleurs à l’écran sont indicatives.`, 72, H - 36)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('empty')
    downloadBlob(blob, `lunar-3d-${garment.id}-${stamp()}.png`)
    notify('success', 'Image d’aperçu téléchargée.')
  } catch (err) {
    console.error(err)
    notify('error', 'L’image d’aperçu n’a pas pu être créée. Réessayez, ou exportez le design en JSON.')
  }
}
