import { create } from 'zustand'
import type { RegionId } from '../garments/types'
import type { ZoneId } from '../garments/zones'

export type StepId = 'product' | 'color' | 'pattern' | 'logo' | 'text' | 'review'
export type ViewId = 'front' | 'back' | 'left' | 'right'
export type ViewerStatus = 'loading' | 'ready' | 'error' | 'unsupported'

export interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  message: string
}

interface UiStore {
  step: StepId
  /** Last requested camera view; `viewNonce` re-triggers the same view after free orbiting. */
  view: ViewId
  viewNonce: number
  colorZone: ZoneId
  patternZone: ZoneId
  viewerStatus: ViewerStatus
  viewerError: string | null
  /** The logo the sidebar, toolbar and gizmo edit (falls back to the newest logo when unset or removed). */
  activeLogoId: string | null
  /** The active logo is selected on the garment: shows the transform gizmo and contextual toolbar. */
  logoSelected: boolean
  /** Colour regions actually present in the loaded 3D model (null until a model loads). */
  modelRegions: RegionId[] | null
  /** 3D renders of the garment with each zone highlighted, for the zone pickers (PNG data URLs). */
  zoneThumbs: Partial<Record<ZoneId, string>>
  toasts: Toast[]

  setStep: (step: StepId) => void
  setView: (view: ViewId) => void
  setColorZone: (zone: ZoneId) => void
  setPatternZone: (zone: ZoneId) => void
  selectLogo: (selected: boolean) => void
  /** Makes a logo the active one; `select` also shows its handles on the garment. */
  setActiveLogo: (id: string | null, select?: boolean) => void
  setViewerStatus: (status: ViewerStatus, error?: string | null) => void
  notify: (kind: Toast['kind'], message: string) => void
  dismiss: (id: number) => void
}

let toastId = 0

export const useUiStore = create<UiStore>()((set, get) => ({
  step: 'product',
  view: 'front',
  viewNonce: 0,
  colorZone: 'body',
  patternZone: 'body',
  viewerStatus: 'loading',
  viewerError: null,
  modelRegions: null,
  zoneThumbs: {},
  activeLogoId: null,
  logoSelected: false,
  toasts: [],

  // On-garment handles and the toolbar belong to the step that edits that print; changing step deselects.
  setStep: (step) => set((s) => ({ step, logoSelected: step === s.step && s.logoSelected })),
  setView: (view) => set((s) => ({ view, viewNonce: s.viewNonce + 1 })),
  setColorZone: (colorZone) => set({ colorZone }),
  setPatternZone: (patternZone) => set({ patternZone }),
  selectLogo: (logoSelected) => set({ logoSelected }),
  setActiveLogo: (activeLogoId, select = false) => set((s) => ({ activeLogoId, logoSelected: select || s.logoSelected })),
  setViewerStatus: (viewerStatus, viewerError = null) => set({ viewerStatus, viewerError }),
  notify: (kind, message) => {
    const id = ++toastId
    set({ toasts: [...get().toasts.slice(-2), { id, kind, message }] })
    window.setTimeout(() => get().dismiss(id), kind === 'error' ? 6500 : 3800)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export const STEPS: { id: StepId; label: string; short: string }[] = [
  { id: 'product', label: 'Product', short: 'Product' },
  { id: 'color', label: 'Colors', short: 'Color' },
  { id: 'pattern', label: 'Pattern', short: 'Pattern' },
  { id: 'logo', label: 'Logo', short: 'Logo' },
  { id: 'text', label: 'Text', short: 'Text' },
  { id: 'review', label: 'Review', short: 'Review' },
]
