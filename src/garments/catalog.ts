import type { PaintZoneDef, ZonePlane } from './zones'
import type { GarmentDefinition, RegionId } from './types'
import { RAGLAN_TEE_FLAT } from './flat/teeParams'
import { buildTeeFlat } from './flat/flat'

/**
 * Product catalogue. Each entry fully describes a garment: model file, region
 * mapping, printable areas and logo placement presets (garment space: metres,
 * hem on y = 0, +X = wearer's left; anchors are in each side's view space).
 *
 * To add a garment: prepare its GLB with `npm run prepare:model`, measure it
 * (see README), and add an entry here — the viewer itself needs no changes.
 */

/** Name-based region defaults for glTF models; override per model with `regionMatchers`. */
export const DEFAULT_REGION_MATCHERS: Partial<Record<RegionId, RegExp>> = {
  collar: /collar|neck|rib/i,
  sleeves: /sleeve|arm|cuff/i,
  body: /body|torso|front|back|main|shirt|tee/i,
}

/**
 * Sporty raglan tee — source: "men-regular-apparel-fit-sporty-t-shirt" (Substance
 * Painter export), split into body / sleeves / collar and stripped of its baked
 * textures by scripts/prepare-model.mjs.
 *
 * Measured after normalisation (height 0.72 m): torso half-width 17–19 cm,
 * front neckline 0.644 m, back neckline 0.70 m, chest surface z ≈ +0.10 m.
 */
/**
 * The torso leans back towards the shoulders, so front and back are split by
 * a plane that follows the side seam (z ≈ 0 at the hem, −0.035 m at the
 * shoulders) rather than by z = 0.
 */
const SIDE_SEAM: ZonePlane = [0, 0.071, 1, 0.0103]
const FRONT_ONLY: ZonePlane = SIDE_SEAM
const BACK_ONLY: ZonePlane = [0, -0.071, -1, -0.0103]
/** Waist line for the top/bottom split, and the sash: wearer's right shoulder to left hip, 9 cm wide. */
const WAIST = 0.36
const SASH: ZonePlane[] = [
  [0.846, 0.533, 0, 0.131],
  [-0.846, -0.533, 0, -0.221],
]

/** Print order: big areas first, details last (so a stripe shows over a half). */
const RAGLAN_ZONES: PaintZoneDef[] = [
  { id: 'front', parts: ['body'], planes: [FRONT_ONLY] },
  { id: 'back', parts: ['body'], planes: [BACK_ONLY] },
  { id: 'halfLeft', parts: ['body', 'sleeves'], planes: [[1, 0, 0, 0]] },
  { id: 'halfRight', parts: ['body', 'sleeves'], planes: [[-1, 0, 0, 0]] },
  { id: 'halfTop', parts: ['body', 'sleeves'], planes: [[0, 1, 0, WAIST]] },
  { id: 'halfBottom', parts: ['body', 'sleeves'], planes: [[0, -1, 0, -WAIST]] },
  { id: 'sleeveLeft', parts: ['sleeves'], planes: [[1, 0, 0, 0]] },
  { id: 'sleeveRight', parts: ['sleeves'], planes: [[-1, 0, 0, 0]] },
  // Torso half-width is 17–20 cm: panels from 13 cm out read as side stripes from the front.
  { id: 'sidePanels', parts: ['body'], planes: [[1, 0, 0, 0.13]], absX: true },
  { id: 'yoke', parts: ['body', 'sleeves'], planes: [[0, 1, 0, 0.56]] },
  { id: 'sash', parts: ['body'], planes: [FRONT_ONLY, ...SASH] },
  { id: 'chestBand', parts: ['body', 'sleeves'], planes: [[0, 1, 0, 0.4], [0, -1, 0, -0.47]] },
  { id: 'centerStripe', parts: ['body'], planes: [[-1, 0, 0, -0.04]], absX: true },
  { id: 'hemBand', parts: ['body'], planes: [[0, -1, 0, -0.06]] },
]

const RAGLAN_TEE: GarmentDefinition = {
  id: 'raglan',
  regions: ['body', 'sleeves', 'collar'],
  source: {
    kind: 'gltf',
    url: '/models/raglan-tee.glb',
    regionMatchers: { body: /^body$/i, sleeves: /^sleeves$/i, collar: /^collar$/i },
    logoTargets: ['body'],
    targetHeight: 0.72,
    // prepare-model.mjs rewrites UVs to 1 unit = 1 m of fabric, upright per panel.
    uvScale: 1,
  },
  printAreas: {
    front: { xMin: -0.135, xMax: 0.135, yMin: 0.07, yMax: 0.61 },
    back: { xMin: -0.135, xMax: 0.135, yMin: 0.07, yMax: 0.655 },
  },
  placements: [
    { id: 'leftChest', side: 'front', anchor: [0.082, 0.525], defaultWidth: 0.08 },
    { id: 'centerChest', side: 'front', anchor: [0, 0.445], defaultWidth: 0.22 },
    { id: 'rightChest', side: 'front', anchor: [-0.082, 0.525], defaultWidth: 0.08 },
    { id: 'upperBack', side: 'back', anchor: [0, 0.61], defaultWidth: 0.2 },
    { id: 'centerBack', side: 'back', anchor: [0, 0.42], defaultWidth: 0.25 },
  ],
  // Same chest height as the left/right chest presets, slightly smaller than a club crest.
  brandMark: { x: 0.085, y: 0.53, widthCm: 6 },
  paintZones: RAGLAN_ZONES,
  flat: buildTeeFlat(RAGLAN_TEE_FLAT),
}

export const GARMENTS: GarmentDefinition[] = [RAGLAN_TEE]

export const DEFAULT_GARMENT_ID = GARMENTS[0].id

/**
 * Dev aid: `/?glb=/models/your-file.glb` previews any same-origin glTF in place
 * of the selected product, using the default region matchers.
 */
const glbOverride = (() => {
  if (typeof window === 'undefined') return null
  const url = new URLSearchParams(window.location.search).get('glb')
  return url && /^\/(?!\/)[\w\-./]+\.(glb|gltf)$/i.test(url) ? url : null
})()

export function getGarment(id: string): GarmentDefinition {
  const def = GARMENTS.find((g) => g.id === id) ?? GARMENTS[0]
  if (!glbOverride) return def
  return { ...def, source: { kind: 'gltf', url: glbOverride, regionMatchers: DEFAULT_REGION_MATCHERS, logoTargets: ['body'] } }
}
