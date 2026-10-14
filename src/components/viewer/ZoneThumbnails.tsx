import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { AmbientLight, Color, DirectionalLight, DoubleSide, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, Vector2, Vector3, type WebGLRenderer } from 'three'
import type { GarmentDefinition, GarmentModelData } from '../../garments/types'
import { isPaintZone, REGION_IDS, ZONE_INFO, type ZoneId } from '../../garments/zones'
import { useUiStore } from '../../state/uiStore'
import { applyZoneMask } from './zoneMask'

/** Rendered size, px (shown at about half that, so they stay sharp on high-DPI screens). */
const SIZE = 168
const BASE = '#D9D6CF'
const HIGHLIGHT = '#F2A900'
const FOV = 24
const POLAR = 1.45

/**
 * Renders the real garment once per model with each zone highlighted, for the
 * zone pickers in the Colors and Pattern steps. Uses its own small scene and
 * lights, so the design's colours never leak into the thumbnails.
 */
export function ZoneThumbnails({ def, data }: { def: GarmentDefinition; data: GarmentModelData }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    // After the main view has painted once, so the model is on screen first.
    const frame = requestAnimationFrame(() => {
      const thumbs = renderZoneThumbs(gl, def, data)
      gl.render(scene, camera) // leave the main view on the canvas
      useUiStore.setState({ zoneThumbs: thumbs })
      invalidate()
    })
    return () => cancelAnimationFrame(frame)
  }, [gl, def, data, scene, camera, invalidate])

  return null
}

function renderZoneThumbs(gl: WebGLRenderer, def: GarmentDefinition, data: GarmentModelData): Partial<Record<ZoneId, string>> {
  const thumbScene = new Scene()
  thumbScene.add(new AmbientLight('#ffffff', 1.1))
  const key = new DirectionalLight('#ffffff', 2.6)
  key.position.set(0.7, 1.3, 1.8)
  const rim = new DirectionalLight('#ffffff', 1.1)
  rim.position.set(-1, 0.5, -1.4)
  thumbScene.add(key, rim)

  const material = (color: string) => new MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, side: DoubleSide })
  const base = material(BASE)
  const highlight = material(HIGHLIGHT)
  const disposables = [base, highlight]

  const { min, max } = data.bounds
  const center = new Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2)
  const half = (Math.max(max[0] - min[0], max[1] - min[1]) / 2) * 1.06
  const distance = half / Math.tan((FOV * Math.PI) / 360) + (max[2] - min[2]) / 2
  const cam = new PerspectiveCamera(FOV, 1, 0.01, 10)

  const prevSize = gl.getSize(new Vector2())
  const prevRatio = gl.getPixelRatio()
  const prevClear = gl.getClearColor(new Color())
  const prevAlpha = gl.getClearAlpha()
  const out: Partial<Record<ZoneId, string>> = {}
  const regions = new Set(data.parts.map((p) => p.region))
  const zones: ZoneId[] = [...REGION_IDS.filter((r) => regions.has(r)), ...def.paintZones.map((z) => z.id)]

  try {
    gl.setPixelRatio(1)
    gl.setSize(SIZE, SIZE, false)
    gl.setClearColor(0x000000, 0)
    for (const zone of zones) {
      const meshes = data.parts.map((p) => new Mesh(p.geometry, !isPaintZone(zone) && p.region === zone ? highlight : base))
      if (isPaintZone(zone)) {
        const zoneDef = def.paintZones.find((z) => z.id === zone)!
        const masked = applyZoneMask(material(HIGHLIGHT), zoneDef)
        disposables.push(masked)
        for (const p of data.parts) {
          if (!zoneDef.parts.includes(p.region)) continue
          const m = new Mesh(p.geometry, masked)
          m.renderOrder = 1
          meshes.push(m)
        }
      }
      thumbScene.add(...meshes)
      const azimuth = ZONE_INFO[zone].view === 'back' ? Math.PI : 0
      cam.position.set(
        center.x + distance * Math.sin(POLAR) * Math.sin(azimuth),
        center.y + distance * Math.cos(POLAR),
        center.z + distance * Math.sin(POLAR) * Math.cos(azimuth),
      )
      cam.lookAt(center)
      gl.render(thumbScene, cam)
      out[zone] = gl.domElement.toDataURL('image/png')
      thumbScene.remove(...meshes)
    }
  } finally {
    gl.setPixelRatio(prevRatio)
    gl.setSize(prevSize.x, prevSize.y, false)
    gl.setClearColor(prevClear, prevAlpha)
    disposables.forEach((m) => m.dispose())
  }
  return out
}
