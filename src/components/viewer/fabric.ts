import {
  CanvasTexture,
  Color,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshPhysicalMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
} from 'three'

/**
 * Builds a tangent-space normal map from a height function sampled on a tile.
 * Generated at runtime so no texture assets need to be shipped or licensed.
 */
function normalMapFromHeight(size: number, height: (x: number, y: number) => number, strength: number) {
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = height(x / size, y / size)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const l = Math.hypot(dx, dy, 1)
      const o = (y * size + x) * 4
      img.data[o] = ((-dx / l) * 0.5 + 0.5) * 255
      img.data[o + 1] = ((dy / l) * 0.5 + 0.5) * 255
      img.data[o + 2] = ((1 / l) * 0.5 + 0.5) * 255
      img.data[o + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  const tex = new CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.colorSpace = NoColorSpace
  tex.minFilter = LinearMipmapLinearFilter
  tex.magFilter = LinearFilter
  tex.anisotropy = 8
  return tex
}

/** Single-jersey knit: columns of interlocking "V" loops. */
const jerseyHeight = (u: number, v: number) => {
  const cols = 12
  const rows = 16
  const cu = (u * cols) % 1
  const cv = (v * rows) % 1
  const leg = Math.abs(cu - 0.5)
  const target = 0.08 + cv * 0.36
  const d = Math.abs(leg - target)
  const loop = Math.exp(-((d / 0.11) ** 2))
  const grain = Math.sin(u * 211.0 + Math.sin(v * 53.0) * 2.0) * 0.06
  return loop + grain
}

/** 1×1 rib: soft vertical ridges. */
const ribHeight = (u: number) => 0.5 + 0.5 * Math.cos(u * Math.PI * 2 * 8)

let cache: { jersey: CanvasTexture; rib: CanvasTexture } | null = null

export function fabricTextures() {
  if (!cache) {
    cache = {
      jersey: normalMapFromHeight(256, jerseyHeight, 2.2),
      rib: normalMapFromHeight(128, (u) => ribHeight(u), 3),
    }
  }
  return cache
}

/** Darkens back faces so the inside of the garment reads as the shaded interior. */
function insideShading(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    '#include <color_fragment>\n\tdiffuseColor.rgb *= gl_FrontFacing ? 1.0 : 0.58;',
  )
}

/** Physical size of one texture tile: jersey ≈ 2.4 cm (12 wales), rib ≈ 4 cm (8 ribs). */
const TILE_M = { jersey: 0.024, rib: 0.04 }

/**
 * Fabric material for a garment part. `uvScale` is metres of fabric per UV unit
 * on the model, so the knit detail has the same real-world size on any mesh.
 */
export function createFabricMaterial(finish: 'jersey' | 'rib', uvScale = 1) {
  const normalMap = fabricTextures()[finish].clone()
  normalMap.repeat.setScalar(uvScale / TILE_M[finish])
  const m = new MeshPhysicalMaterial({
    color: new Color('#ffffff'),
    roughness: finish === 'rib' ? 0.8 : 0.86,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.5,
    sheenColor: new Color('#ffffff'),
    normalMap,
    normalScale: new Vector2(0.32, 0.32),
    // Real garment meshes are single-surface; render both sides (the inside is darkened below).
    side: DoubleSide,
    envMapIntensity: 0.85,
  })
  m.onBeforeCompile = insideShading
  m.customProgramCacheKey = () => 'honeg-fabric'
  return m
}

const tmp = new Color()

/** Applies a garment colour, with a sheen tint that keeps dark fabrics soft rather than plasticky. */
/** Releases the per-material normal map clone too. */
export function disposeFabricMaterial(m: MeshPhysicalMaterial) {
  m.normalMap?.dispose()
  m.dispose()
}

export function applyFabricColor(m: MeshPhysicalMaterial, hex: string) {
  m.color.set(hex)
  tmp.set(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  tmp.getHSL(hsl, SRGBColorSpace)
  // Dark fabrics read through sheen and soft specular; light ones through diffuse shading.
  const dark = 1 - Math.min(1, hsl.l / 0.35)
  m.sheenColor.setHSL(hsl.h, hsl.s * 0.5, Math.min(1, 0.3 + hsl.l * 0.5 + dark * 0.22), SRGBColorSpace)
  m.sheen = 0.45 + dark * 0.55
  m.sheenRoughness = 0.5 - dark * 0.12
  m.roughness = 0.86 - dark * 0.12
  m.envMapIntensity = 0.85 + dark * 0.9
}
