import { useId, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { Check, RotateCcw } from 'lucide-react'
import { COLOR_PRESETS, presetName } from '../../config/palette'
import { hexError, isLight, normalizeHex, onColor } from '../../lib/color'
import { useT } from '../../i18n'

interface Props {
  /** Accessible name for the colour being edited, e.g. "Body". */
  label: string
  value: string
  defaultValue: string
  /** `dragging` = continuous picker drag, so undo can coalesce it into one step. */
  onChange: (hex: string, dragging: boolean) => void
  /** Presets + HEX only (no summary row or visual picker), for secondary colours. */
  compact?: boolean
}

/**
 * One colour value, three synchronised inputs: presets, a visual picker and a
 * validated HEX field. They all read from and write to the same `value`.
 */
export function ShirtColorPicker({ label, value, defaultValue, onChange, compact = false }: Props) {
  const id = useId()
  const m = useT()
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const name = presetName(value)

  const onHexInput = (raw: string) => {
    setDraft(raw)
    const hex = normalizeHex(raw)
    if (hex) {
      setError(null)
      onChange(hex, false)
      return
    }
    // Only flag errors that can't be fixed by typing more characters.
    const body = raw.trim().replace(/^#/, '')
    setError(/[^0-9a-f]/i.test(body) || body.length > 6 ? hexError(raw) : null)
  }

  const onHexBlur = () => {
    if (draft === null) return
    const err = hexError(draft)
    if (err) setError(err)
    else {
      setDraft(null)
      setError(null)
    }
  }

  const choose = (hex: string) => {
    setDraft(null)
    setError(null)
    onChange(hex, false)
  }

  return (
    <div className={`color-editor ${compact ? 'is-compact' : ''}`}>
      {!compact && (
      <div className="color-current">
        <span className={`color-current-swatch ${isLight(value) ? 'is-light' : ''}`} style={{ background: value }} aria-hidden />
        <div className="color-current-text">
          <span className="color-current-name">{name ?? m.color.customColor}</span>
          <code className="color-current-hex">{value}</code>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => choose(defaultValue)} disabled={value === defaultValue}>
          <RotateCcw size={14} aria-hidden /> {m.color.default}
        </button>
      </div>
      )}

      <div className="field">
        <span className="field-label" id={`${id}-presets`}>
          {compact ? m.color.compactLabel(label) : m.color.presets}
        </span>
        <div className="swatches" role="radiogroup" aria-labelledby={`${id}-presets`}>
          {COLOR_PRESETS.map((p) => {
            const selected = p.hex === value
            return (
              <button
                key={p.hex}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${presetName(p.hex)}, ${p.hex}`}
                data-tip={presetName(p.hex) ?? p.hex}
                className={`swatch ${isLight(p.hex) ? 'is-light' : ''}`}
                style={{ background: p.hex, color: onColor(p.hex) }}
                onClick={() => choose(p.hex)}
              >
                {selected && <Check size={16} strokeWidth={3} aria-hidden />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="field">
        {!compact && <span className="field-label">{m.color.customLabel}</span>}
        {!compact && (
          <div className="picker" aria-label={m.color.pickerAria(label)}>
            <HexColorPicker
              color={value}
              onChange={(c) => {
                setDraft(null)
                setError(null)
                onChange(normalizeHex(c) ?? value, true)
              }}
            />
          </div>
        )}
        <div className={`hex-input ${error ? 'is-invalid' : ''}`}>
          <label htmlFor={`${id}-hex`} className="sr-only">
            {m.color.hexLabel(label)}
          </label>
          <span className="hex-input-swatch" style={{ background: value }} aria-hidden />
          <input
            id={`${id}-hex`}
            value={draft ?? value}
            spellCheck={false}
            autoComplete="off"
            maxLength={9}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-err` : `${id}-help`}
            onChange={(e) => onHexInput(e.target.value)}
            onBlur={onHexBlur}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setDraft(null)
                setError(null)
              }
            }}
          />
        </div>
        {error ? (
          <p id={`${id}-err`} className="field-error" role="alert">
            {error}
          </p>
        ) : (
          <p id={`${id}-help`} className="field-hint">
            {m.color.hexHelp}
          </p>
        )}
      </div>
    </div>
  )
}
