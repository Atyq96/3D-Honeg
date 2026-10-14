import { create } from 'zustand'
import type { RegionId } from '../garments/types'

export type StepId = 'product' | 'color' | 'pattern' | 'logo' | 'review'
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
  colorZone: RegionId
  patternZone: RegionId
  viewerStatus: ViewerStatus
  viewerError: string | null
  /** The logo is selected on the garment: shows the transform gizmo and contextual toolbar. */
  logoSelected: boolean
  /** Colour regions actually present in the loaded 3D model (null until a model loads). */
  modelRegions: RegionId[] | null
  toasts: Toast[]

  setStep: (step: StepId) => void
  setView: (view: ViewId) => void
  setColorZone: (zone: RegionId) => void
  setPatternZone: (zone: RegionId) => void
  selectLogo: (selected: boolean) => void
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
  logoSelected: false,
  toasts: [],

  // The logo handles and toolbar belong to the Logo step; leaving it deselects.
  setStep: (step) => set((s) => ({ step, logoSelected: step === 'logo' && s.logoSelected })),
  setView: (view) => set((s) => ({ view, viewNonce: s.viewNonce + 1 })),
  setColorZone: (colorZone) => set({ colorZone }),
  setPatternZone: (patternZone) => set({ patternZone }),
  selectLogo: (logoSelected) => set({ logoSelected }),
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
  { id: 'review', label: 'Review', short: 'Review' },
]
