import logoUrl from '../assets/your-logo.png?inline'
import symbolUrl from '../assets/your-logo-symbol.png?inline'
import { luminance } from '../lib/color'

/**
 * The brand mark printed on every garment — like a sportswear maker's
 * swoosh or stripes. It's always present; customers only choose where it sits
 * (either chest, or centred), its style and its colour.
 * Assets are inlined as data URLs so they also work inside SVG exports.
 */
export type BrandStyle = 'logo' | 'symbol'
/** A chest, by the wearer's side. */
export type ChestSide = 'left' | 'right'
/** Where the mark sits: either chest (wearer's side) or centred under the collar line. */
export type BrandSide = ChestSide | 'center'

export const BRAND_ASSETS: Record<BrandStyle, { url: string; aspect: number }> = {
  logo: { url: logoUrl, aspect: 580 / 382 },
  symbol: { url: symbolUrl, aspect: 1 },
}

/** Mark colour choices; names come from the i18n dictionaries (`brand.colors`). */
export const BRAND_COLORS: ('auto' | string)[] = ['auto', '#FFFFFF', '#0E0E0E', '#F2A900']

/** Resolves "auto" to white on dark fabric and ink black on light fabric. */
export function brandInk(color: 'auto' | string, fabric: string): string {
  if (color !== 'auto') return color
  return luminance(fabric) > 0.35 ? '#0E0E0E' : '#FFFFFF'
}
