import { useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { DoubleSide, Vector3, type Camera, type Group, type Mesh } from 'three'
import type { PrintArea, Side } from '../../garments/types'
import type { V2 } from '../../garments/flat/geom2d'
import { useGizmoState, type DragMode } from './gizmoDrag'

interface Props {
  side: Side
  /** Logo centre, view space metres. */
  center: V2
  planeZ: number
  width: number
  height: number
  rotationDeg: number
  locked: boolean
  area: PrintArea
  startDrag: (e: ThreeEvent<PointerEvent>, mode: DragMode) => void
}

const INK = '#0E0E0E'
const GUIDE = '#FF4081'
const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
/** Screen-space sizes in px. */
const HANDLE_R = 6
const HIT_R = coarse ? 22 : 14
const ROTATE_OFFSET = 28

/**
 * Selection frame with corner (resize) and rotate handles, drawn on top of the
 * garment and kept a constant on-screen size — the 3D counterpart of the
 * Konva Transformer used by OpenMerch. Hidden when the print faces away.
 */
export function LogoGizmo({ side, center, planeZ, width, height, rotationDeg, locked, area, startDrag }: Props) {
  const gl = useThree((s) => s.gl)
  const guides = useGizmoState((s) => s.guides)
  const root = useRef<Group>(null)
  const rotateHandle = useRef<Group>(null)
  const stem = useRef<{ geometry: { setPositions: (p: number[]) => void } } | null>(null)
  const handles = useRef<(Group | null)[]>([])
  const sign = side === 'front' ? 1 : -1
  const lift = planeZ + sign * 0.004

  const toWorld = (x: number, y: number) => new Vector3(x * sign, y, lift)
  const theta = (rotationDeg * Math.PI) / 180
  // Clockwise rotation in view space (x right, y up).
  const local = (lx: number, ly: number): V2 => [
    center[0] + lx * Math.cos(theta) + ly * Math.sin(theta),
    center[1] - lx * Math.sin(theta) + ly * Math.cos(theta),
  ]
  const hw = width / 2
  const hh = height / 2
  const corners = [local(-hw, hh), local(hw, hh), local(hw, -hh), local(-hw, -hh)]
  const frame = [...corners, corners[0]].map(([x, y]) => toWorld(x, y))
  const centerWorld = useMemo(() => new Vector3(center[0] * sign, center[1], lift), [center, sign, lift])
  const faceRotation: [number, number, number] = [0, side === 'front' ? 0 : Math.PI, 0]

  // Keep handles a constant pixel size and hide the gizmo when the print faces away.
  useFrame(({ camera, size }) => {
    if (!root.current) return
    const toCam = camera.position.clone().sub(centerWorld)
    const facing = (toCam.z * sign) / toCam.length()
    root.current.visible = facing > 0.12
    const fov = 'fov' in camera ? (camera as { fov: number }).fov : 30
    const mpp = (2 * toCam.length() * Math.tan((fov * Math.PI) / 360)) / size.height
    for (const h of handles.current) h?.scale.setScalar(mpp)
    const offset = ROTATE_OFFSET * mpp
    const top = local(0, hh)
    const knob = local(0, hh + offset)
    rotateHandle.current?.position.copy(toWorld(knob[0], knob[1]))
    rotateHandle.current?.scale.setScalar(mpp)
    const a = toWorld(top[0], top[1])
    const b = toWorld(knob[0], knob[1])
    stem.current?.geometry.setPositions([a.x, a.y, a.z, b.x, b.y, b.z])
    if (import.meta.env.DEV) exposeForTests(camera, gl.domElement, [centerWorld, ...frame.slice(0, 4), rotateHandle.current?.position])
  })

  const cursor = (c: string) => () => (gl.domElement.style.cursor = c)
  const clearCursor = () => (gl.domElement.style.cursor = '')
  const resizeCursors = ['nwse-resize', 'nesw-resize', 'nwse-resize', 'nesw-resize']

  const handle = (mode: DragMode, curs: string) => ({
    onPointerDown: (e: ThreeEvent<PointerEvent>) => startDrag(e, mode),
    onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
    onPointerOver: cursor(curs),
    onPointerOut: clearCursor,
  })

  const knobMeshes = (
    <>
      {/* Generous transparent hit area for fingers and imprecise pointers. */}
      <mesh renderOrder={30} userData={{ gizmoHandle: true }}>
        <circleGeometry args={[HIT_R, 20]} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} side={DoubleSide} />
      </mesh>
      <mesh renderOrder={31}>
        <circleGeometry args={[HANDLE_R + 1.5, 24]} />
        <meshBasicMaterial color={INK} depthTest={false} transparent toneMapped={false} side={DoubleSide} />
      </mesh>
      <mesh renderOrder={32}>
        <circleGeometry args={[HANDLE_R - 0.5, 24]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} transparent toneMapped={false} side={DoubleSide} />
      </mesh>
    </>
  )

  return (
    <group ref={root} userData={{ uiOnly: true }}>
      <Line points={frame} color={locked ? '#8a8986' : INK} lineWidth={1.6} dashed={locked} dashSize={0.008} gapSize={0.006} depthTest={false} transparent renderOrder={25} />

      {guides?.x.map((x) => (
        <Line key={`gx${x}`} points={[toWorld(x, area.yMin), toWorld(x, area.yMax)]} color={GUIDE} lineWidth={1.2} dashed dashSize={0.01} gapSize={0.008} depthTest={false} transparent renderOrder={24} />
      ))}
      {guides?.y.map((y) => (
        <Line key={`gy${y}`} points={[toWorld(area.xMin, y), toWorld(area.xMax, y)]} color={GUIDE} lineWidth={1.2} dashed dashSize={0.01} gapSize={0.008} depthTest={false} transparent renderOrder={24} />
      ))}

      {!locked && (
        <>
          {corners.map(([x, y], i) => (
            <group
              key={i}
              ref={(g) => {
                handles.current[i] = g
              }}
              position={toWorld(x, y)}
              rotation={faceRotation}
              {...handle('resize', resizeCursors[i])}
            >
              {knobMeshes}
            </group>
          ))}
          <Line ref={stem as never} points={[centerWorld, centerWorld]} color={INK} lineWidth={1.4} depthTest={false} transparent renderOrder={25} />
          <group ref={rotateHandle} rotation={faceRotation} {...handle('rotate', 'grab')}>
            {knobMeshes}
            <RotateGlyph />
          </group>
        </>
      )}
    </group>
  )
}

/** Dev-only: screen positions of the logo centre, corners and rotate knob, for end-to-end tests. */
function exposeForTests(camera: Camera, canvas: HTMLCanvasElement, points: (Vector3 | undefined)[]) {
  const r = canvas.getBoundingClientRect()
  const toScreen = (p?: Vector3) => {
    if (!p) return null
    const v = p.clone().project(camera)
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
  }
  const [center, ...rest] = points.map(toScreen)
  ;(window as unknown as { __honegGizmo: unknown }).__honegGizmo = { center, corners: rest.slice(0, 4), rotate: rest[4] }
}

/** Small curved-arrow mark inside the rotate knob. */
function RotateGlyph() {
  const ref = useRef<Mesh>(null)
  return (
    <mesh ref={ref} renderOrder={33} rotation={[0, 0, 0.5]}>
      <ringGeometry args={[2.2, 3.4, 20, 1, 0, Math.PI * 1.5]} />
      <meshBasicMaterial color={INK} depthTest={false} transparent toneMapped={false} side={DoubleSide} />
    </mesh>
  )
}
