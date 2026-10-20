import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  BoxSelect,
  Check,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  LoaderCircle,
  Lock,
  Move,
  Paintbrush,
  RotateCcw,
  Trash2,
  Type,
  Unlock,
} from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { logoAspect } from '../../state/design'
import { useActiveLogo } from '../../state/useActiveLogo'
import { getGarment } from '../../garments/catalog'
import { isLight } from '../../lib/color'
import { InkPicker } from '../ui/InkPicker'
import { alignOffsets, type AlignX, type AlignY } from '../../lib/logoTransform'
import { LOGO_ACCEPT, LogoFileError, processLogoFile } from '../../lib/logoFile'

type PopoverName = 'fill' | 'position' | 'transform' | null
type Updater = ReturnType<typeof useDesignStore.getState>['updateTransform']

/**
 * Contextual toolbar shown while the logo is selected — modelled on the
 * OpenMerch editor's ImageToolbar: replace, fill colour, opacity, position
 * (align grid + lock), transform (rotate, flip, reset) and delete.
 */
export function LogoToolbar() {
  const selected = useUiStore((s) => s.logoSelected)
  const layer = useActiveLogo()
  const [open, setOpen] = useState<PopoverName>(null)
  const [busy, setBusy] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!selected || !layer) return null
  const { placement } = layer
  const update = (patch: Parameters<Updater>[1], opts?: Parameters<Updater>[2]) => useDesignStore.getState().updateTransform(layer.id, patch, opts)

  const toggle = (name: PopoverName) => setOpen((o) => (o === name ? null : name))
  const notify = useUiStore.getState().notify

  const replace = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const { asset, warning } = await processLogoFile(file)
      useDesignStore.getState().replaceLogo(layer.id, asset)
      notify(warning ? 'info' : 'success', warning ?? 'Image remplacée\u00a0: position et taille conservées.')
    } catch (err) {
      notify('error', err instanceof LogoFileError ? err.message : 'Ce fichier n’a pas pu être utilisé.')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const remove = () => {
    useDesignStore.getState().removeLogo(layer.id)
    useUiStore.getState().selectLogo(false)
    notify('info', `«\u00a0${layer.asset.name}\u00a0» retiré. Annulez pour le récupérer.`)
  }

  return (
    <div className="logo-toolbar" ref={root} role="toolbar" aria-label="Outils du logo">
      <input ref={fileInput} type="file" accept={LOGO_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void replace(e.target.files?.[0])} />

      {layer.text ? (
        <ToolButton label="Modifier le texte" onClick={() => document.getElementById('text-content')?.focus()}>
          <Type size={17} />
        </ToolButton>
      ) : (
        <ToolButton label="Remplacer l’image" onClick={() => fileInput.current?.click()} disabled={busy}>
          {busy ? <LoaderCircle size={17} className="spin" /> : <ImagePlus size={17} />}
        </ToolButton>
      )}

      <PopoverAnchor open={open === 'fill'} label={layer.text ? 'Couleur du texte' : 'Couleur de remplissage'} popover={<FillPopover />}>
        <ToolButton label={layer.text ? 'Couleur du texte' : 'Couleur de remplissage'} onClick={() => toggle('fill')} expanded={open === 'fill'} active={open === 'fill' || !!placement.tint}>
          <Paintbrush size={17} />
          {placement.tint && <span className={`tool-dot ${isLight(placement.tint) ? 'is-light' : ''}`} style={{ background: placement.tint }} aria-hidden />}
        </ToolButton>
      </PopoverAnchor>

      <span className="tool-divider" aria-hidden />

      <label className="tool-opacity" data-tip="Opacité">
        <span className="sr-only">Opacité</span>
        <input
          type="range"
          className="range"
          min={10}
          max={100}
          step={1}
          value={Math.round(placement.opacity * 100)}
          style={{ ['--pct' as string]: `${((placement.opacity * 100 - 10) / 90) * 100}%` }}
          aria-valuetext={`${Math.round(placement.opacity * 100)}%`}
          onChange={(e) => update({ opacity: Number(e.target.value) / 100 }, { coalesce: 'opacity' })}
        />
        <span className="tool-opacity-value">{Math.round(placement.opacity * 100)}%</span>
      </label>

      <span className="tool-divider" aria-hidden />

      <PopoverAnchor open={open === 'position'} label="Position" popover={<PositionPopover />}>
        <ToolButton label="Position" onClick={() => toggle('position')} expanded={open === 'position'} active={open === 'position'}>
          {placement.locked ? <Lock size={17} /> : <Move size={17} />}
        </ToolButton>
      </PopoverAnchor>

      <PopoverAnchor open={open === 'transform'} label="Transformer" popover={<TransformPopover />}>
        <ToolButton label="Transformer" onClick={() => toggle('transform')} expanded={open === 'transform'} active={open === 'transform'}>
          <BoxSelect size={17} />
        </ToolButton>
      </PopoverAnchor>

      <span className="tool-divider" aria-hidden />

      <ToolButton label={layer.text ? 'Supprimer le texte' : 'Supprimer le logo'} onClick={remove} danger>
        <Trash2 size={17} />
      </ToolButton>
      <ToolButton label="Terminé" onClick={() => useUiStore.getState().selectLogo(false)}>
        <Check size={17} />
      </ToolButton>
    </div>
  )
}

