import logoUrl from '../assets/honeg-logo.png?inline'
import symbolUrl from '../assets/honeg-symbol.png?inline'
import { luminance } from '../lib/color'

/**
 * The HONEG brand mark printed on every garment — like a sportswear maker's
 * swoosh or stripes. It's always present; customers only choose which chest it
 * sits on (their own logo takes the other side), its style and its colour.
 * Assets are inlined as data URLs so they also work inside SVG exports.
 */
export type BrandStyle = 'logo' | 'symbol'
/** Wearer's side. */
export type BrandSide = 'left' | 'right'

export const BRAND_ASSETS: Record<BrandStyle, { label: string; url: string; aspect: number }> = {
  logo: { label: 'Logo', url: logoUrl, aspect: 512 / 378 },
  symbol: { label: 'Symbol', url: symbolUrl, aspect: 512 / 254 },
}

export const BRAND_COLORS: { value: 'auto' | string; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '#FFFFFF', label: 'White' },
  { value: '#0E0E0E', label: 'Black' },
  { value: '#F2A900', label: 'Amber' },
]

/** Resolves "auto" to white on dark fabric and HONEG black on light fabric. */
export function brandInk(color: 'auto' | string, fabric: string): string {
  if (color !== 'auto') return color
  return luminance(fabric) > 0.35 ? '#0E0E0E' : '#FFFFFF'
}
