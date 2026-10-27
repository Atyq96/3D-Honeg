import { useState } from 'react'
import { ChevronDown, Download, Ellipsis, FileJson, FileUp, Image, Redo2, RotateCcw, Save, Undo2 } from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { exportJson, exportPreviewImage, pickDesignFile, saveLocally } from '../../state/actions'
import { ConfirmDialog, IconButton, Menu, type MenuItem } from '../ui/controls'
import { LunarLogo } from './LunarLogo'
import { LanguageSwitch } from './LanguageSwitch'
import { useT } from '../../i18n'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
const MOD = isMac ? '⌘' : 'Ctrl+'

export function TopBar() {
  const canUndo = useDesignStore((s) => s.past.length > 0)
  const canRedo = useDesignStore((s) => s.future.length > 0)
  const undo = useDesignStore((s) => s.undo)
  const redo = useDesignStore((s) => s.redo)
  const resetAll = useDesignStore((s) => s.resetAll)
  const [confirm, setConfirm] = useState(false)
  const m = useT()

  const exportItems: MenuItem[] = [
    { label: m.topbar.exportPreview, icon: <Image size={16} aria-hidden />, onSelect: () => void exportPreviewImage() },
    { label: m.topbar.exportJson, icon: <FileJson size={16} aria-hidden />, onSelect: exportJson },
    { label: m.topbar.importDesign, icon: <FileUp size={16} aria-hidden />, onSelect: pickDesignFile },
  ]
  const moreItems: MenuItem[] = [
    { label: m.topbar.saveBrowser, icon: <Save size={16} aria-hidden />, onSelect: saveLocally },
    ...exportItems,
    { label: m.topbar.resetDesign, icon: <RotateCcw size={16} aria-hidden />, onSelect: () => setConfirm(true), danger: true },
  ]

  return (
    <header className="topbar">
      <div className="brand">
        <LunarLogo />
        <span className="brand-divider" aria-hidden />
        <div className="brand-text">
          <span className="brand-title">{m.app.title}</span>
          <span className="brand-sub">{m.app.subtitle}</span>
        </div>
      </div>

      <div className="topbar-actions">
        <LanguageSwitch />
        <span className="topbar-sep" aria-hidden />
        <IconButton label={m.topbar.undo} tip={m.topbar.undoTip(MOD)} disabled={!canUndo} onClick={undo}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton label={m.topbar.redo} tip={m.topbar.redoTip(MOD)} disabled={!canRedo} onClick={redo}>
          <Redo2 size={18} />
        </IconButton>
        <span className="topbar-sep" aria-hidden />
        <button type="button" className="btn btn-ghost hide-sm" onClick={() => setConfirm(true)}>
          <RotateCcw size={16} aria-hidden /> {m.topbar.reset}
        </button>
        <button type="button" className="btn btn-ghost hide-sm" onClick={saveLocally}>
          <Save size={16} aria-hidden /> {m.topbar.save}
        </button>
        <div className="hide-sm">
          <Menu
            label={m.topbar.export}
            items={exportItems}
            trigger={(props) => (
              <button type="button" className="btn btn-primary" {...props}>
                <Download size={16} aria-hidden /> {m.topbar.export} <ChevronDown size={14} aria-hidden />
              </button>
            )}
          />
        </div>
        <div className="show-sm">
          <Menu
            label={m.topbar.designActions}
            items={moreItems}
            trigger={(props) => (
              <button type="button" className="icon-btn" aria-label={m.topbar.designActions} {...props}>
                <Ellipsis size={20} />
              </button>
            )}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title={m.topbar.confirmTitle}
        body={m.topbar.confirmBody}
        confirmLabel={m.topbar.confirmLabel}
        onConfirm={resetAll}
        onClose={() => setConfirm(false)}
      />
    </header>
  )
}
