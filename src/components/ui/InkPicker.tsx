import { useState } from 'react'
import { Check } from 'lucide-react'
import { COLOR_PRESETS } from '../../config/palette'
import { isLight, normalizeHex, onColor } from '../../lib/color'

const SWATCHES = [...new Set(['#FFFFFF', '#0E0E0E', ...COLOR_PRESETS.map((p) => p.hex)])]

/** Print colour: HONEG palette swatches plus a live HEX field (logo fill, text colour). */
export function InkPicker({ value, onChange, label, id }: { value: string | null; onChange: (hex: string) => void; label: string; id: string }) {
  const [hex, setHex] = useState(value ?? '')
  return (
    <>
      <div className="fill-swatches" role="radiogroup" aria-label={label}>
        {SWATCHES.map((c) => {
          const name = COLOR_PRESETS.find((p) => p.hex === c)?.name ?? (c === '#FFFFFF' ? 'Blanc' : c === '#0E0E0E' ? 'Noir' : c)
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={value === c}
              aria-label={name}
              title={name}
              className={`swatch swatch-sm ${isLight(c) ? 'is-light' : ''}`}
              style={{ background: c, color: onColor(c) }}
              onClick={() => {
                setHex(c)
                onChange(c)
              }}
            >
              {value === c && <Check size={15} strokeWidth={3} aria-hidden />}
            </button>
          )
        })}
      </div>
      <form
        className="fill-hex"
        onSubmit={(e) => {
          e.preventDefault()
          const n = normalizeHex(hex)
          if (n) onChange(n)
        }}
      >
        <label className="sr-only" htmlFor={id}>
          {label} (HEX)
        </label>
        <span className="fill-hex-swatch" style={{ background: normalizeHex(hex) ?? value ?? 'transparent' }} aria-hidden />
        <input
          id={id}
          value={hex}
          placeholder="#FFFFFF"
          maxLength={9}
          spellCheck={false}
          aria-invalid={hex !== '' && !normalizeHex(hex)}
          onChange={(e) => {
            setHex(e.target.value)
            const n = normalizeHex(e.target.value)
            if (n) onChange(n)
          }}
        />
      </form>
    </>
  )
}
