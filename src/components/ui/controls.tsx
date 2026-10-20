import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type KeyboardEvent } from 'react'
import { fr } from '../../lib/format'

/* ------------------------------------------------------------------ */
/* Icon button with tooltip                                            */
/* ------------------------------------------------------------------ */

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  tip?: string
  tipSide?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
}

export function IconButton({ label, tip, tipSide = 'bottom', className = '', children, ...rest }: IconButtonProps) {
  return (
    <button type="button" aria-label={label} data-tip={tip ?? label} data-tip-side={tipSide} className={`icon-btn ${className}`} {...rest}>
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Segmented control (radio group with roving focus)                    */
/* ------------------------------------------------------------------ */

export interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
  disabled?: boolean
  title?: string
}

interface SegmentedProps<T extends string> {
  label: string
  value: T | null
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}

export function Segmented<T extends string>({ label, value, options, onChange, size = 'md', className = '' }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const enabled = options.filter((o) => !o.disabled)
  const onKey = (e: KeyboardEvent, index: number) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const pos = enabled.indexOf(options[index])
    const next = enabled[(pos + dir + enabled.length) % enabled.length]
    onChange(next.value)
    refs.current[options.indexOf(next)]?.focus()
  }
  const focusable = value !== null && options.some((o) => o.value === value) ? value : enabled[0]?.value
  return (
    <div role="radiogroup" aria-label={label} className={`segmented segmented-${size} ${className}`}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === focusable ? 0 : -1}
          disabled={o.disabled}
          title={o.title}
          className="segment"
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Slider + numeric input                                              */
/* ------------------------------------------------------------------ */

interface RangeFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  icon?: ReactNode
  disabled?: boolean
  hint?: string
  /** `dragging` is true for slider moves so callers can coalesce undo history. */
  onChange: (value: number, dragging: boolean) => void
}

export function RangeField({ label, value, min, max, step, unit, icon, disabled, hint, onChange }: RangeFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 50
  const commitDraft = () => {
    if (draft === null) return
    const n = parseFloat(draft.replace(',', '.'))
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)), false)
    setDraft(null)
  }
  return (
    <div className={`range-field ${disabled ? 'is-disabled' : ''}`}>
      <div className="range-head">
        <label htmlFor={`${id}-range`} className="field-label">
          {icon}
          {label}
        </label>
        <div className="range-number">
          <input
            aria-label={`${label} (${unit})`}
            inputMode="decimal"
            disabled={disabled}
            value={draft ?? fr(value)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraft()
              if (e.key === 'Escape') setDraft(null)
            }}
          />
          <span aria-hidden>{unit}</span>
        </div>
      </div>
      <input
        id={`${id}-range`}
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled || min === max}
        aria-valuetext={`${fr(value)} ${unit}`}
        style={{ ['--pct' as string]: `${pct}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value), true)}
      />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Switch                                                              */
/* ------------------------------------------------------------------ */

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId()
  return (
    <div className="switch-row">
      <div>
        <span id={`${id}-l`} className="switch-label">
          {label}
        </span>
        {description && <span className="switch-desc">{description}</span>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-l`} className="switch" onClick={() => onChange(!checked)}>
        <span className="switch-thumb" />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Dropdown menu                                                       */
/* ------------------------------------------------------------------ */

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  hint?: string
}

export function Menu({ trigger, items, align = 'end', label }: { trigger: (props: ButtonHTMLAttributes<HTMLButtonElement>) => ReactNode; items: MenuItem[]; align?: 'start' | 'end'; label: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const id = useId()

  useEffect(() => {
    if (!open) return
    itemRefs.current[0]?.focus()
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const onKey = (e: KeyboardEvent) => {
    const idx = itemRefs.current.findIndex((el) => el === document.activeElement)
    if (e.key === 'Escape') {
      setOpen(false)
      ;(root.current?.querySelector('[aria-haspopup]') as HTMLElement | null)?.focus()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = items.length
      itemRefs.current[(idx + (e.key === 'ArrowDown' ? 1 : -1) + n) % n]?.focus()
    } else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div className="menu-root" ref={root} onKeyDown={onKey}>
      {trigger({
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': id,
        onClick: () => setOpen((o) => !o),
      })}
      {open && (
        <div className={`menu menu-${align}`} role="menu" id={id} aria-label={label}>
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              type="button"
              role="menuitem"
              className={`menu-item ${item.danger ? 'is-danger' : ''}`}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.hint && <kbd>{item.hint}</kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Confirm dialog (native <dialog> handles focus trapping + Escape)    */
/* ------------------------------------------------------------------ */

interface ConfirmProps {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onClose }: ConfirmProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="dialog" aria-labelledby={`${id}-t`} onClose={onClose} onCancel={onClose}>
      <h2 id={`${id}-t`}>{title}</h2>
      <p>{body}</p>
      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose} autoFocus>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
