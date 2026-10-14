import { Suspense, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { CanvasTexture, type BufferGeometry, type MeshPhysicalMaterial } from 'three'
import type { GarmentDefinition, GarmentModelData } from '../../garments/types'
import { useDesignStore } from '../../state/designStore'
import { resolvedColor, type PatternFill } from '../../state/design'
import { useUiStore } from '../../state/uiStore'
import { applyFabricColor, createFabricMaterial, disposeFabricMaterial } from './fabric'
import { buildProjectedDecal } from './decal'
import { useGltfModel } from './garmentModel'
import { LogoLayers } from './LogoLayer'
import { useActiveLogo } from '../../state/useActiveLogo'
import { BrandMark } from './BrandMark'
import { placePattern, usePatternTextures, type PatternSources } from './usePatternTextures'
import { applyZoneMask } from './zoneMask'
import { ZoneThumbnails } from './ZoneThumbnails'
import { isPaintZone, REGION_IDS, type ZoneId } from '../../garments/zones'
import { CameraRig } from './CameraRig'

/** Picks the right loader for the garment's source; both feed the same renderer. */
export function Garment({ def }: { def: GarmentDefinition }) {
  return (
    <Suspense fallback={<LoadingReporter />}>
      <GltfGarment def={def} />
    </Suspense>
  )
}

function LoadingReporter() {
  useEffect(() => useUiStore.getState().setViewerStatus('loading'), [])
  return null
}

function GltfGarment({ def }: { def: GarmentDefinition }) {
  const data = useGltfModel(def.source)
  return <GarmentStage def={def} data={data} />
}

function GarmentStage({ def, data }: { def: GarmentDefinition; data: GarmentModelData }) {
  useEffect(() => {
    useUiStore.setState({ viewerStatus: 'ready', viewerError: null, modelRegions: [...new Set(data.parts.map((p) => p.region))] })
  }, [data])
  const targets = useMemo(() => data.parts.filter((p) => p.logoTarget).map((p) => p.geometry), [data])
  return (
    <>
      <CameraRig bounds={data.bounds} />
      <GarmentMeshes def={def} data={data} uvScale={def.source.uvScale ?? 1} />
      <ZoneThumbnails def={def} data={data} />
      <BrandMark def={def} targets={targets} />
      <LogoLayers def={def} targets={targets} />
      <PrintAreaOverlay def={def} targets={targets} />
      <ContactShadows
        key={def.id}
        position={[0, data.bounds.min[1] - 0.085, 0]}
        scale={1.9}
        blur={3.2}
        far={0.9}
        opacity={0.28}
        resolution={512}
        frames={1}
        color="#26221c"
      />
    </>
  )
}

type MaterialKey = `${ZoneId}:${'jersey' | 'rib'}`

/** Shows a zone's colour, or its pattern tile (which already contains the colour under the ink). */
function paintMaterial(m: MeshPhysicalMaterial, color: string, fill: PatternFill | null, texture: CanvasTexture | undefined, uvScale: number) {
  applyFabricColor(m, color)
  if (fill && texture) {
    placePattern(texture, fill, uvScale)
    m.color.set('#ffffff')
    if (m.map !== texture) {
      m.map = texture
      m.needsUpdate = true
    }
  } else if (m.map) {
    m.map = null
    m.needsUpdate = true
  }
}

/**
 * The garment parts in their colours and patterns, then each painted zone
 * (halves, panels, stripes) drawn over the parts it covers, in print order.
 */
function GarmentMeshes({ def, data, uvScale }: { def: GarmentDefinition; data: GarmentModelData; uvScale: number }) {
  const colors = useDesignStore((s) => s.design.colors)
  const patterns = useDesignStore((s) => s.design.patterns)
  const zones = useDesignStore((s) => s.design.zones)
  const invalidate = useThree((s) => s.invalidate)

  const sources = useMemo(() => {
    const out: PatternSources = {}
    for (const r of REGION_IDS) {
      const fill = patterns[r]
      if (fill) out[r] = { fill, bg: resolvedColor(colors, r) }
    }
    for (const z of def.paintZones) {
      const paint = zones[z.id]
      if (paint?.pattern) out[z.id] = { fill: paint.pattern, bg: paint.color }
    }
    return out
  }, [colors, patterns, zones, def])
  const patternTextures = usePatternTextures(sources)

  const finishes = useMemo(() => [...new Set(data.parts.map((p) => p.finish))], [data])
  const materials = useMemo(() => {
    const map = new Map<MaterialKey, MeshPhysicalMaterial>()
    for (const p of data.parts) {
      const key: MaterialKey = `${p.region}:${p.finish}`
      if (!map.has(key)) map.set(key, createFabricMaterial(p.finish, uvScale))
    }
    for (const z of def.paintZones) for (const finish of finishes) map.set(`${z.id}:${finish}`, applyZoneMask(createFabricMaterial(finish, uvScale), z))
    return map
  }, [data, def, finishes, uvScale])

  useEffect(() => () => materials.forEach(disposeFabricMaterial), [materials])

  useEffect(() => {
    materials.forEach((m, key) => {
      const zone = key.split(':')[0] as ZoneId
      if (isPaintZone(zone)) {
        const paint = zones[zone]
        if (paint) paintMaterial(m, paint.color, paint.pattern, patternTextures[zone], uvScale)
      } else paintMaterial(m, resolvedColor(colors, zone), patterns[zone], patternTextures[zone], uvScale)
    })
    invalidate()
  }, [colors, patterns, zones, patternTextures, materials, uvScale, invalidate])

  return (
    <group>
      {data.parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={materials.get(`${p.region}:${p.finish}`)} />
      ))}
      {def.paintZones.map((z, order) =>
        zones[z.id]
          ? data.parts.map((p, i) =>
              z.parts.includes(p.region) ? (
                <mesh key={`${z.id}-${i}`} geometry={p.geometry} material={materials.get(`${z.id}:${p.finish}`)} renderOrder={1 + order} />
              ) : null,
            )
          : null,
      )}
    </group>
  )
}

