import { BufferAttribute, BufferGeometry } from 'three'
import type { GarmentPart, RegionId } from '../../garments/types'

/**
 * Distance from every vertex to the outer edge of a set of garment parts,
 * for drawing a zone's outline on the model. Panels are separate meshes whose
 * seams nearly touch, so a mesh edge within `SEAM` of another selected part's
 * edge is a seam inside the selection, not part of its outline. Distances are
 * straight-line to the outline's segments, which keeps the band even (paths
 * along mesh edges zig-zag).
 */

/** Edges of different parts this close (m) are sewn together. */
const SEAM = 0.003
/** Only distances below this (m) matter for an outline; anything further reads as "far". */
const MAX = 0.03

interface Graph {
  /** Original vertex → welded vertex. */
  weld: Int32Array
  /** Welded vertex positions, xyz. */
  pos: Float64Array
  /** Mesh edges used by one triangle only, as welded vertex pairs. */
  edges: [number, number][]
}

const graphs = new WeakMap<BufferGeometry, Graph>()

/** The mesh's open edges, with coincident vertices (UV seams) welded first. */
function graphOf(geometry: BufferGeometry): Graph {
  const cached = graphs.get(geometry)
  if (cached) return cached
  const position = geometry.getAttribute('position')
  const count = position.count
  const weld = new Int32Array(count)
  const ids = new Map<string, number>()
  const pos: number[] = []
  for (let v = 0; v < count; v++) {
    const x = position.getX(v), y = position.getY(v), z = position.getZ(v)
    const key = `${Math.round(x * 1e6)},${Math.round(y * 1e6)},${Math.round(z * 1e6)}`
    let id = ids.get(key)
    if (id === undefined) {
      id = ids.size
      ids.set(key, id)
      pos.push(x, y, z)
    }
    weld[v] = id
  }
  const n = ids.size
  const index = geometry.getIndex()
  const corner = (i: number) => weld[index ? index.getX(i) : i]
  const uses = new Map<number, number>()
  for (let t = 0; t < (index ? index.count : count) / 3; t++)
    for (let k = 0; k < 3; k++) {
      const a = corner(3 * t + k), b = corner(3 * t + ((k + 1) % 3))
      if (a === b) continue
      const key = a < b ? a * n + b : b * n + a
      uses.set(key, (uses.get(key) ?? 0) + 1)
    }
  const edges: [number, number][] = []
  for (const [key, c] of uses) if (c === 1) edges.push([Math.floor(key / n), key % n])
  const graph = { weld, pos: Float64Array.from(pos), edges }
  graphs.set(geometry, graph)
  return graph
}

type Seg = [number, number, number, number, number, number]

/** Spatial hash of segments (or points) in cells of `size` metres. */
function grid<T>(size: number) {
  const cells = new Map<string, T[]>()
  const key = (x: number, y: number, z: number) => `${Math.floor(x / size)},${Math.floor(y / size)},${Math.floor(z / size)}`
  return {
    add(item: T, x0: number, y0: number, z0: number, x1 = x0, y1 = y0, z1 = z0) {
      for (let x = Math.floor(Math.min(x0, x1) / size); x <= Math.floor(Math.max(x0, x1) / size); x++)
        for (let y = Math.floor(Math.min(y0, y1) / size); y <= Math.floor(Math.max(y0, y1) / size); y++)
          for (let z = Math.floor(Math.min(z0, z1) / size); z <= Math.floor(Math.max(z0, z1) / size); z++) {
            const k = `${x},${y},${z}`
            const list = cells.get(k)
            if (list) list.push(item)
            else cells.set(k, [item])
          }
    },
    /** Items in the cell holding (x, y, z) and its 26 neighbours. */
    near(x: number, y: number, z: number): T[] {
      const [cx, cy, cz] = key(x, y, z).split(',').map(Number)
      const out: T[] = []
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) out.push(...(cells.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []))
      return out
    },
  }
}

function pointSegment(px: number, py: number, pz: number, [ax, ay, az, bx, by, bz]: Seg): number {
  const [dx, dy, dz] = [bx - ax, by - ay, bz - az]
  const len2 = dx * dx + dy * dy + dz * dz
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / len2)) : 0
  return Math.hypot(px - ax - t * dx, py - ay - t * dy, pz - az - t * dz)
}

/**
 * Per-vertex distance (m, capped) to the outline of the given parts taken
 * together, for each of those parts' meshes.
 */
export function edgeDistances(parts: GarmentPart[], set: RegionId[]): Map<GarmentPart, Float32Array> {
  const chosen = parts.filter((p) => set.includes(p.region))
  const graphsOf = chosen.map((p) => graphOf(p.geometry))
  const P = (g: Graph, v: number) => [g.pos[3 * v], g.pos[3 * v + 1], g.pos[3 * v + 2]] as const

  // Open-edge vertices of every chosen part, to find the seams between them.
  const ends = grid<{ part: number; x: number; y: number; z: number }>(SEAM)
  graphsOf.forEach((g, part) => {
    for (const [a, b] of g.edges) for (const v of [a, b]) {
      const [x, y, z] = P(g, v)
      ends.add({ part, x, y, z }, x, y, z)
    }
  })
  const sewn = (part: number, [x, y, z]: readonly [number, number, number]) =>
    ends.near(x, y, z).some((o) => o.part !== part && Math.hypot(o.x - x, o.y - y, o.z - z) <= SEAM)

  // The outline: open edges that aren't sewn to another selected part.
  const outline = grid<Seg>(MAX)
  graphsOf.forEach((g, part) => {
    for (const [a, b] of g.edges) {
      const pa = P(g, a), pb = P(g, b)
      if (sewn(part, pa) && sewn(part, pb)) continue
      outline.add([...pa, ...pb], ...pa, ...pb)
    }
  })

  const out = new Map<GarmentPart, Float32Array>()
  chosen.forEach((p, part) => {
    const g = graphsOf[part]
    const welded = new Float64Array(g.pos.length / 3)
    for (let v = 0; v < welded.length; v++) {
      const [x, y, z] = P(g, v)
      let d = MAX
      for (const s of outline.near(x, y, z)) d = Math.min(d, pointSegment(x, y, z, s))
      welded[v] = d
    }
    out.set(p, Float32Array.from(g.weld, (w) => welded[w]))
  })
  return out
}

/** The part's geometry plus an `aEdge` distance attribute (position and index buffers are shared, not copied). */
export function withEdgeAttribute(geometry: BufferGeometry, distances: Float32Array): BufferGeometry {
  const g = new BufferGeometry()
  const index = geometry.getIndex()
  if (index) g.setIndex(index)
  g.setAttribute('position', geometry.getAttribute('position'))
  g.setAttribute('aEdge', new BufferAttribute(distances, 1))
  g.boundingSphere = geometry.boundingSphere
  g.boundingBox = geometry.boundingBox
  return g
}
