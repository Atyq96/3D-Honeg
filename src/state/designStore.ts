import { create } from 'zustand'
import type { PlacementId, PlacementPreset, PrintArea, RegionId, Side } from '../garments/types'
import { getGarment } from '../garments/catalog'
import { clampTransform, rotatedExtents, type LogoTransform } from '../lib/logoTransform'
import {
  cleanPatternFill,
  createDefaultDesign,
  DEFAULT_PLACEMENT,
  logoAspect,
  layerKind,
  MAX_LOGOS,
  MAX_TEXTS,
  newLogoId,
  type BrandMarkSettings,
  type Design,
  type LogoAsset,
  type LogoLayer,
  type LogoPlacement,
  type PatternFill,
  type TextSpec,
} from './design'
import { brandKeepOut } from '../garments/brand'
import { isPaintZone, type PaintZoneId, type ZoneId } from '../garments/zones'
import type { ChestSide } from '../config/brand'

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
  /**
   * Part colour (null on sleeves/collar = match body), or a paint zone's colour
   * (null removes the zone, pattern included).
   */
  setColor: (zone: ZoneId, hex: string | null, opts?: CommitOptions) => void
  /** Back to the default body colour, with sleeves and collar matching and no paint zones. */
  resetColors: () => void
  /** Sets or clears the all-over pattern on a part or paint zone (painting an unpainted zone in the body colour). */
  setPattern: (zone: ZoneId, fill: PatternFill | null, opts?: CommitOptions) => void
  updatePattern: (zone: ZoneId, patch: Partial<PatternFill>, opts?: CommitOptions) => void
  /** Copies one zone's pattern to the given zones. */
  copyPattern: (from: RegionId, to: RegionId[]) => void
  /** Brand mark: position, style, colour (it can't be removed). */
  setBrand: (patch: Partial<BrandMarkSettings>) => void
  /** Adds a logo or photo on a free print position. Returns its id, or null when the garment is full. */
  addLogo: (asset: LogoAsset) => string | null
  /** Adds a text block (rendered to `asset`) in the given colour. Returns its id, or null when the garment is full. */
  addText: (text: TextSpec, asset: LogoAsset, color: string) => string | null
  /** New wording, font or alignment for a text layer; keeps its position and chosen letter height. */
  setText: (id: string, text: TextSpec, asset: LogoAsset, opts?: CommitOptions) => void
  /** Swaps a logo's image, keeping its position and look. */
  replaceLogo: (id: string, asset: LogoAsset) => void
  removeLogo: (id: string) => void
  /** Moves a logo one step up (+1, printed over the others) or down (-1) the stack. */
  moveLogo: (id: string, dir: 1 | -1) => void
  setSide: (id: string, side: Side) => void
  setPlacement: (id: string, placement: PlacementId) => void
  /** Geometry (clamped to the print area) and appearance edits for one logo. */
  updateTransform: (id: string, patch: Partial<LogoEdit>, opts?: CommitOptions) => void
  resetTransform: (id: string) => void
  replaceDesign: (design: Design) => void
  resetAll: () => void
  undo: () => void
  redo: () => void
}

const shallowEqual = <T extends object>(a: T, b: T) =>
  (Object.keys(a) as (keyof T)[]).every((k) => a[k] === b[k])

const sameLayer = (a: LogoLayer, b: LogoLayer) =>
  a.id === b.id &&
  a.asset === b.asset &&
  shallowEqual(a.placement, b.placement) &&
  (a.text === b.text || (!!a.text && !!b.text && shallowEqual(a.text, b.text)))

const samePattern = (a: PatternFill | null, b: PatternFill | null) => a === b || (!!a && !!b && shallowEqual(a, b))

const sameZones = (a: Design['zones'], b: Design['zones']) => {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<PaintZoneId>
  return [...ids].every((id) => {
    const x = a[id]
    const y = b[id]
    return x === y || (!!x && !!y && x.color === y.color && samePattern(x.pattern, y.pattern))
  })
}

export function sameDesign(a: Design, b: Design) {
  return (
    sameZones(a.zones, b.zones) &&
    a.productId === b.productId &&
    a.logos.length === b.logos.length &&
    a.logos.every((l, i) => sameLayer(l, b.logos[i])) &&
    shallowEqual(a.colors, b.colors) &&
    shallowEqual(a.brand, b.brand) &&
    (Object.keys(a.patterns) as RegionId[]).every((r) => a.patterns[r] === b.patterns[r] || (!!a.patterns[r] && !!b.patterns[r] && shallowEqual(a.patterns[r]!, b.patterns[r]!)))
  )
}