function ToolButton({
  label,
  onClick,
  active,
  expanded,
  danger,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  /** Set on buttons that open a popover; the tooltip is hidden while it is open. */
  expanded?: boolean
  danger?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  const opensPopover = expanded !== undefined
  return (
    <button
      type="button"
      className={`tool-btn ${active ? 'is-active' : ''} ${danger ? 'is-danger' : ''}`}
      aria-label={label}
      aria-pressed={opensPopover ? undefined : active}
      aria-haspopup={opensPopover ? 'dialog' : undefined}
      aria-expanded={expanded}
      data-tip={expanded ? undefined : label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function PopoverAnchor({ open, label, popover, children }: { open: boolean; label: string; popover: ReactNode; children: ReactNode }) {
  return (
    <div className="popover-anchor">
      {children}
      {open && (
        <div className="popover" role="dialog" aria-label={label}>
          {popover}
        </div>
      )}
    </div>
  )
}

function FillPopover() {
  const layer = useActiveLogo()
  if (!layer) return null
  const tint = layer.placement.tint
  const apply = (value: string | null) => useDesignStore.getState().updateTransform(layer.id, { tint: value })
  return (
    <>
      <div className="popover-head">
        <strong>{layer.text ? 'Couleur du texte' : 'Couleur de remplissage'}</strong>
        <span className="muted">{layer.text ? 'Couleur des lettres.' : 'Recolore chaque pixel visible du logo.'}</span>
      </div>
      {!layer.text && (
        <button type="button" className={`fill-original ${tint === null ? 'is-active' : ''}`} onClick={() => apply(null)}>
          Couleurs d’origine
        </button>
      )}
      <InkPicker value={tint} onChange={apply} label={layer.text ? 'Couleur du texte' : 'Couleur de remplissage'} id="fill-hex" />
    </>
  )
}

const GRID: [AlignX, AlignY, string][] = [
  ['left', 'top', 'En haut à gauche'],
  ['center', 'top', 'En haut au centre'],
  ['right', 'top', 'En haut à droite'],
  ['left', 'center', 'Au milieu à gauche'],
  ['center', 'center', 'Centre'],
  ['right', 'center', 'Au milieu à droite'],
  ['left', 'bottom', 'En bas à gauche'],
  ['center', 'bottom', 'En bas au centre'],
  ['right', 'bottom', 'En bas à droite'],
]

function PositionPopover() {
  const productId = useDesignStore((s) => s.design.productId)
  const layer = useActiveLogo()
  if (!layer) return null
  const update = (patch: Parameters<Updater>[1]) => useDesignStore.getState().updateTransform(layer.id, patch)
  const garment = getGarment(productId)
  const p = layer.placement
  const preset = garment.placements.find((x) => x.id === p.placement) ?? garment.placements[0]
  const area = garment.printAreas[preset.side]
  return (
    <>
      <div className="popover-head">
        <strong>Position</strong>
        <span className="muted">Alignez dans la zone imprimable.</span>
      </div>
      <button type="button" className={`lock-btn ${p.locked ? 'is-active' : ''}`} aria-pressed={p.locked} onClick={() => update({ locked: !p.locked })}>
        {p.locked ? <Lock size={15} aria-hidden /> : <Unlock size={15} aria-hidden />}
        {p.locked ? 'Déverrouiller la position' : 'Verrouiller la position'}
      </button>
      <div className="align-grid" role="group" aria-label="Aligner le logo">
        {GRID.map(([ax, ay, label]) => (
          <button
            key={label}
            type="button"
            className="align-cell"
            aria-label={label}
            data-tip={label}
            disabled={p.locked}
            onClick={() => update(alignOffsets(p, logoAspect(layer.asset), area, preset.anchor, ax, ay))}
          >
            <span className={`align-dot align-${ax}-${ay}`} aria-hidden />
          </button>
        ))}
      </div>
    </>
  )
}

function TransformPopover() {
  const layer = useActiveLogo()
  if (!layer) return null
  const p = layer.placement
  const update = (patch: Parameters<Updater>[1], opts?: Parameters<Updater>[2]) => useDesignStore.getState().updateTransform(layer.id, patch, opts)
  const reset = () => useDesignStore.getState().resetTransform(layer.id)
  const pct = ((p.rotationDeg + 180) / 360) * 100
  return (
    <>
      <div className="popover-head">
        <strong>Transformer</strong>
      </div>
      <label className="popover-row">
        <span>Rotation</span>
        <input
          type="range"
          className="range"
          min={-180}
          max={180}
          step={1}
          value={p.rotationDeg}
          disabled={p.locked}
          style={{ ['--pct' as string]: `${pct}%` }}
          onChange={(e) => update({ rotationDeg: Number(e.target.value) }, { coalesce: 'rotation' })}
        />
        <span className="popover-value">{p.rotationDeg}°</span>
      </label>
      <div className="flip-row">
        <button type="button" className={`flip-btn ${p.flipX ? 'is-active' : ''}`} aria-pressed={p.flipX} onClick={() => update({ flipX: !p.flipX })}>
          <FlipHorizontal2 size={15} aria-hidden /> Miroir horizontal
        </button>
        <button type="button" className={`flip-btn ${p.flipY ? 'is-active' : ''}`} aria-pressed={p.flipY} onClick={() => update({ flipY: !p.flipY })}>
          <FlipVertical2 size={15} aria-hidden /> Miroir vertical
        </button>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
        <RotateCcw size={14} aria-hidden /> Réinitialiser les transformations
      </button>
    </>
  )
}
