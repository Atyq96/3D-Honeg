import type { LogoLayer } from './design'
import { useDesignStore } from './designStore'
import { useUiStore } from './uiStore'

/** The logo being edited: the chosen one, or the newest when none is chosen (or it was removed). */
export function activeLogo(logos: LogoLayer[], id: string | null): LogoLayer | null {
  return logos.find((l) => l.id === id) ?? logos[logos.length - 1] ?? null
}

export function getActiveLogo(): LogoLayer | null {
  return activeLogo(useDesignStore.getState().design.logos, useUiStore.getState().activeLogoId)
}

export function useActiveLogo(): LogoLayer | null {
  const logos = useDesignStore((s) => s.design.logos)
  const id = useUiStore((s) => s.activeLogoId)
  return activeLogo(logos, id)
}
