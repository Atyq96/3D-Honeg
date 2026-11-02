import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, ShaderMaterial, Vector4, type BufferGeometry } from 'three'
import type { GarmentDefinition, GarmentModelData, GarmentPart, RegionId } from '../../garments/types'
import { isPaintZone, type ZoneId } from '../../garments/zones'
import { useUiStore } from '../../state/uiStore'
import { useZones } from '../../state/useColorRegions'
import { edgeDistances, withEdgeAttribute } from './zoneEdges'

const AMBER = '#F2A900'
const MAX_PLANES = 4
/** Outline width on the fabric, m. */
const WIDTH = 0.013
const PULSE_MS = 900

const vertexShader = /* glsl */ `
attribute float aEdge;
varying float vEdge;
varying vec3 vPos;
void main() {
  vEdge = aEdge;
  vPos = position; // garment space: the geometry is baked there
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uWidth;
uniform float uEdge;
uniform float uFill;
uniform vec4 uPlanes[${MAX_PLANES}];
uniform int uCount;
uniform bool uAbsX;
varying float vEdge;
varying vec3 vPos;
void main() {
  // Distance to the zone's outline: the parts' outer edge, or a cutting plane, whichever is nearer.
  float d = vEdge;
  vec3 p = uAbsX ? vec3(abs(vPos.x), vPos.yz) : vPos;
  for (int i = 0; i < ${MAX_PLANES}; i++) {
    if (i >= uCount) break;
    float s = (dot(uPlanes[i].xyz, p) - uPlanes[i].w) / length(uPlanes[i].xyz);
    if (s < 0.0) discard;
    d = min(d, s);
  }
  float edge = 1.0 - smoothstep(uWidth * 0.75, uWidth, d);
  float a = max(edge * uEdge, uFill);
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`

/** Amber outline (and optional tint) of one zone, cut by its planes. */
function outlineMaterial(def: GarmentDefinition, zone: ZoneId) {
  const paint = isPaintZone(zone) ? def.paintZones.find((z) => z.id === zone) : undefined
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new Color(AMBER) },
      uWidth: { value: WIDTH },
      uEdge: { value: 1 },
      uFill: { value: 0 },
      uPlanes: { value: Array.from({ length: MAX_PLANES }, (_, i) => new Vector4(...(paint?.planes[i] ?? [0, 0, 0, 0]))) },
      uCount: { value: paint?.planes.length ?? 0 },
      uAbsX: { value: !!paint?.absX },
    },
    transparent: true,
    depthWrite: false,
    // In front of the fabric, zone overlays and prints, without fighting them for depth.
    polygonOffset: true,
    polygonOffsetFactor: -10,
    polygonOffsetUnits: -10,
    toneMapped: false,
  })
}

const partsOf = (def: GarmentDefinition, zone: ZoneId): RegionId[] =>
  isPaintZone(zone) ? (def.paintZones.find((z) => z.id === zone)?.parts ?? []) : [zone]

/**
 * Shows which zone is selected (amber outline, with a short pulse when it
 * changes) and which one a click would pick (lighter outline and tint), in
 * the Colors and Pattern steps.
 */
export function ZoneHighlight({ def, data }: { def: GarmentDefinition; data: GarmentModelData }) {
  const step = useUiStore((s) => s.step)
  const selected = useUiStore((s) => (s.step === 'color' ? s.colorZone : s.patternZone))
  const hovered = useUiStore((s) => s.hoverZone)
  const zones = useZones()
  const active = step === 'color' || step === 'pattern'
  const zone: ZoneId = zones.includes(selected) ? selected : 'body'

  // Outline geometries per set of parts (body, sleeves, body + sleeves…), built on first use.
  const cache = useMemo(() => new Map<string, { part: GarmentPart; geometry: BufferGeometry }[]>(), [])
  useEffect(
    () => () => {
      cache.forEach((list) => list.forEach((e) => e.geometry.dispose()))
      cache.clear()
    },
    [data, cache],
  )
  const geometriesFor = (set: RegionId[]) => {
    const key = [...set].sort().join('+')
    let list = cache.get(key)
    if (!list) {
      const dist = edgeDistances(data.parts, set)
      list = [...dist].map(([part, d]) => ({ part, geometry: withEdgeAttribute(part.geometry, d) }))
      cache.set(key, list)
    }
    return list
  }

  if (!active) return null
  return (
    <>
      <Outline key={`sel-${zone}`} def={def} zone={zone} geometries={geometriesFor(partsOf(def, zone))} kind="selected" />
      {hovered && hovered !== zone && zones.includes(hovered) && (
        <Outline key={`hover-${hovered}`} def={def} zone={hovered} geometries={geometriesFor(partsOf(def, hovered))} kind="hover" />
      )}
    </>
  )
}

function Outline({ def, zone, geometries, kind }: { def: GarmentDefinition; zone: ZoneId; geometries: { geometry: BufferGeometry }[]; kind: 'selected' | 'hover' }) {
  const material = useMemo(() => outlineMaterial(def, zone), [def, zone])
  useEffect(() => () => material.dispose(), [material])
  const invalidate = useThree((s) => s.invalidate)
  const born = useRef(0)

  useEffect(() => {
    born.current = performance.now()
    if (kind === 'hover') {
      material.uniforms.uEdge.value = 0.55
      material.uniforms.uFill.value = 0.14
    }
    invalidate()
  }, [material, kind, invalidate])

  // Newly selected: a brief amber wash that fades to the outline.
  useFrame(() => {
    if (kind !== 'selected') return
    const t = (performance.now() - born.current) / PULSE_MS
    const fill = t < 1 ? 0.38 * (1 - t) * (1 - t) : 0
    if (material.uniforms.uFill.value !== fill) {
      material.uniforms.uFill.value = fill
      invalidate()
    }
  })

  return (
    <>
      {geometries.map(({ geometry }, i) => (
        <mesh key={i} geometry={geometry} material={material} renderOrder={20} raycast={() => null} userData={{ uiOnly: true }} />
      ))}
    </>
  )
}
