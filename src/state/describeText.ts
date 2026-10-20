import { getFont } from '../config/fonts'
import { getGarment } from '../garments/catalog'
import { letterHeightCm, type Design, type LogoLayer } from './design'
import { presetName } from '../config/palette'
import { fr } from '../lib/format'

/** e.g. `« ÉQUIPE » · Anton · lettres de 4 cm · Centre poitrine · Blanc`. */
export function describeText(design: Design, layer: LogoLayer): string {
  if (!layer.text) return ''
  const preset = getGarment(design.productId).placements.find((p) => p.id === layer.placement.placement)
  const tint = layer.placement.tint ?? '#0E0E0E'
  const color = presetName(tint) ?? (tint === '#FFFFFF' ? 'Blanc' : tint === '#0E0E0E' ? 'Noir' : tint)
  return `«\u00a0${layer.asset.name}\u00a0» · ${getFont(layer.text.font).label} · lettres de ${fr(letterHeightCm(layer))} cm · ${preset?.label ?? ''} · ${color}`
}
