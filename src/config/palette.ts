/** Preset garment colours. The first block comes straight from the HONEG brand palette (honeg.fr). */
export interface ColorPreset {
  name: string
  hex: string
}

export const COLOR_PRESETS: ColorPreset[] = [
  { name: 'Noir HONEG', hex: '#0E0E0E' },
  { name: 'Craie', hex: '#F6F5F2' },
  { name: 'Blanc', hex: '#FFFFFF' },
  { name: 'Ambre HONEG', hex: '#F2A900' },
  { name: 'Graphite', hex: '#484847' },
  { name: 'Pierre', hex: '#BCBBB9' },
  { name: 'Minuit', hex: '#001D4B' },
  { name: 'Bleu roi', hex: '#003A96' },
  { name: 'Ciel', hex: '#0088CB' },
  { name: 'Rouge course', hex: '#ED1C24' },
  { name: 'Forêt', hex: '#2B5336' },
  { name: 'Jaune volt', hex: '#FFCB05' },
]

export const DEFAULT_BODY_COLOR = '#0E0E0E'

export function presetName(hex: string): string | null {
  return COLOR_PRESETS.find((p) => p.hex === hex.toUpperCase())?.name ?? null
}
