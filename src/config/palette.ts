import { colorName } from '../i18n/labels'

/** Preset garment colours: neutrals and the app accent first, then team colours. */
export interface ColorPreset {
  hex: string
}

export const COLOR_PRESETS: ColorPreset[] = [
  { hex: '#0E0E0E' },
  { hex: '#F6F5F2' },
  { hex: '#FFFFFF' },
  { hex: '#F2A900' },
  { hex: '#484847' },
  { hex: '#BCBBB9' },
  { hex: '#001D4B' },
  { hex: '#003A96' },
  { hex: '#0088CB' },
  { hex: '#ED1C24' },
  { hex: '#2B5336' },
  { hex: '#FFCB05' },
]

export const DEFAULT_BODY_COLOR = '#0E0E0E'

/** Display name of a palette colour (current language), or null for a custom colour. */
export const presetName = (hex: string): string | null => colorName(hex)
