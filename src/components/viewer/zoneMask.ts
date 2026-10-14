import { Vector4, type Material, type WebGLProgramParametersWithUniforms } from 'three'
import type { PaintZoneDef } from '../../garments/zones'

const MAX_PLANES = 4

/**
 * Restricts a material to a paint zone: fragments outside the zone's planes
 * are discarded, so the zone can be drawn over its parts with the same
 * geometry (crisp edges, no mesh splitting). Chains any existing
 * onBeforeCompile (e.g. the fabric's inside shading).
 */
export function applyZoneMask<M extends Material>(material: M, def: PaintZoneDef): M {
  if (def.planes.length > MAX_PLANES) throw new Error(`Zone ${def.id} has more than ${MAX_PLANES} planes`)
  const planes = Array.from({ length: MAX_PLANES }, (_, i) => new Vector4(...(def.planes[i] ?? [0, 0, 0, 0])))
  const uniforms = {
    uZonePlanes: { value: planes },
    uZoneCount: { value: def.planes.length },
    uZoneAbsX: { value: !!def.absX },
  }
  const base = material.onBeforeCompile.bind(material)
  const baseKey = material.customProgramCacheKey.bind(material)
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    base(shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = `varying vec3 vZonePos;\n${shader.vertexShader.replace(
      '#include <begin_vertex>',
      // Garment geometry is baked in garment space, so object space is what the planes use.
      '#include <begin_vertex>\n\tvZonePos = transformed;',
    )}`
    shader.fragmentShader = `uniform vec4 uZonePlanes[${MAX_PLANES}];\nuniform int uZoneCount;\nuniform bool uZoneAbsX;\nvarying vec3 vZonePos;\n${shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
	{
		vec3 zp = uZoneAbsX ? vec3(abs(vZonePos.x), vZonePos.yz) : vZonePos;
		for (int i = 0; i < ${MAX_PLANES}; i++) {
			if (i >= uZoneCount) break;
			if (dot(uZonePlanes[i].xyz, zp) < uZonePlanes[i].w) discard;
		}
	}`,
    )}`
  }
  // One shared program for every zone; the planes are uniforms.
  material.customProgramCacheKey = () => `${baseKey()}-zone`
  // Drawn exactly over its part: pull it just in front (prints still sit further forward).
  material.polygonOffset = true
  material.polygonOffsetFactor = -1
  material.polygonOffsetUnits = -1
  return material
}
