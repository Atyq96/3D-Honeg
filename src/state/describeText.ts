import { getFont } from '../config/fonts'
import { letterHeightCm, type Design, type LogoLayer } from './design'
import { presetName } from '../config/palette'
import { num } from '../lib/format'
import { t } from '../i18n'

/** e.g. `“TEAM” · Anton · 4 cm letters · Center chest · White` (in the current language). */
export function describeText(_design: Design, layer: LogoLayer): string {
  if (!layer.text) return ''
  const m = t()
  const tint = layer.placement.tint ?? '#0E0E0E'
  const color = presetName(tint) ?? tint
  return m.text.describe(layer.asset.name, getFont(layer.text.font).label, num(letterHeightCm(layer)), m.placements[layer.placement.placement].label, color)
}
