// Prepares a garment GLB for the customizer:
//   1. splits the garment into `body` / `sleeves` / `collar` meshes by UV island
//      (each pattern piece is its own UV island in typical apparel exports),
//   2. strips baked textures (they carry the source's own colour/print artwork —
//      the customizer supplies colour, fabric detail and the customer's logo),
//   3. compacts + quantizes geometry for a small download.
//
// Usage: node scripts/prepare-model.mjs "<input.glb>" [output.glb]
//
// Classification rules (tuned for a standard tee; adjust if a model differs):
//   collar  = small islands at the very top of the garment
//   sleeves = islands whose centre sits well off the vertical centre line
//   body    = everything else (front/back panels)

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, quantize } from '@gltf-transform/functions'

const [, , input, output = 'public/models/raglan-tee.glb'] = process.argv
if (!input) {
  console.error('Usage: node scripts/prepare-model.mjs <input.glb> [output.glb]')
  process.exit(1)
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(input)
const root = doc.getRoot()
const buffer = root.listBuffers()[0] ?? doc.createBuffer()

// Gather every triangle from every primitive, with transforms baked.
const verts = { pos: [], nrm: [], uv: [] }
const tris = []
for (const node of root.listNodes()) {
  const mesh = node.getMesh()
  if (!mesh) continue
  const m = node.getWorldMatrix()
  const identity = m.every((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) < 1e-9)
  if (!identity) throw new Error(`Node "${node.getName()}" has a transform; bake it before running this script.`)
  for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION')
    const N = prim.getAttribute('NORMAL')
    const U = prim.getAttribute('TEXCOORD_0')
    if (!P || !N || !U) throw new Error('Primitive needs POSITION, NORMAL and TEXCOORD_0.')
    const base = verts.pos.length / 3
    for (let i = 0; i < P.getCount(); i++) {
      verts.pos.push(...P.getElement(i, []))
      verts.nrm.push(...N.getElement(i, []))
      verts.uv.push(...U.getElement(i, []))
    }
    const idx = prim.getIndices()?.getArray() ?? Uint32Array.from({ length: P.getCount() }, (_, i) => i)
    for (let i = 0; i < idx.length; i++) tris.push(base + idx[i])
  }
}

// UV islands via union-find over shared vertex indices (UV seams duplicate vertices).
const n = verts.pos.length / 3
const parent = Int32Array.from({ length: n }, (_, i) => i)
const find = (x) => {
  while (parent[x] !== x) x = parent[x] = parent[parent[x]]
  return x
}
for (let t = 0; t < tris.length; t += 3) {
  const a = find(tris[t])
  parent[find(tris[t + 1])] = a
  parent[find(tris[t + 2])] = a
}

let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity
for (let i = 0; i < n; i++) {
  minY = Math.min(minY, verts.pos[3 * i + 1]); maxY = Math.max(maxY, verts.pos[3 * i + 1])
  minX = Math.min(minX, verts.pos[3 * i]); maxX = Math.max(maxX, verts.pos[3 * i])
}
const height = maxY - minY
const cx = (minX + maxX) / 2
const halfSpan = (maxX - minX) / 2

const islands = new Map()
for (let t = 0; t < tris.length; t += 3) {
  const r = find(tris[t])
  let s = islands.get(r)
  if (!s) islands.set(r, (s = { tris: [], sx: 0, top: -Infinity }))
  s.tris.push(tris[t], tris[t + 1], tris[t + 2])
  for (let k = 0; k < 3; k++) {
    s.sx += verts.pos[3 * tris[t + k]]
    s.top = Math.max(s.top, verts.pos[3 * tris[t + k] + 1])
  }
}

const regions = { body: [], sleeves: [], collar: [] }
const total = tris.length / 3
for (const s of islands.values()) {
  const count = s.tris.length / 3
  const centreX = s.sx / s.tris.length - cx
  const region =
    s.top > minY + 0.9 * height && count < 0.05 * total ? 'collar' : Math.abs(centreX) > 0.25 * halfSpan ? 'sleeves' : 'body'
  regions[region].push(...s.tris)
  normalizeIslandUVs(s, region)
}