/** Corner marks + faint dashed frame showing the printable zone while the Logo step is open. */
function printAreaTexture(aspect: number) {
  const w = 512
  const h = Math.max(64, Math.round(w / aspect))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(242,169,0,0.025)'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(242,169,0,0.7)'
  ctx.lineWidth = 3
  ctx.setLineDash([12, 10])
  ctx.strokeRect(4, 4, w - 8, h - 8)
  ctx.setLineDash([])
  ctx.lineWidth = 6
  const m = 40
  for (const [x, y, dx, dy] of [[3, 3, 1, 1], [w - 3, 3, -1, 1], [3, h - 3, 1, -1], [w - 3, h - 3, -1, -1]]) {
    ctx.beginPath()
    ctx.moveTo(x, y + dy * m)
    ctx.lineTo(x, y)
    ctx.lineTo(x + dx * m, y)
    ctx.stroke()
  }
  const t = new CanvasTexture(canvas)
  t.anisotropy = 4
  return t
}

function PrintAreaOverlay({ def, targets }: { def: GarmentDefinition; targets: BufferGeometry[] }) {
  const visible = useUiStore((s) => s.step === 'logo' || s.logoSelected)
  // The frame follows the logo being edited.
  const side = useActiveLogo()?.placement.side ?? 'front'
  const area = def.printAreas[side]
  const width = area.xMax - area.xMin
  const height = area.yMax - area.yMin

  const geometry = useMemo(
    () =>
      visible
        ? buildProjectedDecal(targets, {
            side,
            center: [(area.xMin + area.xMax) / 2, (area.yMin + area.yMax) / 2],
            width,
            height,
            rotationDeg: 0,
          })
        : null,
    [visible, targets, side, area, width, height],
  )
  useEffect(() => () => geometry?.dispose(), [geometry])
  const texture = useMemo(() => printAreaTexture(width / height), [width, height])
  useEffect(() => () => texture.dispose(), [texture])

  if (!geometry) return null
  return (
    <mesh geometry={geometry} renderOrder={1} userData={{ uiOnly: true }}>
      <meshBasicMaterial map={texture} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} toneMapped={false} />
    </mesh>
  )
}