/** Re-applies print-area constraints for the design's current garment. */
export function normalizePlacement(design: Design, placement: LogoPlacement, aspect: number): LogoPlacement {
  const garment = getGarment(design.productId)
  const preset = garment.placements.find((p) => p.id === placement.placement) ?? garment.placements[0]
  const area = garment.printAreas[preset.side]
  // Front prints always leave the brand mark and its clear space untouched.
  const keepOut = preset.side === 'front' ? brandKeepOut(garment, design.brand) : undefined
  const clamped = clampTransform(placement, aspect, area, preset.anchor, keepOut)
  return { ...placement, side: preset.side, placement: preset.id, ...clamped }
}

const round1 = (v: number) => Math.round(v * 10) / 10

/** Text: the print width that gives a letter height, and back. */
const textWidthCm = (asset: LogoAsset, text: TextSpec, letterCm: number) => (letterCm * asset.width) / text.capPx
const letterCmOf = (l: LogoLayer) => (l.text ? (l.placement.widthCm * l.text.capPx) / l.asset.width : 0)

/** After a resize or a move, the text's chosen letter height becomes what's printed. */
const syncTextSize = (l: LogoLayer): LogoLayer => (l.text ? { ...l, text: { ...l.text, sizeCm: round1(letterCmOf(l)) } } : l)

const normalizeLogos = (design: Design): Design => ({
  ...design,
  logos: design.logos.map((l) => syncTextSize({ ...l, placement: normalizePlacement(design, l.placement, logoAspect(l.asset)) })),
})

const withPlacement = (design: Design, id: string, placement: LogoPlacement): Design => ({
  ...design,
  logos: design.logos.map((l) => (l.id === id ? syncTextSize({ ...l, placement }) : l)),
})

/** Axis-aligned footprint of a logo on its side, view-space metres. */
export function logoRect(design: Design, layer: LogoLayer): PrintArea {
  const garment = getGarment(design.productId)
  const p = layer.placement
  const preset = garment.placements.find((x) => x.id === p.placement) ?? garment.placements[0]
  const [w, h] = rotatedExtents(p.widthCm / 100, logoAspect(layer.asset), p.rotationDeg)
  const cx = preset.anchor[0] + p.offsetXCm / 100
  const cy = preset.anchor[1] + p.offsetYCm / 100
  return { xMin: cx - w / 2, xMax: cx + w / 2, yMin: cy - h / 2, yMax: cy + h / 2 }
}

const overlaps = (a: PrintArea, b: PrintArea) => a.xMax > b.xMin && a.xMin < b.xMax && a.yMax > b.yMin && a.yMin < b.yMax

/** Chest presets and the wearer's side they sit on. */
const CHEST_SIDE: Partial<Record<PlacementId, ChestSide>> = { leftChest: 'left', rightChest: 'right' }
const otherSide = (s: ChestSide): ChestSide => (s === 'left' ? 'right' : 'left')
const chestPreset = (side: ChestSide) => (side === 'left' ? 'leftChest' : 'rightChest') as PlacementId
const chestOf = (l: LogoLayer) => CHEST_SIDE[l.placement.placement]
const chestsUsed = (design: Design, except?: string) => new Set(design.logos.filter((l) => l.id !== except).map(chestOf))

/**
 * Whether logo `id` (null for a new one) may take `placement`. Taking the
 * brand mark's chest moves the mark across, so the other chest must be free.
 */
export function canUsePlacement(design: Design, id: string | null, placement: PlacementId): boolean {
  const chest = CHEST_SIDE[placement]
  if (!chest || chest !== design.brand.side) return true
  return !chestsUsed(design, id ?? undefined).has(otherSide(chest))
}

/**
 * A chest logo and the brand mark never share a side: the mark moves to the
 * free chest. If logos sit on both chests (only possible in hand-edited files),
 * the ones on the mark's chest move to the centre chest instead. A centred
 * mark leaves both chests free.
 */
export function makeRoomForLogos(design: Design): Design {
  const side = design.brand.side
  const used = chestsUsed(design)
  if (side === 'center' || !used.has(side)) return design
  const other = otherSide(side)
  if (!used.has(other)) return { ...design, brand: { ...design.brand, side: other } }
  const center = getGarment(design.productId).placements.find((p) => p.side === 'front' && !CHEST_SIDE[p.id])
  if (!center) return design
  return {
    ...design,
    logos: design.logos.map((l) =>
      chestOf(l) === design.brand.side ? { ...l, placement: { ...l.placement, placement: center.id, offsetXCm: 0, offsetYCm: 0 } } : l,
    ),
  }
}

