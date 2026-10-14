import type { PlacementPreset, Side } from '../../garments/types'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { getGarment } from '../../garments/catalog'
import { Segmented } from '../ui/controls'

/** Tiny tee glyph with the placement marked, so presets are recognisable at a glance. */
function PlacementGlyph({ preset }: { preset: PlacementPreset }) {
  // Map garment metres (x ±0.3, y 0–0.72) into a 40×40 glyph.
  const x = 20 + preset.anchor[0] * 52
  const y = 38 - preset.anchor[1] * 46
  const w = Math.max(3.5, preset.defaultWidth * 52)
  return (
    <svg viewBox="0 0 40 40" className="placement-glyph" aria-hidden>
      <path
        d="M14 4.5 L9 6.5 L2.5 12.5 L6.5 18 L9.5 16 L9.5 37 L30.5 37 L30.5 16 L33.5 18 L37.5 12.5 L31 6.5 L26 4.5 C24.5 7 22.4 8 20 8 C17.6 8 15.5 7 14 4.5 Z"
        className="placement-glyph-tee"
      />
      <rect x={x - w / 2} y={y - w * 0.32} width={w} height={w * 0.64} rx={1.2} className="placement-glyph-mark" />
    </svg>
  )
}

export function PlacementPicker() {
  const design = useDesignStore((s) => s.design)
  const setSide = useDesignStore((s) => s.setSide)
  const setPlacement = useDesignStore((s) => s.setPlacement)
  const setView = useUiStore((s) => s.setView)
  const garment = getGarment(design.productId)
  const side = design.placement.side
  const presets = garment.placements.filter((p) => p.side === side)

  return (
    <div className="placement">
      <Segmented<Side>
        label="Garment side"
        value={side}
        options={[
          { value: 'front', label: 'Front' },
          { value: 'back', label: 'Back' },
        ]}
        onChange={(s) => {
          setSide(s)
          setView(s)
        }}
      />
      <div className="placement-grid" role="radiogroup" aria-label={`${side === 'front' ? 'Front' : 'Back'} placement`}>
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={design.placement.placement === p.id}
            className="placement-card"
            onClick={() => {
              setPlacement(p.id)
              setView(p.side)
            }}
          >
            <PlacementGlyph preset={p} />
            <span className="placement-label">{p.label}</span>
            <span className="placement-hint">{p.hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
