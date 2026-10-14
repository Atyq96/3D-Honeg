import { useEffect, useMemo } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import type { BufferGeometry, Intersection } from 'three'
import type { GarmentDefinition } from '../../garments/types'
import type { LogoLayer as Layer } from '../../state/design'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { useActiveLogo } from '../../state/useActiveLogo'
import { projectDecal } from './decal'
import { useLogoTexture } from './useLogoTexture'
import { LogoGizmo } from './LogoGizmo'
import { PrintMaterial } from './PrintMaterial'
import { useGizmoDrag } from './gizmoDrag'

/** Every uploaded logo or photo, printed in stacking order; the active one gets the handles when selected. */
export function LogoLayers({ def, targets }: { def: GarmentDefinition; targets: BufferGeometry[] }) {
  const logos = useDesignStore((s) => s.design.logos)
  const active = useActiveLogo()
  const selected = useUiStore((s) => s.logoSelected)
  return logos.map((layer, i) => (
    <LogoDecal key={layer.id} def={def} targets={targets} layer={layer} order={i} selected={selected && layer.id === active?.id} />
  ))
}

/** Of the logos under the pointer, the one printed on top (logos at the same spot overlap). */
function topLogoAt(intersections: Intersection[]): string | null {
  const hits = intersections.filter((i) => i.object.userData.logoId)
  if (!hits.length) return null
  const near = hits[0].distance + 0.01
  const top = hits.filter((h) => h.distance <= near).sort((a, b) => b.object.userData.logoOrder - a.object.userData.logoOrder)[0]
  return top.object.userData.logoId as string
}

/**
 * One printed logo: a decal projected onto the garment, plus OpenMerch-style
 * direct manipulation — click to select, drag to move, handles to resize/rotate.
 */
function LogoDecal({ def, targets, layer, order, selected }: { def: GarmentDefinition; targets: BufferGeometry[]; layer: Layer; order: number; selected: boolean }) {
  const { asset, placement } = layer
  const gl = useThree((s) => s.gl)
  const texture = useLogoTexture(asset.dataUrl, placement)
  const preset = def.placements.find((p) => p.id === placement.placement)

  const width = placement.widthCm / 100
  const height = width * (asset.height / asset.width)
  const cx = preset ? preset.anchor[0] + placement.offsetXCm / 100 : 0
  const cy = preset ? preset.anchor[1] + placement.offsetYCm / 100 : 0
  const side = preset?.side ?? 'front'

  const { geometry, hit } = useMemo(
    () => (preset ? projectDecal(targets, { side, center: [cx, cy], width, height, rotationDeg: placement.rotationDeg }) : { geometry: null, hit: null }),
    [preset, targets, side, cx, cy, width, height, placement.rotationDeg],
  )
  useEffect(() => () => geometry?.dispose(), [geometry])

  const startDrag = useGizmoDrag(def, hit?.z ?? 0, layer.id)

  if (!geometry || !texture || !preset || !hit) return null

  const setCursor = (c: string) => (gl.domElement.style.cursor = c)

  return (
    <>
      <mesh
        geometry={geometry}
        renderOrder={2 + order}
        userData={{ logoId: layer.id, logoOrder: order }}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          // Gizmo handles draw on top of everything, so they also win the click even when
          // the curved fabric under a corner is nearer the camera than the handle.
          if (e.intersections.some((i) => i.object.userData.gizmoHandle)) return
          // First tap selects (orbit still works); once selected, dragging moves the print —
          // even where another logo covers it.
          if (selected && !placement.locked) startDrag(e, 'move')
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 6 || e.intersections.some((i) => i.object.userData.gizmoHandle)) return
          // Where logos overlap, a click selects the one printed on top.
          if (topLogoAt(e.intersections) !== layer.id) return
          e.stopPropagation()
          useUiStore.getState().setActiveLogo(layer.id, true)
          useUiStore.getState().setStep('logo')
        }}
        onPointerOver={() => setCursor(selected && !placement.locked ? 'move' : 'pointer')}
        onPointerOut={() => setCursor('')}
      >
        <PrintMaterial map={texture} width={width} height={height} opacity={placement.opacity} layer={order} />
      </mesh>
      {selected && (
        <LogoGizmo
          side={side}
          center={[cx, cy]}
          planeZ={hit.z}
          width={width}
          height={height}
          rotationDeg={placement.rotationDeg}
          locked={placement.locked}
          area={def.printAreas[side]}
          startDrag={startDrag}
        />
      )}
    </>
  )
}
