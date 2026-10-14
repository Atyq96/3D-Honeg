import { useId, useRef, useState, type DragEvent } from 'react'
import { ImageUp, LoaderCircle, Replace, Sparkles, Trash2, TriangleAlert } from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { getGarment } from '../../garments/catalog'
import { fetchSampleLogo, formatBytes, LOGO_ACCEPT, LogoFileError, MAX_LOGO_BYTES, processLogoFile, type ProcessedLogo } from '../../lib/logoFile'

export function LogoUploader() {
  const id = useId()
  const logo = useDesignStore((s) => s.design.logo)
  const setLogo = useDesignStore((s) => s.setLogo)
  const notify = useUiStore((s) => s.notify)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const run = async (work: () => Promise<ProcessedLogo>) => {
    setBusy(true)
    setError(null)
    try {
      const { asset, warning: w } = await work()
      setWarning(w)
      setLogo(asset)
      const design = useDesignStore.getState().design
      const preset = getGarment(design.productId).placements.find((p) => p.id === design.placement.placement)
      useUiStore.getState().setView(design.placement.side)
      // Select it straight away so the on-garment handles and toolbar appear (as in OpenMerch).
      useUiStore.getState().selectLogo(true)
      notify('success', `Logo placed: ${preset?.label.toLowerCase() ?? 'on the shirt'}.`)
    } catch (err) {
      const message = err instanceof LogoFileError ? err.message : "Something went wrong while reading this file. Try another one."
      setError(message)
      notify('error', message)
      if (!(err instanceof LogoFileError)) console.error(err)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return
    if (files.length > 1) notify('info', 'Only the first file was used.')
    void run(() => processLogoFile(files[0]))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    onFiles(e.dataTransfer.files)
  }

  const hiddenInput = (
    <input
      ref={input}
      id={`${id}-file`}
      type="file"
      accept={LOGO_ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => onFiles(e.target.files)}
    />
  )

  if (logo) {
    return (
      <div className="logo-card" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        {hiddenInput}
        <div className="logo-thumb checker">
          <img src={logo.dataUrl} alt={`Uploaded logo ${logo.name}`} />
        </div>
        <div className="logo-meta">
          <strong title={logo.name}>{logo.name}</strong>
          <span>
            {logo.width}×{logo.height}px{logo.bytes ? ` · ${formatBytes(logo.bytes)}` : ''}
          </span>
          {warning && (
            <span className="logo-warning">
              <TriangleAlert size={14} aria-hidden /> {warning}
            </span>
          )}
          <div className="logo-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()} disabled={busy}>
              {busy ? <LoaderCircle size={15} className="spin" aria-hidden /> : <Replace size={15} aria-hidden />} Replace
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm is-danger"
              onClick={() => {
                setLogo(null)
                setWarning(null)
                useUiStore.getState().selectLogo(false)
                notify('info', 'Logo removed.')
              }}
            >
              <Trash2 size={15} aria-hidden /> Remove
            </button>
          </div>
        </div>
        {error && (
          <p className="field-error logo-card-error" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      {hiddenInput}
      <div
        className={`dropzone ${dragging ? 'is-dragging' : ''} ${error ? 'is-invalid' : ''}`}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
        }}
        onDrop={onDrop}
      >
        <span className="dropzone-icon" aria-hidden>
          {busy ? <LoaderCircle size={22} className="spin" /> : <ImageUp size={22} />}
        </span>
        <p className="dropzone-title">{busy ? 'Processing your logo…' : 'Drop your logo here'}</p>
        <p className="dropzone-sub">
          PNG (transparency kept), JPG or SVG · up to {Math.round(MAX_LOGO_BYTES / 1024 / 1024)} MB
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => input.current?.click()} disabled={busy} aria-describedby={error ? `${id}-err` : undefined}>
          Choose file
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="sample-row">
        <Sparkles size={14} aria-hidden />
        <span>No logo handy? Try</span>
        <button type="button" className="link-btn" disabled={busy} onClick={() => void run(() => fetchSampleLogo('/brand/honeg-logo-black.png', 'honeg-logo-black.png'))}>
          HONEG black
        </button>
        <span aria-hidden>·</span>
        <button type="button" className="link-btn" disabled={busy} onClick={() => void run(() => fetchSampleLogo('/brand/honeg-logo-white.png', 'honeg-logo-white.png'))}>
          HONEG white
        </button>
      </div>
    </div>
  )
}
