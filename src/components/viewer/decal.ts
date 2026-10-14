import {
  BufferGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Raycaster,
  Vector3,
} from 'three'
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js'
import type { Side } from '../../garments/types'

const proxyMaterial = new MeshBasicMaterial({ side: DoubleSide })
const Y = new Vector3(0, 1, 0)
const Z = new Vector3(0, 0, 1)

export interface DecalRequest {
  side: Side
  /** Centre in the side's view space (x to the viewer's right), metres. */
  center: [number, number]
  width: number
  height: number
  /** Clockwise as seen by the viewer, degrees. */
  rotationDeg: number
}

/** Projector depth: deep enough to wrap the chest curvature, shallow enough to miss the opposite panel. */
const DEPTH = 0.16

/**
 * Keeps only triangles that face the projector and lie near it. This makes
 * DecalGeometry cheap enough to rebuild on every slider tick, and stops the
 * projection from bleeding onto the inside or the opposite side of the garment.
 */
function cullForProjector(geometry: BufferGeometry, position: Vector3, radius: number, dir: Vector3): BufferGeometry {
  const pos = geometry.getAttribute('position')
  const nrm = geometry.getAttribute('normal')
  const index = geometry.index
  const triCount = index ? index.count / 3 : pos.count / 3
  const outPos: number[] = []
  const outNrm: number[] = []
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), n = new Vector3(), tmp = new Vector3()
  const r2 = radius * radius
  for (let t = 0; t < triCount; t++) {
    const ia = index ? index.getX(3 * t) : 3 * t
    const ib = index ? index.getX(3 * t + 1) : 3 * t + 1
    const ic = index ? index.getX(3 * t + 2) : 3 * t + 2
    a.fromBufferAttribute(pos, ia)
    if (a.distanceToSquared(position) > r2) {
      b.fromBufferAttribute(pos, ib)
      c.fromBufferAttribute(pos, ic)
      if (b.distanceToSquared(position) > r2 && c.distanceToSquared(position) > r2) continue
    } else {
      b.fromBufferAttribute(pos, ib)
      c.fromBufferAttribute(pos, ic)
    }
    n.subVectors(b, a).cross(tmp.subVectors(c, a)).normalize()
    if (n.dot(dir) < 0.12) continue
    for (const [v, i] of [[a, ia], [b, ib], [c, ic]] as const) {
      outPos.push(v.x, v.y, v.z)
      if (nrm) {
        tmp.fromBufferAttribute(nrm, i)
        outNrm.push(tmp.x, tmp.y, tmp.z)
      }
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(outPos, 3))
  if (outNrm.length) g.setAttribute('normal', new Float32BufferAttribute(outNrm, 3))
  return g
}

/** Finds the garment surface under a view-space point by casting a ray from outside. */
export function surfacePoint(targets: BufferGeometry[], side: Side, x: number, y: number): Vector3 | null {
  const dirZ = side === 'front' ? 1 : -1
  const modelX = side === 'front' ? x : -x
  const ray = new Raycaster(new Vector3(modelX, y, dirZ * 3), new Vector3(0, 0, -dirZ))
  const hits = ray.intersectObjects(targets.map((g) => new Mesh(g, proxyMaterial)), false)
  return hits[0]?.point ?? null
}

/**
 * Builds a decal that hugs the garment surface. The projector looks straight
 * at the chosen side, so prints stay upright and undistorted in front/back views,
 * and the result is plain geometry attached to the garment (it rotates with it).
 */
export function buildProjectedDecal(targets: BufferGeometry[], req: DecalRequest): BufferGeometry | null {
  return projectDecal(targets, req).geometry
}

/** Like buildProjectedDecal, but also returns the surface point under the decal centre. */
export function projectDecal(targets: BufferGeometry[], req: DecalRequest): { geometry: BufferGeometry | null; hit: Vector3 | null } {
  const hit = surfacePoint(targets, req.side, req.center[0], req.center[1])
  if (!hit) return { geometry: null, hit: null }
  const dir = new Vector3(0, 0, req.side === 'front' ? 1 : -1)
  const q = new Quaternion()
    .setFromAxisAngle(Y, req.side === 'front' ? 0 : Math.PI)
    .multiply(new Quaternion().setFromAxisAngle(Z, (-req.rotationDeg * Math.PI) / 180))
  const orientation = new Euler().setFromQuaternion(q)
  const size = new Vector3(req.width, req.height, DEPTH)
  const radius = Math.hypot(req.width, req.height, DEPTH) / 2 + 0.01

  const pieces: BufferGeometry[] = []
  for (const g of targets) {
    const culled = cullForProjector(g, hit, radius, dir)
    if (!culled.getAttribute('position').count) {
      culled.dispose()
      continue
    }
    const proxy = new Mesh(culled, proxyMaterial)
    proxy.updateMatrixWorld(true)
    pieces.push(new DecalGeometry(proxy, hit, orientation, size))
    culled.dispose()
  }
  if (!pieces.length) return { geometry: null, hit }
  if (pieces.length === 1) return { geometry: pieces[0], hit }

  const pos: number[] = []
  const nrm: number[] = []
  const uv: number[] = []
  for (const p of pieces) {
    pos.push(...(p.getAttribute('position').array as Float32Array))
    nrm.push(...(p.getAttribute('normal')?.array ?? []))
    uv.push(...(p.getAttribute('uv').array as Float32Array))
    p.dispose()
  }
  const merged = new BufferGeometry()
  merged.setAttribute('position', new Float32BufferAttribute(pos, 3))
  merged.setAttribute('normal', new Float32BufferAttribute(nrm, 3))
  merged.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return { geometry: merged, hit }
}
