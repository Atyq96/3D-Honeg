import { useMemo, useState } from 'react'
import { Ban, Search } from 'lucide-react'
import { CATEGORY_LABELS, PATTERNS, svgDataUrl, tileSvg, type PatternCategory, type PatternDef } from '../../patterns/library'

interface Props {
  /** Currently applied pattern id on this zone, or null. */
  selected: string | null
  ink: string
  bg: string
  onPick: (def: PatternDef) => void
  onClear: () => void
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as PatternCategory[]

/** Searchable, filterable grid of live pattern swatches (ink on the zone's fabric colour). */
export function PatternLibrary({ selected, ink, bg, onPick, onClear }: Props) {
  const [category, setCategory] = useState<PatternCategory | 'all'>('all')
  const [query, setQuery] = useState('')

  const thumbs = useMemo(() => {
    const out = new Map<string, string>()
    for (const d of PATTERNS) out.set(d.id, svgDataUrl(tileSvg(d, { color: ink, bg, density: 0.5, seed: 42, opacity: 1 }, 48)))
    return out
  }, [ink, bg])

  const q = query.trim().toLowerCase()
  const visible = PATTERNS.filter(
    (d) => (category === 'all' || d.category === category) && (!q || d.name.toLowerCase().includes(q) || d.category.includes(q)),
  )

  return (
    <div className="pattern-library">
      <label className="pattern-search">
        <Search size={15} aria-hidden />
        <span className="sr-only">Search patterns</span>
        <input
          type="search"
          placeholder={`Search ${PATTERNS.length} patterns`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            // Search spans the whole library rather than the active category.
            if (e.target.value) setCategory('all')
          }}
        />
      </label>

      <div className="chips" role="group" aria-label="Pattern category">
        {(['all', ...CATEGORIES] as const).map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
            {c === 'all' ? 'All' : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="pattern-grid" role="radiogroup" aria-label="Pattern">
        <button type="button" role="radio" aria-checked={selected === null} className="pattern-tile" onClick={onClear}>
          <span className="pattern-thumb pattern-none" style={{ background: bg }} aria-hidden>
            <Ban size={18} />
          </span>
          <span className="pattern-name">None</span>
        </button>
        {visible.map((d) => {
          const [w, h] = d.tile
          return (
            <button key={d.id} type="button" role="radio" aria-checked={selected === d.id} className="pattern-tile" onClick={() => onPick(d)}>
              <span
                className="pattern-thumb"
                aria-hidden
                style={{ backgroundImage: `url("${thumbs.get(d.id)}")`, backgroundSize: `22px ${(22 * h) / w}px`, backgroundColor: bg }}
              />
              <span className="pattern-name">{d.name}</span>
            </button>
          )
        })}
        {!visible.length && <p className="muted pattern-empty">No patterns match “{query}”.</p>}
      </div>
    </div>
  )
}