/** Fixes a loaded or imported design: brand mark conflicts, then print-area clamping. */
export function fixDesign(design: Design): Design {
  return normalizeLogos(makeRoomForLogos(design))
}

/** Default letter height on a preset: small on the chest crests, larger on the big prints. */
const defaultLetterCm = (preset: PlacementPreset) => Math.max(1.5, Math.round(preset.defaultWidth * 50) / 2)

/** Geometry defaults for a preset; appearance (opacity, tint, lock) carries over. */
function presetDefaults(design: Design, layer: LogoLayer, id: PlacementId): LogoPlacement {
  const garment = getGarment(design.productId)
  const preset = garment.placements.find((p) => p.id === id) ?? garment.placements[0]
  return normalizePlacement(
    design,
    {
      ...layer.placement,
      flipX: false,
      flipY: false,
      side: preset.side,
      placement: preset.id,
      widthCm: layer.text ? textWidthCm(layer.asset, layer.text, defaultLetterCm(preset)) : Math.round(preset.defaultWidth * 1000) / 10,
      rotationDeg: 0,
      offsetXCm: 0,
      offsetYCm: 0,
    },
    logoAspect(layer.asset),
  )
}

/** Where new prints go first. Logos: a chest, then the back. Text: across the chest, then the back. */
const AUTO_ORDER: Record<'image' | 'text', PlacementId[]> = {
  image: ['leftChest', 'rightChest', 'upperBack', 'centerChest', 'centerBack'],
  text: ['centerChest', 'upperBack', 'centerBack', 'leftChest', 'rightChest'],
}

/**
 * Print position for a logo that's new or changing side: never the brand
 * mark's chest, preferably a preset no other logo uses and where it doesn't
 * cover another logo.
 */
