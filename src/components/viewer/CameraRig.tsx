import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { PerspectiveCamera, Vector2, Vector3, type Object3D } from 'three'
import type { GarmentModelData } from '../../garments/types'
import { useUiStore, type ViewId } from '../../state/uiStore'
import { viewerBridge } from './viewerBridge'

const { ACTION } = CameraControlsImpl

const AZIMUTH: Record<ViewId, number> = { front: 0, back: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }
/** Slightly above chest height, like a product shot. */
const POLAR = 1.43

function fitDistance(bounds: GarmentModelData['bounds'], aspect: number, fovDeg: number, margin = 1.42) {
  const halfW = (bounds.max[0] - bounds.min[0]) * 0.5 * margin
  const halfH = (bounds.max[1] - bounds.min[1]) * 0.5 * margin
  const t = Math.tan((fovDeg * Math.PI) / 360)
  return Math.max(halfH / t, halfW / (t * aspect)) + (bounds.max[2] - bounds.min[2]) * 0.5
}

const wrapPi = (a: number) => {
  const t = (a + Math.PI) % (Math.PI * 2)
  return (t < 0 ? t + Math.PI * 2 : t) - Math.PI
}

export function CameraRig({ bounds }: { bounds: GarmentModelData['bounds'] }) {
  const controls = useRef<CameraControlsImpl>(null)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const view = useUiStore((s) => s.view)
  const viewNonce = useUiStore((s) => s.viewNonce)

  const center = useMemo(
    () => new Vector3(0, (bounds.min[1] + bounds.max[1]) / 2 - 0.01, (bounds.min[2] + bounds.max[2]) / 2),
    [bounds],
  )
  const fit = fitDistance(bounds, aspect, camera.fov)

  // Keep the latest values available to the imperative API without re-registering it.
  const live = useRef({ center, fit, view })
  useEffect(() => {
    live.current = { center, fit, view }
  })

  // Input mapping: orbit + zoom only (panning tends to lose the garment).
  useEffect(() => {
    const c = controls.current
    if (!c) return
    c.mouseButtons.left = ACTION.ROTATE
    c.mouseButtons.middle = ACTION.DOLLY
    c.mouseButtons.right = ACTION.NONE
    c.mouseButtons.wheel = ACTION.DOLLY
    c.touches.one = ACTION.TOUCH_ROTATE
    c.touches.two = ACTION.TOUCH_DOLLY
    c.touches.three = ACTION.NONE
  }, [])

  // Explicit view requests (buttons, placement changes).
  const first = useRef(true)
  useEffect(() => {
    const c = controls.current
    if (!c) return
    const animate = !first.current
    first.current = false
    const { center: ctr, fit: d } = live.current
    c.normalizeRotations()
    const target = c.azimuthAngle + wrapPi(AZIMUTH[view] - c.azimuthAngle)
    void c.setTarget(ctr.x, ctr.y, ctr.z, animate)
    void c.rotateTo(target, POLAR, animate)
    void c.dollyTo(d, animate)
  }, [view, viewNonce])

  // Product or viewport changes: re-centre and re-fit without forcing a view.
  useEffect(() => {
    const c = controls.current
    if (!c || first.current) return
    void c.setTarget(center.x, center.y, center.z, true)
    void c.dollyTo(fit, true)
  }, [center, fit])

  useEffect(() => {
    return viewerBridge.register({
      zoom: (dir) => {
        const c = controls.current
        if (!c) return
        void c.dolly(dir * c.distance * 0.2, true)
      },
      resetCamera: () => {
        const c = controls.current
        if (!c) return
        const { center: ctr, fit: d } = live.current
        c.normalizeRotations()
        void c.setTarget(ctr.x, ctr.y, ctr.z, true)
        void c.rotateTo(c.azimuthAngle + wrapPi(-c.azimuthAngle), POLAR, true)
        void c.dollyTo(d, true)
        useUiStore.setState({ view: 'front' })
      },
      capture: (views, width, height) => {
        const prevSize = gl.getSize(new Vector2())
        const prevRatio = gl.getPixelRatio()
        const prevPos = camera.position.clone()
        const prevQuat = camera.quaternion.clone()
        const prevAspect = camera.aspect
        const { center: ctr } = live.current
        // Editing aids (selection gizmo, print-area frame) never appear in exports.
        const hidden: Object3D[] = []
        scene.traverse((o) => {
          if (o.userData.uiOnly && o.visible) {
            o.visible = false
            hidden.push(o)
          }
        })
        try {
          gl.setPixelRatio(1)
          gl.setSize(width, height, false)
          camera.aspect = width / height
          camera.updateProjectionMatrix()
          const d = fitDistance(bounds, camera.aspect, camera.fov, 1.08)
          return views.map((v) => {
            const az = AZIMUTH[v]
            camera.position.set(
              ctr.x + d * Math.sin(POLAR) * Math.sin(az),
              ctr.y + d * Math.cos(POLAR),
              ctr.z + d * Math.sin(POLAR) * Math.cos(az),
            )
            camera.lookAt(ctr)
            gl.render(scene, camera)
            return gl.domElement.toDataURL('image/png')
          })
        } finally {
          hidden.forEach((o) => (o.visible = true))
          gl.setPixelRatio(prevRatio)
          gl.setSize(prevSize.x, prevSize.y, false)
          camera.aspect = prevAspect
          camera.position.copy(prevPos)
          camera.quaternion.copy(prevQuat)
          camera.updateProjectionMatrix()
          gl.render(scene, camera)
          invalidate()
        }
      },
    })
  }, [bounds, camera, gl, invalidate, scene])

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={0.42}
      maxDistance={fit * 1.9}
      minPolarAngle={0.35}
      maxPolarAngle={1.95}
      smoothTime={0.28}
      draggingSmoothTime={0.08}
      dollySpeed={0.6}
      azimuthRotateSpeed={0.9}
      polarRotateSpeed={0.9}
    />
  )
}
