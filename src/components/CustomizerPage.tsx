import { useEffect } from 'react'
import { fixDesign, useDesignStore } from '../state/designStore'
import { getActiveLogo } from '../state/useActiveLogo'
import { useUiStore } from '../state/uiStore'
import { loadSavedDesign } from '../lib/persistence'
import { TopBar } from './layout/TopBar'
import { CustomizerSidebar } from './layout/CustomizerSidebar'
import { ProductViewer3D } from './viewer/ProductViewer3D'
import { Toaster } from './ui/Toaster'
import { t, useT } from '../i18n'

function isTextField(el: Element | null) {
  return !!el && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button'].includes(el.type)))
}

/** Ctrl/⌘+Z, Ctrl/⌘+Shift+Z and Ctrl+Y — text fields keep their native undo. */
function useUndoShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTextField(document.activeElement)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useDesignStore.getState().undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        useDesignStore.getState().redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/**
 * Shortcuts for the selected logo (from the OpenMerch editor): arrows nudge
 * 2 mm (Shift: 1 cm), Delete/Backspace removes it, Escape deselects.
 */
function useLogoShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUiStore.getState()
      const { updateTransform, removeLogo } = useDesignStore.getState()
      const layer = getActiveLogo()
      if (!ui.logoSelected || !layer || e.ctrlKey || e.metaKey || e.altKey) return
      const el = document.activeElement as HTMLElement | null
      const free = !el || el === document.body || !!el.closest('.stage-canvas') || (el.tagName === 'BUTTON' && !!el.closest('.logo-toolbar'))
      if (!free) return
      if (e.key === 'Escape') {
        ui.selectLogo(false)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeLogo(layer.id)
        ui.selectLogo(false)
        ui.notify('info', t().common.removed(layer.asset.name))
        return
      }
      const step = e.shiftKey ? 1 : 0.2
      const delta = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] } as Record<string, [number, number]>)[e.key]
      if (!delta || layer.placement.locked) return
      e.preventDefault()
      const p = layer.placement
      updateTransform(layer.id, { offsetXCm: p.offsetXCm + delta[0], offsetYCm: p.offsetYCm + delta[1] }, { coalesce: 'nudge' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

let restoreAttempted = false

/** Restores a design saved with "Save in this browser" (not part of undo history). Runs once per page load. */
function useRestoreSavedDesign() {
  useEffect(() => {
    if (restoreAttempted) return
    restoreAttempted = true
    const saved = loadSavedDesign()
    if (!saved) return
    const design = fixDesign(saved)
    useDesignStore.setState({ design, past: [], future: [] })
    useUiStore.getState().setView(design.logos[design.logos.length - 1]?.placement.side ?? 'front')
    useUiStore.getState().notify('info', t().app.welcomeBack)
  }, [])
}

export function CustomizerPage() {
  const m = useT()
  useUndoShortcuts()
  useLogoShortcuts()
  useRestoreSavedDesign()
  return (
    <div className="app">
      <a href="#customize" className="skip-link">
        {m.app.skip}
      </a>
      <TopBar />
      <main className="workspace" id="customize">
        <CustomizerSidebar />
        <ProductViewer3D />
      </main>
      <Toaster />
    </div>
  )
}
