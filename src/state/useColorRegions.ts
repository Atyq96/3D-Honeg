import type { RegionId } from '../garments/types'
import { getGarment } from '../garments/catalog'
import type { ZoneId } from '../garments/zones'
import { useDesignStore } from './designStore'
import { useUiStore } from './uiStore'

/**
 * Colour zones the user can actually edit: those the product declares AND the
 * loaded model really contains. A single-mesh GLB therefore only offers "Body"
 * rather than pretending sleeves/collar can be coloured independently.
 */
export function colorRegions(productId: string, modelRegions: RegionId[] | null): RegionId[] {
  const declared = getGarment(productId).regions
  return modelRegions ? declared.filter((r) => r === 'body' || modelRegions.includes(r)) : declared
}

/** Every selectable zone: the parts, then the paint zones that cover at least one of them. */
export function availableZones(productId: string, modelRegions: RegionId[] | null): ZoneId[] {
  const parts = colorRegions(productId, modelRegions)
  const paint = getGarment(productId).paintZones.filter((z) => z.parts.some((p) => parts.includes(p)))
  return [...parts, ...paint.map((z) => z.id)]
}

export function useColorRegions(): RegionId[] {
  const productId = useDesignStore((s) => s.design.productId)
  const modelRegions = useUiStore((s) => s.modelRegions)
  return colorRegions(productId, modelRegions)
}

export function useZones(): ZoneId[] {
  const productId = useDesignStore((s) => s.design.productId)
  const modelRegions = useUiStore((s) => s.modelRegions)
  return availableZones(productId, modelRegions)
}
