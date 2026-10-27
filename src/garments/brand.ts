import type { GarmentDefinition, PrintArea } from './types'
import type { V2 } from './flat/geom2d'
import { BRAND_ASSETS, brandInk, type BrandSide, type BrandStyle } from '../config/brand'
import { t } from '../i18n'

export interface BrandPlacement {
  /** Front view space (x to the viewer's right), metres. */
  center: V2
  width: number
  height: number
  rect: PrintArea
}

/** Front-view x of a wearer's side: wearer's left is the viewer's right on the front; centre is 0. */
export const chestX = (side: BrandSide, x: number) => (side === 'center' ? 0 : side === 'left' ? x : -x)

/** Where and how big the brand mark prints on this garment. */
export function brandPlacement(garment: GarmentDefinition, brand: { side: BrandSide; style: BrandStyle }): BrandPlacement {
  const width = garment.brandMark.widthCm / 100
  const height = width / BRAND_ASSETS[brand.style].aspect
  const center: V2 = [chestX(brand.side, garment.brandMark.x), garment.brandMark.y]
  return {
    center,
    width,
    height,
    rect: { xMin: center[0] - width / 2, xMax: center[0] + width / 2, yMin: center[1] - height / 2, yMax: center[1] + height / 2 },
  }
}

/** The mark's footprint plus clear space; customer prints on the front are kept out of it. */
export function brandKeepOut(garment: GarmentDefinition, brand: { side: BrandSide; style: BrandStyle }, margin = 0.012): PrintArea {
  const { rect } = brandPlacement(garment, brand)
  return { xMin: rect.xMin - margin, xMax: rect.xMax + margin, yMin: rect.yMin - margin, yMax: rect.yMax + margin }
}

/** e.g. "Right chest · Logo · Auto (white)". */
export function describeBrand(brand: { side: BrandSide; style: BrandStyle; color: string }, fabric: string): string {
  const m = t()
  const ink = brandInk(brand.color, fabric)
  const color =
    brand.color === 'auto' ? m.brand.autoValue(ink === '#FFFFFF') : (m.brand.colors[brand.color] ?? brand.color)
  return `${m.brand.sides[brand.side]} · ${m.brand.styles[brand.style]} · ${color}`
}
