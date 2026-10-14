import type { GarmentDefinition, PrintArea } from './types'
import type { V2 } from './flat/geom2d'
import { BRAND_ASSETS, BRAND_COLORS, brandInk, type BrandSide, type BrandStyle } from '../config/brand'

export interface BrandPlacement {
  /** Front view space (x to the viewer's right), metres. */
  center: V2
  width: number
  height: number
  rect: PrintArea
}

/** Front-view x of a wearer's side: wearer's left is the viewer's right on the front. */
export const chestX = (side: BrandSide, x: number) => (side === 'left' ? x : -x)

/** Where and how big the HONEG mark prints on this garment. */
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
  const ink = brandInk(brand.color, fabric)
  const color =
    brand.color === 'auto' ? `Auto (${ink === '#FFFFFF' ? 'white' : 'black'})` : (BRAND_COLORS.find((c) => c.value === brand.color)?.label ?? brand.color)
  return `${brand.side === 'left' ? 'Left' : 'Right'} chest · ${BRAND_ASSETS[brand.style].label} · ${color}`
}