function pickPlacement(design: Design, layer: LogoLayer, side?: Side): LogoPlacement | null {
  const garment = getGarment(design.productId)
  const others = design.logos.filter((l) => l.id !== layer.id)
  const order = [...AUTO_ORDER[layerKind(layer)], ...garment.placements.map((p) => p.id)]
  const candidates = [...new Set(order)]
    .map((id) => garment.placements.find((p) => p.id === id))
    .filter((p) => !!p && (!side || p.side === side) && CHEST_SIDE[p.id] !== design.brand.side)
    .map((p) => presetDefaults(design, layer, p!.id))
  const unused = candidates.filter((c) => !others.some((o) => o.placement.placement === c.placement))
  const clear = unused.filter((c) => !others.some((o) => o.placement.side === c.side && overlaps(logoRect(design, o), logoRect(design, { ...layer, placement: c }))))
  return clear[0] ?? unused[0] ?? candidates[0] ?? null
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
  const layer = (id: string) => get().design.logos.find((l) => l.id === id)

  return {
    design: createDefaultDesign(),
    past: [],
    future: [],
    lastCommit: null,

    setProduct: (id) => {
      const { design } = get()
      if (design.productId === id) return
      commit(normalizeLogos({ ...design, productId: id }))
    },

    setColor: (zone, hex, opts) => {
      const { design } = get()
      if (isPaintZone(zone)) {
        const zones = { ...design.zones }
        if (hex) zones[zone] = { color: hex, pattern: zones[zone]?.pattern ?? null }
        else delete zones[zone]
        return commit({ ...design, zones }, opts)
      }
      if (zone === 'body' && !hex) return
      commit({ ...design, colors: { ...design.colors, [zone]: hex } }, opts)
    },

    setPattern: (zone, fill, opts) => {
      const { design } = get()
      const pattern = fill ? cleanPatternFill(fill) : null
      if (isPaintZone(zone)) {
        const current = design.zones[zone]
        if (!current && !pattern) return
        return commit({ ...design, zones: { ...design.zones, [zone]: { color: current?.color ?? design.colors.body, pattern } } }, opts)
      }
      commit({ ...design, patterns: { ...design.patterns, [zone]: pattern } }, opts)
    },

    updatePattern: (zone, patch, opts) => {
      const { design } = get()
      if (isPaintZone(zone)) {
        const current = design.zones[zone]
        if (!current?.pattern) return
        return commit({ ...design, zones: { ...design.zones, [zone]: { ...current, pattern: cleanPatternFill({ ...current.pattern, ...patch }) } } }, opts)
      }
      const current = design.patterns[zone]
      if (!current) return
      commit({ ...design, patterns: { ...design.patterns, [zone]: cleanPatternFill({ ...current, ...patch }) } }, opts)
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
      commit({ ...design, colors: createDefaultDesign().colors, zones: {} })
    },

    addLogo: (asset) => {
      const { design } = get()
      if (design.logos.filter((l) => !l.text).length >= MAX_LOGOS) return null
      const draft: LogoLayer = { id: newLogoId(), asset, placement: { ...DEFAULT_PLACEMENT } }
      const placement = pickPlacement(design, draft)
      if (!placement) return null
      commit({ ...design, logos: [...design.logos, { ...draft, placement }] })
      return draft.id
    },

    addText: (text, asset, color) => {
      const { design } = get()
      if (design.logos.filter((l) => l.text).length >= MAX_TEXTS) return null
      const draft: LogoLayer = { id: newLogoId(), asset, text, placement: { ...DEFAULT_PLACEMENT, tint: color } }
      const placement = pickPlacement(design, draft)
      if (!placement) return null
      commit({ ...design, logos: [...design.logos, syncTextSize({ ...draft, placement })] })
      return draft.id
    },

    setText: (id, text, asset, opts) => {
      const { design } = get()
      const current = layer(id)
      if (!current?.text) return
      // Keep the chosen letter height; the print-area clamp sets overlong text smaller.
      const placement = normalizePlacement(design, { ...current.placement, widthCm: textWidthCm(asset, text, text.sizeCm) }, logoAspect(asset))
      const next: Design = { ...design, logos: design.logos.map((l) => (l.id === id ? { ...l, asset, text, placement } : l)) }
      commit(next, opts?.coalesce ? { coalesce: `${id}:${opts.coalesce}` } : undefined)
    },

    replaceLogo: (id, asset) => {
      const { design } = get()
      const current = layer(id)
      if (!current) return
      const next: Design = { ...design, logos: design.logos.map((l) => (l.id === id ? { ...l, asset } : l)) }
      commit(withPlacement(next, id, normalizePlacement(next, current.placement, logoAspect(asset))))
    },

    removeLogo: (id) => {
      const { design } = get()
      commit({ ...design, logos: design.logos.filter((l) => l.id !== id) })
    },

    moveLogo: (id, dir) => {
      const { design } = get()
      const i = design.logos.findIndex((l) => l.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= design.logos.length) return
      const logos = [...design.logos]
      ;[logos[i], logos[j]] = [logos[j], logos[i]]
      commit({ ...design, logos })
    },

    setSide: (id, side) => {
      const { design } = get()
      const current = layer(id)
      if (!current || current.placement.side === side) return
      const placement = pickPlacement(design, current, side)
      if (placement) commit(withPlacement(design, id, placement))
    },

    setPlacement: (id, placement) => {
      const { design } = get()
      const current = layer(id)
      if (!current || current.placement.placement === placement || !canUsePlacement(design, id, placement)) return
      const { rotationDeg, flipX, flipY } = current.placement
      // Taking the brand mark's chest moves the mark across; every front print is then re-clamped around it.
      const draft = makeRoomForLogos(withPlacement(design, id, { ...current.placement, placement }))
      const moved = { ...presetDefaults(draft, current, placement), rotationDeg, flipX, flipY }
      commit(normalizeLogos(withPlacement(draft, id, moved)))
    },

    setBrand: (patch) => {
      const { design } = get()
      let next: Design = { ...design, brand: { ...design.brand, ...patch } }
      // The mark takes the chosen chest; chest logos already there move across, keeping their size.
      // Centred, it frees both chests (front prints are still kept clear of it).
      if (patch.side && patch.side !== 'center') {
        const across = chestPreset(otherSide(patch.side))
        next = {
          ...next,
          logos: next.logos.map((l) => {
            if (chestOf(l) !== patch.side) return l
            const { rotationDeg, flipX, flipY, widthCm } = l.placement
            return { ...l, placement: { ...presetDefaults(next, l, across), rotationDeg, flipX, flipY, widthCm } }
          }),
        }
      }
      commit(normalizeLogos(next))
    },

    updateTransform: (id, patch, opts) => {
      const { design } = get()
      const current = layer(id)
      if (!current) return
      const placement = normalizePlacement(design, { ...current.placement, ...patch }, logoAspect(current.asset))
      // Keys are per logo, so quick edits on two different logos stay separate undo steps.
      commit(withPlacement(design, id, placement), opts?.coalesce ? { coalesce: `${id}:${opts.coalesce}` } : undefined)
    },

    resetTransform: (id) => {
      const { design } = get()
      const current = layer(id)
      if (current) commit(withPlacement(design, id, presetDefaults(design, current, current.placement.placement)))
    },

    replaceDesign: (incoming) => commit(fixDesign(incoming)),

    resetAll: () => commit(fixDesign(createDefaultDesign())),

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
