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
const RAGLAN_TEE: GarmentDefinition = {
  id: 'raglan',
  name: 'Raglan Sport Tee',
  tagline: 'Regular fit · raglan sleeve',
  tags: ['Regular fit', 'Raglan sleeve', 'Crew neck'],
  regions: ['body', 'sleeves', 'collar'],
  source: {
    kind: 'gltf',
    url: '/models/honeg-raglan-tee.glb',
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
    { id: 'leftChest', side: 'front', label: 'Left chest', hint: "Small crest over the wearer's heart", anchor: [0.082, 0.525], defaultWidth: 0.08 },
    { id: 'centerChest', side: 'front', label: 'Center chest', hint: 'Large statement print', anchor: [0, 0.445], defaultWidth: 0.22 },
    { id: 'rightChest', side: 'front', label: 'Right chest', hint: "Small crest on the wearer's right", anchor: [-0.082, 0.525], defaultWidth: 0.08 },
    { id: 'upperBack', side: 'back', label: 'Upper back', hint: 'Below the collar — club or team name', anchor: [0, 0.61], defaultWidth: 0.2 },
    { id: 'centerBack', side: 'back', label: 'Center back', hint: 'Large back print', anchor: [0, 0.42], defaultWidth: 0.25 },
  ],
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
