import { useEffect, useMemo } from 'react'
import type { Texture } from 'three'
import { fabricTextures } from './fabric'

/**
 * Material for anything printed on the fabric (customer logo, brand mark):
 * lit like ink on cloth, with the knit grain showing through, drawn just in
 * front of the garment surface to avoid z-fighting. `layer` orders overlapping prints.
 */
export function PrintMaterial({ map, width, height, opacity = 1, layer = 0 }: { map: Texture; width: number; height: number; opacity?: number; layer?: number }) {
  // Fabric grain in the decal's own UV space (one jersey tile ≈ 2.4 cm).
  const grain = useMemo(() => {
    const t = fabricTextures().jersey.clone()
    t.repeat.set(width / 0.024, height / 0.024)
    return t
  }, [width, height])
  useEffect(() => () => grain.dispose(), [grain])

  return (
    <meshStandardMaterial
      map={map}
      emissiveMap={map}
      emissive="#ffffff"
      emissiveIntensity={0.2}
      normalMap={grain}
      normalScale={[0.22, 0.22]}
      transparent
      opacity={opacity}
      alphaTest={0.02}
      depthWrite={false}
      polygonOffset
      // Stacked logos: each layer is pulled a little further forward than the one below it.
      polygonOffsetFactor={-4 - layer}
      polygonOffsetUnits={-4 - layer * 2}
      roughness={0.68}
      metalness={0}
      envMapIntensity={0.8}
    />
  )
}
