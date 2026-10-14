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
  Unlock,
} from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { logoAspect } from '../../state/design'
import { getGarment } from '../../garments/catalog'
import { COLOR_PRESETS } from '../../config/palette'
import { isLight, normalizeHex, onColor } from '../../lib/color'
import { alignOffsets, type AlignX, type AlignY } from '../../lib/logoTransform'
import { LOGO_ACCEPT, LogoFileError, processLogoFile } from '../../lib/logoFile'

type PopoverName = 'fill' | 'position' | 'transform' | null

/**
 * Contextual toolbar shown while the logo is selected — modelled on the
 * OpenMerch editor's ImageToolbar: replace, fill colour, opacity, position
 * (align grid + lock), transform (rotate, flip, reset) and delete.
 */
export function LogoToolbar() {
  const selected = useUiStore((s) => s.logoSelected)
  const logo = useDesignStore((s) => s.design.logo)
  const placement = useDesignStore((s) => s.design.placement)
  const update = useDesignStore((s) => s.updateTransform)
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

  if (!selected || !logo) return null

  const toggle = (name: PopoverName) => setOpen((o) => (o === name ? null : name))
  const notify = useUiStore.getState().notify

  const replace = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const { asset, warning } = await processLogoFile(file)
      useDesignStore.getState().setLogo(asset)
      notify(warning ? 'info' : 'success', warning ?? 'Logo replaced — position and size kept.')
    } catch (err) {
      notify('error', err instanceof LogoFileError ? err.message : "That file couldn't be used.")
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const remove = () => {
    useDesignStore.getState().setLogo(null)
    useUiStore.getState().selectLogo(false)
    notify('info', 'Logo removed. Undo to bring it back.')
  }

  return (
    <div className="logo-toolbar" ref={root} role="toolbar" aria-label="Logo tools">
      <input ref={fileInput} type="file" accept={LOGO_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void replace(e.target.files?.[0])} />

      <ToolButton label="Replace image" onClick={() => fileInput.current?.click()} disabled={busy}>
        {busy ? <LoaderCircle size={17} className="spin" /> : <ImagePlus size={17} />}
      </ToolButton>

      <PopoverAnchor open={open === 'fill'} label="Fill color" popover={<FillPopover />}>
        <ToolButton label="Fill color" onClick={() => toggle('fill')} expanded={open === 'fill'} active={open === 'fill' || !!placement.tint}>
          <Paintbrush size={17} />
          {placement.tint && <span className={`tool-dot ${isLight(placement.tint) ? 'is-light' : ''}`} style={{ background: placement.tint }} aria-hidden />}
        </ToolButton>
      </PopoverAnchor>

      <span className="tool-divider" aria-hidden />

      <label className="tool-opacity" data-tip="Opacity">
        <span className="sr-only">Opacity</span>
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

      <PopoverAnchor open={open === 'transform'} label="Transform" popover={<TransformPopover />}>
        <ToolButton label="Transform" onClick={() => toggle('transform')} expanded={open === 'transform'} active={open === 'transform'}>
          <BoxSelect size={17} />
        </ToolButton>
      </PopoverAnchor>

      <span className="tool-divider" aria-hidden />

      <ToolButton label="Delete logo" onClick={remove} danger>
        <Trash2 size={17} />
      </ToolButton>
      <ToolButton label="Done" onClick={() => useUiStore.getState().selectLogo(false)}>
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
  const tint = useDesignStore((s) => s.design.placement.tint)
  const update = useDesignStore((s) => s.updateTransform)
  const [hex, setHex] = useState(tint ?? '')
  const apply = (value: string | null) => update({ tint: value })
  const swatches = [...new Set(['#FFFFFF', '#0E0E0E', ...COLOR_PRESETS.map((p) => p.hex)])]
  return (
    <>
      <div className="popover-head">
        <strong>Fill color</strong>
        <span className="muted">Recolors every visible pixel of the logo.</span>
      </div>
      <button type="button" className={`fill-original ${tint === null ? 'is-active' : ''}`} onClick={() => apply(null)}>
        Original colors
      </button>
      <div className="fill-swatches" role="radiogroup" aria-label="Fill color">
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={tint === c}
            aria-label={COLOR_PRESETS.find((p) => p.hex === c)?.name ?? c}
            title={COLOR_PRESETS.find((p) => p.hex === c)?.name ?? c}
            className={`swatch swatch-sm ${isLight(c) ? 'is-light' : ''}`}
            style={{ background: c, color: onColor(c) }}
            onClick={() => {
              setHex(c)
              apply(c)
            }}
          >
            {tint === c && <Check size={15} strokeWidth={3} aria-hidden />}
          </button>
        ))}
      </div>
      <form
        className="fill-hex"
        onSubmit={(e) => {
          e.preventDefault()
          const n = normalizeHex(hex)
          if (n) apply(n)
        }}
      >
        <label className="sr-only" htmlFor="fill-hex">
          Fill HEX
        </label>
        <span className="fill-hex-swatch" style={{ background: normalizeHex(hex) ?? tint ?? 'transparent' }} aria-hidden />
        <input
          id="fill-hex"
          value={hex}
          placeholder="#FFFFFF"
          maxLength={9}
          spellCheck={false}
          aria-invalid={hex !== '' && !normalizeHex(hex)}
          onChange={(e) => {
            setHex(e.target.value)
            const n = normalizeHex(e.target.value)
            if (n) apply(n)
          }}
        />
      </form>
    </>
  )
}

