import { getFont } from '../config/fonts'
import { getGarment } from '../garments/catalog'
import { letterHeightCm, type Design, type LogoLayer } from './design'
import { presetName } from '../config/palette'

/** e.g. `“TEAM” · Anton · 4 cm letters · Center chest · White`. */
export function describeText(design: Design, layer: LogoLayer): string {
  if (!layer.text) return ''
  const preset = getGarment(design.productId).placements.find((p) => p.id === layer.placement.placement)
  const tint = layer.placement.tint ?? '#0E0E0E'
  const color = presetName(tint) ?? (tint === '#FFFFFF' ? 'White' : tint === '#0E0E0E' ? 'Black' : tint)
  return `“${layer.asset.name}” · ${getFont(layer.text.font).label} · ${letterHeightCm(layer)} cm letters · ${preset?.label ?? ''} · ${color}`
}
