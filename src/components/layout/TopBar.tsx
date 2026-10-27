import { useState } from 'react'
import { ChevronDown, Download, Ellipsis, FileJson, FileUp, Image, Redo2, RotateCcw, Save, Undo2 } from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { exportJson, exportPreviewImage, pickDesignFile, saveLocally } from '../../state/actions'
import { ConfirmDialog, IconButton, Menu, type MenuItem } from '../ui/controls'
import { LunarLogo } from './LunarLogo'

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
    { label: 'Image d’aperçu (PNG)', icon: <Image size={16} aria-hidden />, onSelect: () => void exportPreviewImage() },
    { label: 'Fichier du design (JSON)', icon: <FileJson size={16} aria-hidden />, onSelect: exportJson },
    { label: 'Importer un design…', icon: <FileUp size={16} aria-hidden />, onSelect: pickDesignFile },
  ]
  const moreItems: MenuItem[] = [
    { label: 'Enregistrer dans ce navigateur', icon: <Save size={16} aria-hidden />, onSelect: saveLocally },
    ...exportItems,
    { label: 'Réinitialiser le design', icon: <RotateCcw size={16} aria-hidden />, onSelect: () => setConfirm(true), danger: true },
  ]

  return (
    <header className="topbar">
      <div className="brand">
        <LunarLogo />
        <span className="brand-divider" aria-hidden />
        <div className="brand-text">
          <span className="brand-title">Personnalisation 3D</span>
          <span className="brand-sub">Démo · sportswear sur mesure</span>
        </div>
      </div>

      <div className="topbar-actions">
        <IconButton label="Annuler" tip={`Annuler (${MOD}Z)`} disabled={!canUndo} onClick={undo}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="Rétablir" tip={`Rétablir (${MOD}Maj+Z)`} disabled={!canRedo} onClick={redo}>
          <Redo2 size={18} />
        </IconButton>
        <span className="topbar-sep" aria-hidden />
        <button type="button" className="btn btn-ghost hide-sm" onClick={() => setConfirm(true)}>
          <RotateCcw size={16} aria-hidden /> Réinitialiser
        </button>
        <button type="button" className="btn btn-ghost hide-sm" onClick={saveLocally}>
          <Save size={16} aria-hidden /> Enregistrer
        </button>
        <div className="hide-sm">
          <Menu
            label="Exporter"
            items={exportItems}
            trigger={(props) => (
              <button type="button" className="btn btn-primary" {...props}>
                <Download size={16} aria-hidden /> Exporter <ChevronDown size={14} aria-hidden />
              </button>
            )}
          />
        </div>
        <div className="show-sm">
          <Menu
            label="Actions du design"
            items={moreItems}
            trigger={(props) => (
              <button type="button" className="icon-btn" aria-label="Actions du design" {...props}>
                <Ellipsis size={20} />
              </button>
            )}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Réinitialiser tout le design&nbsp;?"
        body="Le produit, les couleurs, les logos et le texte reviennent aux valeurs par défaut. Vous pourrez encore annuler."
        confirmLabel="Réinitialiser"
        onConfirm={resetAll}
        onClose={() => setConfirm(false)}
      />
    </header>
  )
}
