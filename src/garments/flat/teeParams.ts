/**
 * 2D silhouette of a T-shirt, in metres, front view, right half (x >= 0 is the
 * wearer's left), hem on y = 0. Used only for the flat sketches (product
 * thumbnails, Review flats, no-WebGL fallback) — the 3D view uses the GLB.
 */
export interface TeeParams {
  /** High point of shoulder (where shoulder seam meets the neckline). */
  hpsX: number
  hpsY: number
  neckDipFront: number
  neckDipBack: number
  /** Shoulder point (end of shoulder seam). */
  shoulderX: number
  shoulderY: number
  chestHalf: number
  armpitY: number
  waistHalf: number
  waistY: number
  hemHalf: number
  sleeve: {
    style: 'setIn' | 'raglan'
    /** Angle of the sleeve below horizontal, degrees. */
    angleDeg: number
    /** Length along the top edge, from the shoulder point. */
    length: number
    /** Width of the sleeve opening (front view). */
    cuffWidth: number
    /** Raglan seam end on the neckline, as a fraction of hpsX. */
    raglanNeckT?: number
  }
}

/**
 * Silhouette matched to public/models/honeg-raglan-tee.glb after normalisation
 * (measured: torso half-width 17–19 cm, front neck 0.644 m, back neck 0.70 m,
 * sleeve hem ≈ 0.39 m).
 */
export const RAGLAN_TEE_FLAT: TeeParams = {
  hpsX: 0.09,
  hpsY: 0.705,
  neckDipFront: 0.061,
  neckDipBack: 0.008,
  shoulderX: 0.205,
  shoulderY: 0.645,
  chestHalf: 0.19,
  armpitY: 0.5,
  waistHalf: 0.172,
  waistY: 0.42,
  hemHalf: 0.183,
  sleeve: { style: 'raglan', angleDeg: 60, length: 0.22, cuffWidth: 0.125, raglanNeckT: 0.55 },
}