// Pattern-ready UVs. Source layouts store pieces in any orientation (this one has
// the front panel upside down and mirrored). Each island is rotated/mirrored so
// +v points up the garment and +u to the viewer's right for its side, scaled to
// 1 UV unit = 1 metre of fabric (at the viewer's 0.72 m garment height), and
// placed at its garment position — so tiled patterns are upright, true to size
// and line up across side seams. Safe because baked textures are stripped.
function normalizeIslandUVs(island, region) {
  const metresPerUnit = 0.72 / height
  const X = (v) => (verts.pos[3 * v] - cx) * metresPerUnit
  const Y = (v) => (verts.pos[3 * v + 1] - minY) * metresPerUnit
  const U = (v) => verts.uv[2 * v]
  const V = (v) => verts.uv[2 * v + 1]
  const list = [...new Set(island.tris)]

  // True surface area vs UV area gives a uniform metric scale (no projection squash).
  let area3 = 0
  let areaUV = 0
  for (let t = 0; t < island.tris.length; t += 3) {
    const [a, b, c] = [island.tris[t], island.tris[t + 1], island.tris[t + 2]]
    const p = (v) => [verts.pos[3 * v], verts.pos[3 * v + 1], verts.pos[3 * v + 2]].map((x) => x * metresPerUnit)
    const [pa, pb, pc] = [p(a), p(b), p(c)]
    const e1 = pb.map((x, i) => x - pa[i])
    const e2 = pc.map((x, i) => x - pa[i])
    area3 += Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2
    areaUV += Math.abs((U(b) - U(a)) * (V(c) - V(a)) - (V(b) - V(a)) * (U(c) - U(a))) / 2
  }
  const scale = Math.sqrt(area3 / (areaUV || 1))

  const mean = (f, vs) => vs.reduce((acc, v) => acc + f(v), 0) / vs.length
  const nz = mean((v) => verts.nrm[3 * v + 2], list)
  const back = region === 'body' && nz < -0.25
  // Sleeves wrap the arm; fit orientation on their front-facing half only.
  const fitSet = region === 'sleeves' ? list.filter((v) => verts.nrm[3 * v + 2] > 0.2) : list
  const fit = fitSet.length > 20 ? fitSet : list
  const [uc, vc, xc, yc] = [mean(U, list), mean(V, list), mean(X, list), mean(Y, list)]

  // Rotation (+ optional mirror) from a least-squares fit of UV → garment XY.
  let R = [1, 0, 0, 1]
  if (region !== 'collar') {
    let suu = 0, suv = 0, svv = 0, sxu = 0, sxv = 0, syu = 0, syv = 0
    for (const v of fit) {
      const du = U(v) - uc, dv = V(v) - vc, dx = X(v) - xc, dy = Y(v) - yc
      suu += du * du; suv += du * dv; svv += dv * dv
      sxu += dx * du; sxv += dx * dv; syu += dy * du; syv += dy * dv
    }
    const det = suu * svv - suv * suv || 1
    const solve = (pu, pv) => [(svv * pu - suv * pv) / det, (suu * pv - suv * pu) / det]
    const [a, b] = solve(sxu, sxv)
    const [c, d] = solve(syu, syv)
    const f = a * d - b * c < 0 ? -1 : 1
    const theta = Math.atan2(c * f - b, a * f + d)
    R = [Math.cos(theta) * f, -Math.sin(theta), Math.sin(theta) * f, Math.cos(theta)]
  }

  for (const v of list) {
    const du = U(v) - uc
    const dv = V(v) - vc
    let u = scale * (R[0] * du + R[1] * dv) + xc
    const w = scale * (R[2] * du + R[3] * dv) + yc
    if (back) u = -u // reads correctly when seen from behind
    verts.uv[2 * v] = u + 0.5
    verts.uv[2 * v + 1] = w
  }
  const us = list.map((v) => verts.uv[2 * v]), vs = list.map((v) => verts.uv[2 * v + 1])
  console.log(`  island ${region.padEnd(7)}${back ? ' back ' : '      '} scale ${scale.toFixed(3)}  u ${Math.min(...us).toFixed(2)}..${Math.max(...us).toFixed(2)}  v ${Math.min(...vs).toFixed(2)}..${Math.max(...vs).toFixed(2)}`)
}

// Rebuild the scene: one node + mesh + material per region, compact vertex arrays.
for (const node of root.listNodes()) node.dispose()
for (const mesh of root.listMeshes()) mesh.dispose()
for (const tex of root.listTextures()) tex.dispose()
for (const mat of root.listMaterials()) mat.dispose()

const scene = root.listScenes()[0] ?? doc.createScene('Scene')
const garment = doc.createNode('raglan_tee')
scene.addChild(garment)

for (const [name, list] of Object.entries(regions)) {
  if (!list.length) continue
  const remap = new Map()
  const pos = [], nrm = [], uv = [], idx = []
  for (const v of list) {
    let r = remap.get(v)
    if (r === undefined) {
      r = remap.size
      remap.set(v, r)
      pos.push(verts.pos[3 * v], verts.pos[3 * v + 1], verts.pos[3 * v + 2])
      nrm.push(verts.nrm[3 * v], verts.nrm[3 * v + 1], verts.nrm[3 * v + 2])
      uv.push(verts.uv[2 * v], verts.uv[2 * v + 1])
    }
    idx.push(r)
  }
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer)
  const material = doc.createMaterial(name).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.85).setMetallicFactor(0).setDoubleSided(true)
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array(pos)))
    .setAttribute('NORMAL', acc('VEC3', new Float32Array(nrm)))
    .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(uv)))
    .setIndices(acc('SCALAR', new Uint32Array(idx)))
    .setMaterial(material)
  garment.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)))
  console.log(`${name.padEnd(8)} ${String(idx.length / 3).padStart(6)} triangles  ${String(remap.size).padStart(6)} vertices`)
}

// keepAttributes: UVs drive the fabric normal map even though no texture ships in the file.
await doc.transform(prune({ keepAttributes: true }), quantize())
await io.write(output, doc)
console.log(`islands: ${islands.size}, height ${height.toFixed(2)} source units → ${output}`)
