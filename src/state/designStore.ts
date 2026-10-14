import { create } from 'zustand'
import type { PlacementId, RegionId, Side } from '../garments/types'
import { getGarment } from '../garments/catalog'
import { clampTransform, type LogoTransform } from '../lib/logoTransform'
import { cleanPatternFill, createDefaultDesign, DEFAULT_PLACEMENT, logoAspect, type Design, type LogoAsset, type LogoPlacement, type PatternFill } from './design'

type LogoEdit = LogoTransform & Pick<LogoPlacement, 'flipX' | 'flipY' | 'opacity' | 'tint' | 'locked'>

const HISTORY_LIMIT = 60
const COALESCE_MS = 900

interface CommitOptions {
  /** Consecutive commits with the same key (e.g. a slider drag) merge into one undo step. */
  coalesce?: string
}

interface DesignStore {
  design: Design
  past: Design[]
  future: Design[]
  lastCommit: { key: string; at: number } | null

  setProduct: (id: string) => void
  setColor: (region: RegionId, hex: string | null, opts?: CommitOptions) => void
  resetColors: () => void
  /** Sets or clears the all-over pattern on one zone. */
  setPattern: (region: RegionId, fill: PatternFill | null, opts?: CommitOptions) => void
  updatePattern: (region: RegionId, patch: Partial<PatternFill>, opts?: CommitOptions) => void
  /** Copies one zone's pattern to the given zones. */
  copyPattern: (from: RegionId, to: RegionId[]) => void
  setLogo: (asset: LogoAsset | null) => void
  setSide: (side: Side) => void
  setPlacement: (id: PlacementId) => void
  /** Geometry (clamped to the print area) and appearance edits for the logo. */
  updateTransform: (patch: Partial<LogoEdit>, opts?: CommitOptions) => void
  resetTransform: () => void
  replaceDesign: (design: Design) => void
  resetAll: () => void
  undo: () => void
  redo: () => void
}

const shallowEqual = <T extends object>(a: T, b: T) =>
  (Object.keys(a) as (keyof T)[]).every((k) => a[k] === b[k])

export function sameDesign(a: Design, b: Design) {
  return (
    a.productId === b.productId &&
    a.logo === b.logo &&
    shallowEqual(a.colors, b.colors) &&
    shallowEqual(a.placement, b.placement) &&
    (Object.keys(a.patterns) as RegionId[]).every((r) => a.patterns[r] === b.patterns[r] || (!!a.patterns[r] && !!b.patterns[r] && shallowEqual(a.patterns[r]!, b.patterns[r]!)))
  )
}

/** Re-applies print-area constraints for the design's current garment and logo. */
export function normalizePlacement(design: Design, placement: LogoPlacement): LogoPlacement {
  const garment = getGarment(design.productId)
  const preset = garment.placements.find((p) => p.id === placement.placement) ?? garment.placements[0]
  const area = garment.printAreas[preset.side]
  const clamped = clampTransform(placement, logoAspect(design), area, preset.anchor)
  return { ...placement, side: preset.side, placement: preset.id, ...clamped }
}

/** Geometry defaults for a preset; appearance (opacity, tint, lock) carries over. */
function presetDefaults(design: Design, id: PlacementId): LogoPlacement {
  const garment = getGarment(design.productId)
  const preset = garment.placements.find((p) => p.id === id) ?? garment.placements[0]
  return normalizePlacement(design, {
    ...design.placement,
    flipX: false,
    flipY: false,
    side: preset.side,
    placement: preset.id,
    widthCm: Math.round(preset.defaultWidth * 1000) / 10,
    rotationDeg: 0,
    offsetXCm: 0,
    offsetYCm: 0,
  })
}

export const useDesignStore = create<DesignStore>()((set, get) => {
  const commit = (next: Design, opts?: CommitOptions) => {
    const { design, past, lastCommit } = get()
    if (sameDesign(design, next)) return
    const now = Date.now()
    const merge = !!opts?.coalesce && lastCommit?.key === opts.coalesce && now - lastCommit.at < COALESCE_MS
    set({
      design: next,
      past: merge ? past : [...past, design].slice(-HISTORY_LIMIT),
      future: [],
      lastCommit: opts?.coalesce ? { key: opts.coalesce, at: now } : null,
    })
  }

  return {
    design: createDefaultDesign(),
    past: [],
    future: [],
    lastCommit: null,

    setProduct: (id) => {
      const { design } = get()
      if (design.productId === id) return
      const next = { ...design, productId: id }
      next.placement = normalizePlacement(next, design.placement)
      commit(next)
    },

    setColor: (region, hex, opts) => {
      const { design } = get()
      if (region === 'body' && !hex) return
      commit({ ...design, colors: { ...design.colors, [region]: hex } }, opts)
    },

    setPattern: (region, fill, opts) => {
      const { design } = get()
      commit({ ...design, patterns: { ...design.patterns, [region]: fill ? cleanPatternFill(fill) : null } }, opts)
    },

    updatePattern: (region, patch, opts) => {
      const { design } = get()
      const current = design.patterns[region]
      if (!current) return
      commit({ ...design, patterns: { ...design.patterns, [region]: cleanPatternFill({ ...current, ...patch }) } }, opts)
    },

    copyPattern: (from, to) => {
      const { design } = get()
      const fill = design.patterns[from]
      const patterns = { ...design.patterns }
      for (const r of to) patterns[r] = fill ? { ...fill } : null
      commit({ ...design, patterns })
    },

    resetColors: () => {
      const { design } = get()
      commit({ ...design, colors: createDefaultDesign().colors })
    },

    setLogo: (asset) => {
      const { design } = get()
      const next = { ...design, logo: asset }
      // A new logo starts at the preset's recommended size; aspect changes the clamp.
      next.placement = asset && !design.logo ? presetDefaults(next, design.placement.placement) : normalizePlacement(next, design.placement)
      commit(next)
    },

    setSide: (side) => {
      const { design } = get()
      if (design.placement.side === side) return
      const first = getGarment(design.productId).placements.find((p) => p.side === side)
      if (!first) return
      commit({ ...design, placement: presetDefaults(design, first.id) })
    },

    setPlacement: (id) => {
      const { design } = get()
      if (design.placement.placement === id) return
      const { rotationDeg, flipX, flipY } = design.placement
      commit({ ...design, placement: normalizePlacement(design, { ...presetDefaults(design, id), rotationDeg, flipX, flipY }) })
    },

    updateTransform: (patch, opts) => {
      const { design } = get()
      const placement = normalizePlacement(design, { ...design.placement, ...patch })
      commit({ ...design, placement }, opts)
    },

    resetTransform: () => {
      const { design } = get()
      commit({ ...design, placement: presetDefaults(design, design.placement.placement) })
    },

    replaceDesign: (incoming) => {
      const next = { ...incoming, placement: normalizePlacement(incoming, incoming.placement) }
      commit(next)
    },

    resetAll: () => {
      const fresh = createDefaultDesign()
      fresh.placement = normalizePlacement(fresh, DEFAULT_PLACEMENT)
      commit(fresh)
    },

    undo: () => {
      const { past, design, future } = get()
      if (!past.length) return
      set({ design: past[past.length - 1], past: past.slice(0, -1), future: [design, ...future], lastCommit: null })
    },

    redo: () => {
      const { past, design, future } = get()
      if (!future.length) return
      set({ design: future[0], past: [...past, design], future: future.slice(1), lastCommit: null })
    },
  }
})
