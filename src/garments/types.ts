import type { PaintZoneDef } from './zones'
import type { BufferGeometry } from 'three'
import type { V2 } from './flat/geom2d'

/**
 * Garment contracts. The renderer only knows about these types; everything that
 * depends on a specific model (mesh names, UV layout, proportions) lives in a
 * GarmentDefinition. Adding a garment = adding a definition, not touching the viewer.
 */

export type RegionId = 'body' | 'sleeves' | 'collar'
export type Side = 'front' | 'back'
export type PlacementId = 'leftChest' | 'centerChest' | 'rightChest' | 'upperBack' | 'centerBack'

/** Garment space: metres, +Y up, the garment faces +Z, +X is the wearer's left. */
export interface PrintArea {
  /** Bounds in *view space* for that side (x grows to the viewer's right). */
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export interface PlacementPreset {
  id: PlacementId
  side: Side
  label: string
  hint: string
  /** Anchor centre in view space for `side`, metres. */
  anchor: V2
  /** Default logo width, metres. */
  defaultWidth: number
}

export interface GarmentPart {
  region: RegionId
  geometry: BufferGeometry
  /** Logo decals are projected onto parts flagged as targets. */
  logoTarget: boolean
  /** Which fabric finish to use (rib knit for bands, jersey for panels). */
  finish: 'jersey' | 'rib'
}

export interface GarmentModelData {
  parts: GarmentPart[]
  /** Axis-aligned bounds in garment space. */
  bounds: { min: [number, number, number]; max: [number, number, number] }
}

/** One side of a flat sketch, in garment-space metres. */
export interface FlatSide {
  body: V2[]
  /** Sleeve polygons, for region colouring in 2D. */
  sleeves: V2[][]
  neckline: V2[]
}

/** 2D outline used for product thumbnails and the no-WebGL flat preview. */
export interface FlatOutline {
  front: FlatSide
  back: FlatSide
}

/** A garment model file (glTF 2.0 / GLB) plus the mapping the viewer needs to use it. */
export interface GarmentSource {
      kind: 'gltf'
      url: string
      /**
       * Region mapping by mesh *or* material name. Required because GLB files
       * do not share naming conventions. Unmatched meshes fall back to `body`.
       */
      regionMatchers: Partial<Record<RegionId, RegExp>>
      logoTargets: RegionId[]
      /** Meshes to drop (mannequin, hanger, ground plane…), matched by mesh or material name. */
      ignore?: RegExp
      /** Extra rotation about Y (radians) when the model doesn't face +Z. */
      rotationY?: number
      /**
       * The model is auto-centred (hem on y = 0) and uniformly scaled so its
       * height equals this many metres, so print areas apply. Default 0.72.
       */
      targetHeight?: number
      /** Metres of fabric per UV unit, so the knit normal map has a realistic scale. Default 1. */
      uvScale?: number
}

export interface GarmentDefinition {
  id: string
  name: string
  tagline: string
  tags: string[]
  /** Regions that can be coloured independently on this model. */
  regions: RegionId[]
  source: GarmentSource
  printAreas: Record<Side, PrintArea>
  placements: PlacementPreset[]
  /**
   * Where the HONEG brand mark sits on the front: |x| from the centre line
   * (mirrored for the chosen chest), centre height y, and printed width.
   */
  brandMark: { x: number; y: number; widthCm: number }
  /** Halves, panels and stripes that can be painted over the parts, in print order (later on top). */
  paintZones: PaintZoneDef[]
  flat: FlatOutline
}
