import { layerKind, type LayerKind, type LogoLayer } from './design'
import { useDesignStore } from './designStore'
import { useUiStore } from './uiStore'

/**
 * The print being edited: the chosen one, or the newest when none is chosen
 * (or it was removed). With `kind`, only logos/photos or only text count.
 */
export function activeLogo(logos: LogoLayer[], id: string | null, kind?: LayerKind): LogoLayer | null {
  const pool = kind ? logos.filter((l) => layerKind(l) === kind) : logos
  return pool.find((l) => l.id === id) ?? pool[pool.length - 1] ?? null
}

export function getActiveLogo(kind?: LayerKind): LogoLayer | null {
  return activeLogo(useDesignStore.getState().design.logos, useUiStore.getState().activeLogoId, kind)
}

export function useActiveLogo(kind?: LayerKind): LogoLayer | null {
  const logos = useDesignStore((s) => s.design.logos)
  const id = useUiStore((s) => s.activeLogoId)
  return activeLogo(logos, id, kind)
}

/**
 * Opens a print for editing: its step (Logo or Text), its handles on the
 * garment and, with `turn`, the camera on its side.
 */
export function editLayer(layer: LogoLayer, { turn = true }: { turn?: boolean } = {}) {
  const ui = useUiStore.getState()
  ui.setStep(layerKind(layer) === 'text' ? 'text' : 'logo')
  ui.setActiveLogo(layer.id, true)
  if (turn) ui.setView(layer.placement.side)
}
