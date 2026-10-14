import { useCallback } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Plane, Raycaster, Vector2, Vector3, type PerspectiveCamera } from 'three'
import { create } from 'zustand'
import type { GarmentDefinition } from '../../garments/types'
import type { V2 } from '../../garments/flat/geom2d'
import { useDesignStore } from '../../state/designStore'
import { rotatedExtents, snapCenter, snapRotation, type SnapGuides } from '../../lib/logoTransform'

export type DragMode = 'move' | 'resize' | 'rotate'

/** Transient gizmo state (not part of the design or its undo history). */
export const useGizmoState = create<{ dragging: DragMode | null; guides: SnapGuides | null }>(() => ({
  dragging: null,
  guides: null,
}))

/** Snap distance in screen pixels, as in OpenMerch's SNAP_THRESHOLD_PX. */
const SNAP_PX = 8
let gesture = 0
let lastDragEnd = 0

/** True right after a gizmo drag, so the trailing click isn't treated as "clicked empty space". */
export const draggedRecently = () => performance.now() - lastDragEnd < 300

/**
 * Starts a move / resize / rotate gesture on the logo. The pointer is projected
 * onto the plane the print faces (front or back), so dragging stays stable even
 * when the cursor leaves the garment silhouette. Orbit is disabled for the
 * gesture, and the whole gesture becomes a single undo step.
 */
export function useGizmoDrag(def: GarmentDefinition, planeZ: number, id: string) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null

  return useCallback(
    (e: ThreeEvent<PointerEvent>, mode: DragMode) => {
      const { design, updateTransform: update } = useDesignStore.getState()
      const layer = design.logos.find((l) => l.id === id)
      if (!layer) return
      const start = layer.placement
      const preset = def.placements.find((p) => p.id === start.placement)
      if (!preset || start.locked) return
      e.stopPropagation()
      const updateTransform = (patch: Parameters<typeof update>[1], opts: Parameters<typeof update>[2]) => update(id, patch, opts)

      const area = def.printAreas[preset.side]
      const aspect = layer.asset.width / layer.asset.height
      const sign = preset.side === 'front' ? 1 : -1
      const normal = new Vector3(0, 0, sign)
      const plane = new Plane().setFromNormalAndCoplanarPoint(normal, new Vector3(0, 0, planeZ))
      const raycaster = new Raycaster()
      const ndc = new Vector2()
      const hit = new Vector3()
      const rect = gl.domElement.getBoundingClientRect()

      const toView = (clientX: number, clientY: number): V2 | null => {
        ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
        raycaster.setFromCamera(ndc, camera)
        // Grazing angles make the projection explode; ignore until the view is usable.
        if (Math.abs(raycaster.ray.direction.dot(normal)) < 0.12) return null
        if (!raycaster.ray.intersectPlane(plane, hit)) return null
        return [hit.x * sign, hit.y]
      }

      const p0 = toView(e.nativeEvent.clientX, e.nativeEvent.clientY)
      if (!p0) return
      const c0: V2 = [preset.anchor[0] + start.offsetXCm / 100, preset.anchor[1] + start.offsetYCm / 100]
      const dist = camera.position.distanceTo(new Vector3(c0[0] * sign, c0[1], planeZ))
      const metresPerPx = (2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / rect.height
      const key = `gizmo-${++gesture}`

      if (controls) controls.enabled = false
      useGizmoState.setState({ dragging: mode })

      const onMove = (ev: PointerEvent) => {
        const p = toView(ev.clientX, ev.clientY)
        if (!p) return
        if (mode === 'move') {
          const raw: V2 = [c0[0] + p[0] - p0[0], c0[1] + p[1] - p0[1]]
          const extents = rotatedExtents(start.widthCm / 100, aspect, start.rotationDeg)
          // Hold Alt to place freely without snapping.
          const snapped = ev.altKey ? { center: raw, guides: null } : snapCenter(raw, extents, area, SNAP_PX * metresPerPx)
          useGizmoState.setState({ guides: snapped.guides })
          updateTransform(
            { offsetXCm: (snapped.center[0] - preset.anchor[0]) * 100, offsetYCm: (snapped.center[1] - preset.anchor[1]) * 100 },
            { coalesce: key },
          )
        } else if (mode === 'resize') {
          const d0 = Math.hypot(p0[0] - c0[0], p0[1] - c0[1])
          if (d0 < 1e-4) return
          const d = Math.hypot(p[0] - c0[0], p[1] - c0[1])
          updateTransform({ widthCm: (start.widthCm * d) / d0 }, { coalesce: key })
        } else {
          const a0 = Math.atan2(p0[1] - c0[1], p0[0] - c0[0])
          const a = Math.atan2(p[1] - c0[1], p[0] - c0[0])
          // atan2 grows counter-clockwise; rotationDeg is clockwise.
          const raw = ((((start.rotationDeg - ((a - a0) * 180) / Math.PI + 180) % 360) + 360) % 360) - 180
          // Hold Shift for free rotation without the 45° snaps.
          updateTransform({ rotationDeg: ev.shiftKey ? raw : snapRotation(raw) }, { coalesce: key })
        }
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        if (controls) controls.enabled = true
        useGizmoState.setState({ dragging: null, guides: null })
        gl.domElement.style.cursor = ''
        lastDragEnd = performance.now()
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [camera, gl, controls, def, planeZ, id],
  )
}
