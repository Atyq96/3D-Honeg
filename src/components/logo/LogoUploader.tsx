import { useId, useRef, useState, type DragEvent } from 'react'
import { ChevronDown, ChevronUp, ImagePlus, ImageUp, LoaderCircle, Replace, Trash2, TriangleAlert } from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { editLayer, useActiveLogo } from '../../state/useActiveLogo'
import { MAX_LOGOS, type LogoLayer } from '../../state/design'
import { LOGO_ACCEPT, LogoFileError, MAX_LOGO_BYTES, processLogoFile, type ProcessedLogo } from '../../lib/logoFile'
import { IconButton } from '../ui/controls'
import { t, useT } from '../../i18n'
import { num } from '../../lib/format'

const without = (w: Record<string, string>, key: string) => {
  const next = { ...w }
  delete next[key]
  return next
}

const errorText = (err: unknown) => (err instanceof LogoFileError ? err.message : t().logo.readError)

/**
 * Up to MAX_LOGOS logos or photos: a list to pick which one to edit (with
 * stacking order, replace and remove), plus a drop zone that takes several
 * files at once.
 */
export function LogoUploader() {
  const id = useId()
  const logos = useDesignStore((s) => s.design.logos)
  const images = logos.filter((l) => !l.text)
  const active = useActiveLogo('image')
  const notify = useUiStore((s) => s.notify)
  const m = useT()
  const addInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const replaceTarget = useRef<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<Record<string, string>>({})
  const [dragging, setDragging] = useState(false)
  const room = MAX_LOGOS - images.length
  const presetLabel = (l: LogoLayer) => m.placements[l.placement.placement].label

  /** Processes files one by one and adds each as a new logo, up to the free slots. */
  const add = async (jobs: (() => Promise<ProcessedLogo>)[]) => {
    const free = MAX_LOGOS - useDesignStore.getState().design.logos.filter((l) => !l.text).length
    if (free <= 0) {
      notify('info', t().logo.full(MAX_LOGOS))
      return
    }
    const skipped = jobs.length - free
    setBusy(true)
    setError(null)
    const added: string[] = []
    const errors: string[] = []
    for (const job of jobs.slice(0, free)) {
      try {
        const { asset, warning } = await job()
        const newId = useDesignStore.getState().addLogo(asset)
        if (!newId) break
        added.push(newId)
        if (warning) setWarnings((w) => ({ ...w, [newId]: warning }))
      } catch (err) {
        errors.push(errorText(err))
        if (!(err instanceof LogoFileError)) console.error(err)
      }
    }
    setBusy(false)

    const layers = useDesignStore.getState().design.logos.filter((l) => added.includes(l.id))
    const last = layers[layers.length - 1]
    if (last) {
      // Select it straight away so the on-garment handles and toolbar appear (as in OpenMerch).
      editLayer(last)
      notify('success', layers.length === 1 ? t().logo.addedOne(presetLabel(last)) : t().logo.addedMany(layers.length))
    }
    if (errors.length) {
      setError(errors.join(' '))
      notify('error', errors[0])
    }
    if (skipped > 0) notify('info', t().logo.skipped(MAX_LOGOS, skipped))
  }

  const onFiles = (files: FileList | null) => {
    if (files?.length) void add(Array.from(files).map((f) => () => processLogoFile(f)))
    if (addInput.current) addInput.current.value = ''
  }

  const onReplace = async (file: File | undefined) => {
    const target = replaceTarget.current
    if (replaceInput.current) replaceInput.current.value = ''
    if (!file || !target) return
    setBusy(true)
    setError(null)
    try {
      const { asset, warning } = await processLogoFile(file)
      useDesignStore.getState().replaceLogo(target, asset)
      setWarnings((w) => (warning ? { ...w, [target]: warning } : without(w, target)))
      notify('success', t().logo.replaced)
    } catch (err) {
      setError(errorText(err))
      notify('error', errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = (layer: LogoLayer) => {
    useDesignStore.getState().removeLogo(layer.id)
    setWarnings((w) => without(w, layer.id))
    useUiStore.getState().selectLogo(false)
    notify('info', t().common.removed(layer.asset.name))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    onFiles(e.dataTransfer.files)
  }
  const dropTarget = {
    onDragEnter: (e: DragEvent) => {
      e.preventDefault()
      if (room > 0) setDragging(true)
    },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
    },
    onDrop,
  }

  const inputs = (
    <>
      <input ref={addInput} id={`${id}-file`} type="file" accept={LOGO_ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFiles(e.target.files)} />
      <input ref={replaceInput} type="file" accept={LOGO_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void onReplace(e.target.files?.[0])} />
    </>
  )
  const errorEl = error && (
    <p id={`${id}-err`} className="field-error" role="alert">
      {error}
    </p>
  )

  if (!images.length) {
    return (
      <div>
        {inputs}
        <div className={`dropzone ${dragging ? 'is-dragging' : ''} ${error ? 'is-invalid' : ''}`} {...dropTarget}>
          <span className="dropzone-icon" aria-hidden>
            {busy ? <LoaderCircle size={22} className="spin" /> : <ImageUp size={22} />}
          </span>
          <p className="dropzone-title">{busy ? m.common.processing : m.logo.drop}</p>
          <p className="dropzone-sub">
            {m.logo.formats(Math.round(MAX_LOGO_BYTES / 1024 / 1024), MAX_LOGOS)}
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => addInput.current?.click()} disabled={busy} aria-describedby={error ? `${id}-err` : undefined}>
            {m.logo.choose}
          </button>
        </div>
        {errorEl}
      </div>
    )
  }

  // Listed front-most first, like a layers panel. Stacking is shared with text, so the arrows move past text too.
  const stack = [...images].reverse()
  return (
    <div className={`logo-library ${dragging ? 'is-dragging' : ''}`} {...dropTarget}>
      {inputs}
      <ul className="logo-list" aria-label={m.logo.listAria}>
        {stack.map((layer) => {
          const index = logos.indexOf(layer)
          const isActive = layer.id === active?.id
          const name = layer.asset.name
          return (
            <li key={layer.id} className={`logo-item ${isActive ? 'is-active' : ''}`}>
              <button type="button" className="logo-item-main" aria-pressed={isActive} onClick={() => editLayer(layer)}>
                <span className="logo-item-thumb checker">
                  <img src={layer.asset.dataUrl} alt="" />
                </span>
                <span className="logo-item-text">
                  <strong title={name}>{name}</strong>
                  <span>
                    {presetLabel(layer)} · {num(layer.placement.widthCm)} cm
                  </span>
                </span>
              </button>
              <div className="logo-item-actions">
                {logos.length > 1 && (
                  <>
                    <IconButton
                      label={m.logo.bring(name)}
                      tip={m.common.bringForward}
                      className="icon-btn-sm"
                      disabled={index === logos.length - 1}
                      onClick={() => useDesignStore.getState().moveLogo(layer.id, 1)}
                    >
                      <ChevronUp size={16} />
                    </IconButton>
                    <IconButton
                      label={m.logo.send(name)}
                      tip={m.common.sendBackward}
                      className="icon-btn-sm"
                      disabled={index === 0}
                      onClick={() => useDesignStore.getState().moveLogo(layer.id, -1)}
                    >
                      <ChevronDown size={16} />
                    </IconButton>
                  </>
                )}
                <IconButton
                  label={m.logo.replaceName(name)}
                  tip={m.common.replace}
                  className="icon-btn-sm"
                  disabled={busy}
                  onClick={() => {
                    replaceTarget.current = layer.id
                    replaceInput.current?.click()
                  }}
                >
                  <Replace size={15} />
                </IconButton>
                <IconButton label={m.logo.removeName(name)} tip={m.common.remove} tipSide="left" className="icon-btn-sm is-danger" onClick={() => remove(layer)}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
              {warnings[layer.id] && (
                <p className="logo-warning">
                  <TriangleAlert size={14} aria-hidden /> {warnings[layer.id]}
                </p>
              )}
            </li>
          )
        })}
      </ul>
      {room > 0 ? (
        <button type="button" className="logo-add" onClick={() => addInput.current?.click()} disabled={busy}>
          {busy ? <LoaderCircle size={16} className="spin" aria-hidden /> : <ImagePlus size={16} aria-hidden />}
          <span>{busy ? m.common.processing : dragging ? m.logo.dropToAdd : m.logo.add}</span>
          <span className="logo-add-count">
            {m.common.ofMax(images.length, MAX_LOGOS)}
          </span>
        </button>
      ) : (
        <p className="logo-limit">
          {m.common.allUsed(MAX_LOGOS)}
        </p>
      )}
      {errorEl}
    </div>
  )
}
