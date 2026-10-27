import { useMemo, useState } from 'react'
import { Ban, Search } from 'lucide-react'
import { PATTERN_CATEGORIES, PATTERNS, svgDataUrl, tileSvg, type PatternCategory, type PatternDef } from '../../patterns/library'
import { useT } from '../../i18n'

interface Props {
  /** Currently applied pattern id on this zone, or null. */
  selected: string | null
  ink: string
  bg: string
  onPick: (def: PatternDef) => void
  onClear: () => void
}

const CATEGORIES = PATTERN_CATEGORIES
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Searchable, filterable grid of live pattern swatches (ink on the zone's fabric colour). */
export function PatternLibrary({ selected, ink, bg, onPick, onClear }: Props) {
  const [category, setCategory] = useState<PatternCategory | 'all'>('all')
  const m = useT()
  const [query, setQuery] = useState('')

  const thumbs = useMemo(() => {
    const out = new Map<string, string>()
    for (const d of PATTERNS) out.set(d.id, svgDataUrl(tileSvg(d, { color: ink, bg, density: 0.5, seed: 42, opacity: 1 }, 48)))
    return out
  }, [ink, bg])

  // Accent-insensitive, so "ecailles" finds "Écailles"; category names match too.
  const q = fold(query.trim())
  const visible = PATTERNS.filter(
    (d) => (category === 'all' || d.category === category) && (!q || fold(m.pattern.names[d.id] ?? d.id).includes(q) || fold(m.pattern.categories[d.category]).includes(q)),
  )

  return (
    <div className="pattern-library">
      <label className="pattern-search">
        <Search size={15} aria-hidden />
        <span className="sr-only">{m.pattern.search}</span>
        <input
          type="search"
          placeholder={m.pattern.searchPlaceholder(PATTERNS.length)}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            // Search spans the whole library rather than the active category.
            if (e.target.value) setCategory('all')
          }}
        />
      </label>

      <div className="chips" role="group" aria-label={m.pattern.categoryAria}>
        {(['all', ...CATEGORIES] as const).map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
            {c === 'all' ? m.pattern.all : m.pattern.categories[c]}
          </button>
        ))}
      </div>

      <div className="pattern-grid" role="radiogroup" aria-label={m.pattern.aria}>
        <button type="button" role="radio" aria-checked={selected === null} className="pattern-tile" onClick={onClear}>
          <span className="pattern-thumb pattern-none" style={{ background: bg }} aria-hidden>
            <Ban size={18} />
          </span>
          <span className="pattern-name">{m.pattern.none}</span>
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
              <span className="pattern-name">{m.pattern.names[d.id] ?? d.id}</span>
            </button>
          )
        })}
        {!visible.length && <p className="muted pattern-empty">{m.pattern.noMatch(query)}</p>}
      </div>
    </div>
  )
}
