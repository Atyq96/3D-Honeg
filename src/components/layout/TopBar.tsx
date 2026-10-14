import { useState } from 'react'
import { ChevronDown, Download, Ellipsis, FileJson, FileUp, Image, Redo2, RotateCcw, Save, Undo2 } from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { exportJson, exportPreviewImage, pickDesignFile, saveLocally } from '../../state/actions'
import { ConfirmDialog, IconButton, Menu, type MenuItem } from '../ui/controls'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
const MOD = isMac ? '⌘' : 'Ctrl+'

export function TopBar() {
  const canUndo = useDesignStore((s) => s.past.length > 0)
  const canRedo = useDesignStore((s) => s.future.length > 0)
  const undo = useDesignStore((s) => s.undo)
  const redo = useDesignStore((s) => s.redo)
  const resetAll = useDesignStore((s) => s.resetAll)
  const [confirm, setConfirm] = useState(false)

  const exportItems: MenuItem[] = [
    { label: 'Preview image (PNG)', icon: <Image size={16} aria-hidden />, onSelect: () => void exportPreviewImage() },
    { label: 'Design file (JSON)', icon: <FileJson size={16} aria-hidden />, onSelect: exportJson },
    { label: 'Import design…', icon: <FileUp size={16} aria-hidden />, onSelect: pickDesignFile },
  ]
  const moreItems: MenuItem[] = [
    { label: 'Save in this browser', icon: <Save size={16} aria-hidden />, onSelect: saveLocally },
    ...exportItems,
    { label: 'Reset design', icon: <RotateCcw size={16} aria-hidden />, onSelect: () => setConfirm(true), danger: true },
  ]

  return (
    <header className="topbar">
      <div className="brand">
        <img src="/brand/honeg-logo-black.png" alt="HONEG" className="brand-logo" width={46} height={34} />
        <span className="brand-divider" aria-hidden />
        <div className="brand-text">
          <span className="brand-title">3D Customizer</span>
          <span className="brand-sub">Custom sportswear</span>
        </div>
      </div>

      <div className="topbar-actions">
        <IconButton label="Undo" tip={`Undo (${MOD}Z)`} disabled={!canUndo} onClick={undo}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="Redo" tip={`Redo (${MOD}Shift+Z)`} disabled={!canRedo} onClick={redo}>
          <Redo2 size={18} />
        </IconButton>
        <span className="topbar-sep" aria-hidden />
        <button type="button" className="btn btn-ghost hide-sm" onClick={() => setConfirm(true)}>
          <RotateCcw size={16} aria-hidden /> Reset
        </button>
        <button type="button" className="btn btn-ghost hide-sm" onClick={saveLocally}>
          <Save size={16} aria-hidden /> Save
        </button>
        <div className="hide-sm">
          <Menu
            label="Export"
            items={exportItems}
            trigger={(props) => (
              <button type="button" className="btn btn-primary" {...props}>
                <Download size={16} aria-hidden /> Export <ChevronDown size={14} aria-hidden />
              </button>
            )}
          />
        </div>
        <div className="show-sm">
          <Menu
            label="Design actions"
            items={moreItems}
            trigger={(props) => (
              <button type="button" className="icon-btn" aria-label="Design actions" {...props}>
                <Ellipsis size={20} />
              </button>
            )}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Reset the entire design?"
        body="Product, colors and logo go back to their defaults. You can still undo this."
        confirmLabel="Reset design"
        onConfirm={resetAll}
        onClose={() => setConfirm(false)}
      />
    </header>
  )
}