const GRID: [AlignX, AlignY, string][] = [
  ['left', 'top', 'Top left'],
  ['center', 'top', 'Top center'],
  ['right', 'top', 'Top right'],
  ['left', 'center', 'Middle left'],
  ['center', 'center', 'Center'],
  ['right', 'center', 'Middle right'],
  ['left', 'bottom', 'Bottom left'],
  ['center', 'bottom', 'Bottom center'],
  ['right', 'bottom', 'Bottom right'],
]

function PositionPopover() {
  const design = useDesignStore((s) => s.design)
  const update = useDesignStore((s) => s.updateTransform)
  const garment = getGarment(design.productId)
  const p = design.placement
  const preset = garment.placements.find((x) => x.id === p.placement) ?? garment.placements[0]
  const area = garment.printAreas[preset.side]
  return (
    <>
      <div className="popover-head">
        <strong>Position</strong>
        <span className="muted">Align within the printable area.</span>
      </div>
      <button type="button" className={`lock-btn ${p.locked ? 'is-active' : ''}`} aria-pressed={p.locked} onClick={() => update({ locked: !p.locked })}>
        {p.locked ? <Lock size={15} aria-hidden /> : <Unlock size={15} aria-hidden />}
        {p.locked ? 'Unlock position' : 'Lock position'}
      </button>
      <div className="align-grid" role="group" aria-label="Align logo">
        {GRID.map(([ax, ay, label]) => (
          <button
            key={label}
            type="button"
            className="align-cell"
            aria-label={label}
            data-tip={label}
            disabled={p.locked}
            onClick={() => update(alignOffsets(p, logoAspect(design), area, preset.anchor, ax, ay))}
          >
            <span className={`align-dot align-${ax}-${ay}`} aria-hidden />
          </button>
        ))}
      </div>
    </>
  )
}

function TransformPopover() {
  const p = useDesignStore((s) => s.design.placement)
  const update = useDesignStore((s) => s.updateTransform)
  const reset = useDesignStore((s) => s.resetTransform)
  const pct = ((p.rotationDeg + 180) / 360) * 100
  return (
    <>
      <div className="popover-head">
        <strong>Transform</strong>
      </div>
      <label className="popover-row">
        <span>Rotate</span>
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
          <FlipHorizontal2 size={15} aria-hidden /> Flip horizontal
        </button>
        <button type="button" className={`flip-btn ${p.flipY ? 'is-active' : ''}`} aria-pressed={p.flipY} onClick={() => update({ flipY: !p.flipY })}>
          <FlipVertical2 size={15} aria-hidden /> Flip vertical
        </button>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
        <RotateCcw size={14} aria-hidden /> Reset all transforms
      </button>
    </>
  )
}
