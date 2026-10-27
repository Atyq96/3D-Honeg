import { useEffect, useMemo } from 'react'
import type { BufferGeometry } from 'three'
import type { GarmentDefinition } from '../../garments/types'
import { brandPlacement } from '../../garments/brand'
import { BRAND_ASSETS, brandInk } from '../../config/brand'
import { useDesignStore } from '../../state/designStore'
import { brandFabric } from '../../state/paint'
import { projectDecal } from './decal'
import { useLogoTexture } from './useLogoTexture'
import { PrintMaterial } from './PrintMaterial'

const NO_FLIP = { flipX: false, flipY: false }

/** The always-present brand mark, printed like the customer's logo but not editable on the model. */
export function BrandMark({ def, targets }: { def: GarmentDefinition; targets: BufferGeometry[] }) {
  const brand = useDesignStore((s) => s.design.brand)
  const fabric = useDesignStore((s) => brandFabric(s.design))
  const ink = brandInk(brand.color, fabric)
  const look = useMemo(() => ({ ...NO_FLIP, tint: ink }), [ink])
  const texture = useLogoTexture(BRAND_ASSETS[brand.style].url, look)

  const { center, width, height } = brandPlacement(def, brand)
  const [cx, cy] = center
  const geometry = useMemo(
    () => projectDecal(targets, { side: 'front', center: [cx, cy], width, height, rotationDeg: 0 }).geometry,
    [targets, cx, cy, width, height],
  )
  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry || !texture) return null
  return (
    <mesh geometry={geometry} renderOrder={2}>
      <PrintMaterial map={texture} width={width} height={height} />
    </mesh>
  )
}
