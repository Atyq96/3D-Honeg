/** Preset garment colours. The first block comes straight from the HONEG brand palette (honeg.fr). */
export interface ColorPreset {
  name: string
  hex: string
}

export const COLOR_PRESETS: ColorPreset[] = [
  { name: 'HONEG Black', hex: '#0E0E0E' },
  { name: 'Chalk', hex: '#F6F5F2' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'HONEG Amber', hex: '#F2A900' },
  { name: 'Graphite', hex: '#484847' },
  { name: 'Stone', hex: '#BCBBB9' },
  { name: 'Midnight', hex: '#001D4B' },
  { name: 'Royal', hex: '#003A96' },
  { name: 'Sky', hex: '#0088CB' },
  { name: 'Race Red', hex: '#ED1C24' },
  { name: 'Forest', hex: '#2B5336' },
  { name: 'Volt', hex: '#FFCB05' },
]

export const DEFAULT_BODY_COLOR = '#0E0E0E'

export function presetName(hex: string): string | null {
  return COLOR_PRESETS.find((p) => p.hex === hex.toUpperCase())?.name ?? null
}
