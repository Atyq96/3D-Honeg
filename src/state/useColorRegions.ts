import type { RegionId } from '../garments/types'
import { getGarment } from '../garments/catalog'
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

export function useColorRegions(): RegionId[] {
  const productId = useDesignStore((s) => s.design.productId)
  const modelRegions = useUiStore((s) => s.modelRegions)
  return colorRegions(productId, modelRegions)
}
