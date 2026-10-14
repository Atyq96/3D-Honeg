import { Suspense, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { CanvasTexture, type BufferGeometry, type MeshPhysicalMaterial } from 'three'
import type { GarmentDefinition, GarmentModelData, RegionId } from '../../garments/types'
import { useDesignStore } from '../../state/designStore'
import { resolvedColor } from '../../state/design'
import { useUiStore } from '../../state/uiStore'
import { applyFabricColor, createFabricMaterial, disposeFabricMaterial } from './fabric'
import { buildProjectedDecal } from './decal'
import { useGltfModel } from './garmentModel'
import { LogoLayer } from './LogoLayer'
import { BrandMark } from './BrandMark'
import { placePattern, usePatternTextures } from './usePatternTextures'
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
      <GarmentMeshes data={data} uvScale={def.source.uvScale ?? 1} />
      <BrandMark def={def} targets={targets} />
      <LogoLayer def={def} targets={targets} />
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

type MaterialKey = `${RegionId}:${'jersey' | 'rib'}`

function GarmentMeshes({ data, uvScale }: { data: GarmentModelData; uvScale: number }) {
  const colors = useDesignStore((s) => s.design.colors)
  const patterns = useDesignStore((s) => s.design.patterns)
  const invalidate = useThree((s) => s.invalidate)
  const patternTextures = usePatternTextures(patterns, colors)

  const materials = useMemo(() => {
    const map = new Map<MaterialKey, MeshPhysicalMaterial>()
    for (const p of data.parts) {
      const key: MaterialKey = `${p.region}:${p.finish}`
      if (!map.has(key)) map.set(key, createFabricMaterial(p.finish, uvScale))
    }
    return map
  }, [data, uvScale])

  useEffect(() => () => materials.forEach(disposeFabricMaterial), [materials])

  useEffect(() => {
    materials.forEach((m, key) => {
      const region = key.split(':')[0] as RegionId
      applyFabricColor(m, resolvedColor(colors, region))
      const fill = patterns[region]
      const texture = patternTextures[region]
      if (fill && texture) {
        // The tile already contains the fabric colour under the ink.
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
    })
    invalidate()
  }, [colors, patterns, patternTextures, materials, uvScale, invalidate])

  return (
    <group>
      {data.parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={materials.get(`${p.region}:${p.finish}`)} />
      ))}
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
  const side = useDesignStore((s) => s.design.placement.side)
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
