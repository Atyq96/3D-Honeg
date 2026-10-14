import { useEffect, useMemo } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import type { BufferGeometry } from 'three'
import type { GarmentDefinition } from '../../garments/types'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { fabricTextures } from './fabric'
import { projectDecal } from './decal'
import { useLogoTexture } from './useLogoTexture'
import { LogoGizmo } from './LogoGizmo'
import { useGizmoDrag } from './gizmoDrag'

/**
 * The printed logo: a decal projected onto the garment, plus OpenMerch-style
 * direct manipulation — click to select, drag to move, handles to resize/rotate.
 */
export function LogoLayer({ def, targets }: { def: GarmentDefinition; targets: BufferGeometry[] }) {
  const logo = useDesignStore((s) => s.design.logo)
  const placement = useDesignStore((s) => s.design.placement)
  const selected = useUiStore((s) => s.logoSelected)
  const gl = useThree((s) => s.gl)
  const texture = useLogoTexture(logo?.dataUrl, placement)
  const preset = def.placements.find((p) => p.id === placement.placement)

  const width = placement.widthCm / 100
  const height = logo ? width * (logo.height / logo.width) : width
  const cx = preset ? preset.anchor[0] + placement.offsetXCm / 100 : 0
  const cy = preset ? preset.anchor[1] + placement.offsetYCm / 100 : 0
  const side = preset?.side ?? 'front'

  const { geometry, hit } = useMemo(
    () =>
      logo && preset
        ? projectDecal(targets, { side, center: [cx, cy], width, height, rotationDeg: placement.rotationDeg })
        : { geometry: null, hit: null },
    [logo, preset, targets, side, cx, cy, width, height, placement.rotationDeg],
  )
  useEffect(() => () => geometry?.dispose(), [geometry])

  // Fabric grain on the print, scaled to the decal's own UV space.
  const grain = useMemo(() => {
    const t = fabricTextures().jersey.clone()
    t.repeat.set(width / 0.024, height / 0.024)
    return t
  }, [width, height])
  useEffect(() => () => grain.dispose(), [grain])

  const startDrag = useGizmoDrag(def, hit?.z ?? 0)

  if (!geometry || !texture || !preset || !hit || !logo) return null

  const setCursor = (c: string) => (gl.domElement.style.cursor = c)

  return (
    <>
      <mesh
        geometry={geometry}
        renderOrder={2}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          // Gizmo handles draw on top of everything, so they also win the click even when
          // the curved fabric under a corner is nearer the camera than the handle.
          if (e.intersections.some((i) => i.object.userData.gizmoHandle)) return
          // First tap selects (orbit still works); once selected, dragging moves the print.
          if (selected && !placement.locked) startDrag(e, 'move')
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 6 || e.intersections.some((i) => i.object.userData.gizmoHandle)) return
          e.stopPropagation()
          useUiStore.getState().selectLogo(true)
          useUiStore.getState().setStep('logo')
        }}
        onPointerOver={() => setCursor(selected && !placement.locked ? 'move' : 'pointer')}
        onPointerOut={() => setCursor('')}
      >
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={0.2}
          normalMap={grain}
          normalScale={[0.22, 0.22]}
          transparent
          opacity={placement.opacity}
          alphaTest={0.02}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
          roughness={0.68}
          metalness={0}
          envMapIntensity={0.8}
        />
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
