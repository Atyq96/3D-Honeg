import { useId, useRef, useState, type DragEvent } from 'react'
import { ChevronDown, ChevronUp, ImagePlus, ImageUp, LoaderCircle, Replace, Sparkles, Trash2, TriangleAlert } from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { useActiveLogo } from '../../state/useActiveLogo'
import { MAX_LOGOS, type LogoLayer } from '../../state/design'
import { getGarment } from '../../garments/catalog'
import { fetchSampleLogo, LOGO_ACCEPT, LogoFileError, MAX_LOGO_BYTES, processLogoFile, type ProcessedLogo } from '../../lib/logoFile'
import { IconButton } from '../ui/controls'

const without = (w: Record<string, string>, key: string) => {
  const next = { ...w }
  delete next[key]
  return next
}

const errorText = (err: unknown) => (err instanceof LogoFileError ? err.message : 'Something went wrong while reading this file. Try another one.')

/** Makes a logo the one being edited, shows its handles and turns the camera to its side. */
function focusLogo(layer: LogoLayer) {
  useUiStore.getState().setActiveLogo(layer.id, true)
  useUiStore.getState().setView(layer.placement.side)
}

/**
 * Up to MAX_LOGOS logos or photos: a list to pick which one to edit (with
 * stacking order, replace and remove), plus a drop zone that takes several
 * files at once.
 */
export function LogoUploader() {
  const id = useId()
  const logos = useDesignStore((s) => s.design.logos)
  const productId = useDesignStore((s) => s.design.productId)
  const active = useActiveLogo()
  const notify = useUiStore((s) => s.notify)
  const addInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const replaceTarget = useRef<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<Record<string, string>>({})
  const [dragging, setDragging] = useState(false)
  const room = MAX_LOGOS - logos.length
  const garment = getGarment(productId)
  const presetLabel = (l: LogoLayer) => garment.placements.find((p) => p.id === l.placement.placement)?.label ?? ''

  /** Processes files one by one and adds each as a new logo, up to the free slots. */
  const add = async (jobs: (() => Promise<ProcessedLogo>)[]) => {
    const free = MAX_LOGOS - useDesignStore.getState().design.logos.length
    if (free <= 0) {
      notify('info', `A garment carries up to ${MAX_LOGOS} logos or photos. Remove one to add another.`)
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
      focusLogo(last)
      notify('success', layers.length === 1 ? `Added on the ${presetLabel(last).toLowerCase()}.` : `${layers.length} images added — each on its own print position.`)
    }
    if (errors.length) {
      setError(errors.join(' '))
      notify('error', errors[0])
    }
    if (skipped > 0) notify('info', `Only ${MAX_LOGOS} logos or photos per garment — ${skipped} file${skipped > 1 ? 's were' : ' was'} not added.`)
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
      notify('success', 'Image replaced — position and size kept.')
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
    if (!useDesignStore.getState().design.logos.length) useUiStore.getState().selectLogo(false)
    notify('info', `Removed “${layer.asset.name}”. Undo to bring it back.`)
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

  if (!logos.length) {
    return (
      <div>
        {inputs}
        <div className={`dropzone ${dragging ? 'is-dragging' : ''} ${error ? 'is-invalid' : ''}`} {...dropTarget}>
          <span className="dropzone-icon" aria-hidden>
            {busy ? <LoaderCircle size={22} className="spin" /> : <ImageUp size={22} />}
          </span>
          <p className="dropzone-title">{busy ? 'Processing…' : 'Drop logos or photos here'}</p>
          <p className="dropzone-sub">
            PNG (transparency kept), JPG, WebP or SVG · up to {Math.round(MAX_LOGO_BYTES / 1024 / 1024)} MB each · {MAX_LOGOS} max
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => addInput.current?.click()} disabled={busy} aria-describedby={error ? `${id}-err` : undefined}>
            Choose files
          </button>
        </div>
        {errorEl}
        <div className="sample-row">
          <Sparkles size={14} aria-hidden />
          <span>No logo handy? Try</span>
          <button type="button" className="link-btn" disabled={busy} onClick={() => void add([() => fetchSampleLogo('/brand/honeg-logo-black.png', 'honeg-logo-black.png')])}>
            HONEG black
          </button>
          <span aria-hidden>·</span>
          <button type="button" className="link-btn" disabled={busy} onClick={() => void add([() => fetchSampleLogo('/brand/honeg-logo-white.png', 'honeg-logo-white.png')])}>
            HONEG white
          </button>
        </div>
      </div>
    )
  }

  // Listed front-most first, like a layers panel.
  const stack = [...logos].reverse()
  return (
    <div className={`logo-library ${dragging ? 'is-dragging' : ''}`} {...dropTarget}>
      {inputs}
      <ul className="logo-list" aria-label="Your logos and photos">
        {stack.map((layer) => {
          const index = logos.indexOf(layer)
          const isActive = layer.id === active?.id
          const name = layer.asset.name
          return (
            <li key={layer.id} className={`logo-item ${isActive ? 'is-active' : ''}`}>
              <button type="button" className="logo-item-main" aria-pressed={isActive} onClick={() => focusLogo(layer)}>
                <span className="logo-item-thumb checker">
                  <img src={layer.asset.dataUrl} alt="" />
                </span>
                <span className="logo-item-text">
                  <strong title={name}>{name}</strong>
                  <span>
                    {presetLabel(layer)} · {layer.placement.widthCm} cm
                  </span>
                </span>
              </button>
              <div className="logo-item-actions">
                {logos.length > 1 && (
                  <>
                    <IconButton
                      label={`Bring ${name} forward`}
                      tip="Bring forward"
                      className="icon-btn-sm"
                      disabled={index === logos.length - 1}
                      onClick={() => useDesignStore.getState().moveLogo(layer.id, 1)}
                    >
                      <ChevronUp size={16} />
                    </IconButton>
                    <IconButton
                      label={`Send ${name} backward`}
                      tip="Send backward"
                      className="icon-btn-sm"
                      disabled={index === 0}
                      onClick={() => useDesignStore.getState().moveLogo(layer.id, -1)}
                    >
                      <ChevronDown size={16} />
                    </IconButton>
                  </>
                )}
                <IconButton
                  label={`Replace ${name}`}
                  tip="Replace"
                  className="icon-btn-sm"
                  disabled={busy}
                  onClick={() => {
                    replaceTarget.current = layer.id
                    replaceInput.current?.click()
                  }}
                >
                  <Replace size={15} />
                </IconButton>
                <IconButton label={`Remove ${name}`} tip="Remove" tipSide="left" className="icon-btn-sm is-danger" onClick={() => remove(layer)}>
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
          <span>{busy ? 'Processing…' : dragging ? 'Drop to add' : 'Add a logo or photo'}</span>
          <span className="logo-add-count">
            {logos.length} of {MAX_LOGOS}
          </span>
        </button>
      ) : (
        <p className="logo-limit">
          {MAX_LOGOS} of {MAX_LOGOS} used — remove one to add another.
        </p>
      )}
      {errorEl}
    </div>
  )
}
