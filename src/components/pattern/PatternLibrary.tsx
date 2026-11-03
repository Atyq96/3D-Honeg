import { useEffect, useReducer, useState } from 'react'
import { Ban, Search } from 'lucide-react'
import { PRESETS, SPORTS, type Preset, type Sport } from '../../patterns'
import { loadPresetThumbs, presetThumb } from '../../state/patternArt'
import { presetLabel } from '../../i18n/labels'
import { useT } from '../../i18n'

interface Props {
  /** Preset applied to this zone, or null. */
  selected: string | null
  onPick: (preset: Preset) => void
  onClear: () => void
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** The ready-made designs, by sport, with live thumbnails. */
export function PatternLibrary({ selected, onPick, onClear }: Props) {
  const m = useT()
  const [sport, setSport] = useState<Sport | 'all'>('all')
  const [query, setQuery] = useState('')
  // Thumbnails arrive in small batches; each batch re-renders the grid.
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  useEffect(() => loadPresetThumbs(PRESETS, refresh), [])

  // Accent-insensitive, so "eclats" finds "Éclats"; sport and type names match too.
  const q = fold(query.trim())
  const visible = PRESETS.filter(
    (p) => (sport === 'all' || p.sport === sport) && (!q || [presetLabel(p.id), m.pattern.sports[p.sport], m.pattern.types[p.type]].some((s) => fold(s).includes(q))),
  )

  return (
    <div className="pattern-library">
      <label className="pattern-search">
        <Search size={15} aria-hidden />
        <span className="sr-only">{m.pattern.search}</span>
        <input
          type="search"
          placeholder={m.pattern.searchPlaceholder(PRESETS.length)}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            // Search spans the whole library rather than the active sport.
            if (e.target.value) setSport('all')
          }}
        />
      </label>

      <div className="chips" role="group" aria-label={m.pattern.sportAria}>
        {(['all', ...SPORTS] as const).map((s) => (
          <button key={s} type="button" className="chip" aria-pressed={sport === s} onClick={() => setSport(s)}>
            {s === 'all' ? m.pattern.all : m.pattern.sports[s]}
          </button>
        ))}
      </div>

      <div className="pattern-grid" role="radiogroup" aria-label={m.pattern.aria}>
        <button type="button" role="radio" aria-checked={selected === null} className="pattern-tile" onClick={onClear}>
          <span className="pattern-thumb pattern-none" aria-hidden>
            <Ban size={18} />
          </span>
          <span className="pattern-name">{m.pattern.none}</span>
        </button>
        {visible.map((p) => {
          const thumb = presetThumb(p.id)
          return (
            <button key={p.id} type="button" role="radio" aria-checked={selected === p.id} className="pattern-tile" onClick={() => onPick(p)} title={presetLabel(p.id)}>
              <span
                className={`pattern-thumb ${thumb ? '' : 'is-loading'}`}
                aria-hidden
                style={thumb ? { backgroundImage: `url("${thumb}")`, backgroundSize: 'cover' } : { background: p.colors[0] }}
              />
              <span className="pattern-name">{presetLabel(p.id)}</span>
            </button>
          )
        })}
        {!visible.length && <p className="muted pattern-empty">{m.pattern.noMatch(query)}</p>}
      </div>
    </div>
  )
}
