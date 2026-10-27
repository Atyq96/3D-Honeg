import { useMemo } from 'react'
import { Box3, BufferGeometry, Float32BufferAttribute, Matrix4, type BufferAttribute, type InterleavedBufferAttribute, type Material, type Mesh, type Object3D } from 'three'
import { useGLTF } from '@react-three/drei'
import type { GarmentModelData, GarmentPart, GarmentSource, RegionId } from '../../garments/types'
import { t } from '../../i18n'

function meshNames(mesh: Mesh) {
  const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[]
  return [mesh.name, mesh.parent?.name ?? '', ...materials.map((m) => m.name)]
}

function matchRegion(names: string[], matchers: Partial<Record<RegionId, RegExp>>): RegionId {
  for (const region of ['collar', 'sleeves', 'body'] as RegionId[]) {
    const re = matchers[region]
    if (re && names.some((n) => re.test(n))) return region
  }
  return 'body'
}

/** Float32 copy of an attribute; getComponent de-normalises quantized (KHR_mesh_quantization) data. */
function toFloat(attr: BufferAttribute | InterleavedBufferAttribute) {
  const out = new Float32Array(attr.count * attr.itemSize)
  for (let i = 0; i < attr.count; i++)
    for (let c = 0; c < attr.itemSize; c++) out[i * attr.itemSize + c] = attr.getComponent(i, c)
  return new Float32BufferAttribute(out, attr.itemSize)
}

/** Plain float geometry with only what the viewer uses, so baking transforms can't clip quantized values. */
function cleanGeometry(src: BufferGeometry) {
  const g = new BufferGeometry()
  for (const name of ['position', 'normal', 'uv'] as const) {
    const a = src.getAttribute(name)
    if (a) g.setAttribute(name, toFloat(a))
  }
  if (src.index) g.setIndex(src.index.clone())
  return g
}

/**
 * Adapts an arbitrary glTF scene into garment parts: bakes transforms, drops
 * ignored meshes, maps the rest to colour regions by name, then normalises the
 * result into garment space (centred, hem on y = 0, fixed height) so print
 * areas and camera framing work without per-file tweaking.
 */
export function gltfToModel(scene: Object3D, source: GarmentSource): GarmentModelData {
  scene.updateMatrixWorld(true)
  const rot = new Matrix4().makeRotationY(source.rotationY ?? 0)
  const parts: GarmentPart[] = []
  scene.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const names = meshNames(mesh)
    if (source.ignore && names.some((n) => source.ignore!.test(n))) return
    const geometry = cleanGeometry(mesh.geometry)
    geometry.applyMatrix4(mesh.matrixWorld)
    geometry.applyMatrix4(rot)
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
    const region = matchRegion(names, source.regionMatchers)
    parts.push({ region, geometry, logoTarget: source.logoTargets.includes(region), finish: region === 'collar' ? 'rib' : 'jersey' })
  })
  if (!parts.length) throw new Error(t().viewer.errNoMeshes)

  // Normalise: centre on X/Z, hem on y = 0, scale to the target height.
  const box = new Box3()
  for (const p of parts) {
    p.geometry.computeBoundingBox()
    box.union(p.geometry.boundingBox!)
  }
  const height = box.max.y - box.min.y || 1
  const s = (source.targetHeight ?? 0.72) / height
  const cx = (box.min.x + box.max.x) / 2
  const cz = (box.min.z + box.max.z) / 2
  const out = new Box3()
  for (const p of parts) {
    p.geometry.translate(-cx, -box.min.y, -cz)
    p.geometry.scale(s, s, s)
    p.geometry.computeBoundingBox()
    p.geometry.computeBoundingSphere()
    out.union(p.geometry.boundingBox!)
  }
  // If nothing matched a logo target region, project onto every part rather than nothing.
  if (!parts.some((p) => p.logoTarget)) parts.forEach((p) => (p.logoTarget = true))
  return { parts, bounds: { min: out.min.toArray(), max: out.max.toArray() } }
}

/** Suspends while the glTF loads (handled by the viewer's Suspense / error boundary). */
export function useGltfModel(source: GarmentSource): GarmentModelData {
  const gltf = useGLTF(source.url)
  return useMemo(() => gltfToModel(gltf.scene, source), [gltf.scene, source])
}
