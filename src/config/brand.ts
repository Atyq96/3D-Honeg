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

export const BRAND_ASSETS: Record<BrandStyle, { label: string; url: string; aspect: number }> = {
  logo: { label: 'Logo', url: logoUrl, aspect: 580 / 382 },
  symbol: { label: 'Symbole', url: symbolUrl, aspect: 1 },
}

export const BRAND_COLORS: { value: 'auto' | string; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '#FFFFFF', label: 'Blanc' },
  { value: '#0E0E0E', label: 'Noir' },
  { value: '#F2A900', label: 'Ambre' },
]

/** Resolves "auto" to white on dark fabric and ink black on light fabric. */
export function brandInk(color: 'auto' | string, fabric: string): string {
  if (color !== 'auto') return color
  return luminance(fabric) > 0.35 ? '#0E0E0E' : '#FFFFFF'
}
