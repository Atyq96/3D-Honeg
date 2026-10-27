import type { PlacementPreset, Side } from '../../garments/types'
import { canUsePlacement, logoRect, useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import type { LogoLayer } from '../../state/design'
import { getGarment } from '../../garments/catalog'
import { Segmented } from '../ui/controls'
import type { BrandSide } from '../../config/brand'
import { brandPlacement } from '../../garments/brand'
import type { PrintArea } from '../../garments/types'
import type { V2 } from '../../garments/flat/geom2d'
import { t, useT } from '../../i18n'

// Map garment metres (x ±0.3, y 0–0.72) into a 40×40 glyph.
const gx = (x: number) => 20 + x * 52
const gy = (y: number) => 38 - y * 46

/** Tiny tee glyph with the placement marked, so presets are recognisable at a glance. */
function PlacementGlyph({ preset, brand, brandLabel, others }: { preset: PlacementPreset; brand: V2; brandLabel: string; others: PrintArea[] }) {
  const x = gx(preset.anchor[0])
  const y = gy(preset.anchor[1])
  const w = Math.max(3.5, preset.defaultWidth * 52)
  return (
    <svg viewBox="0 0 40 40" className="placement-glyph" aria-hidden>
      <path
        d="M14 4.5 L9 6.5 L2.5 12.5 L6.5 18 L9.5 16 L9.5 37 L30.5 37 L30.5 16 L33.5 18 L37.5 12.5 L31 6.5 L26 4.5 C24.5 7 22.4 8 20 8 C17.6 8 15.5 7 14 4.5 Z"
        className="placement-glyph-tee"
      />
      {preset.side === 'front' && (
        <rect x={gx(brand[0]) - 1.8} y={gy(brand[1]) - 0.9} width={3.6} height={1.8} rx={0.6} className="placement-glyph-brand">
          <title>{brandLabel}</title>
        </rect>
      )}
      {/* Your other logos on this side, so you can see what's already there. */}
      {others.map((r, i) => (
        <rect key={i} x={gx(r.xMin)} y={gy(r.yMax)} width={(r.xMax - r.xMin) * 52} height={(r.yMax - r.yMin) * 46} rx={0.8} className="placement-glyph-other" />
      ))}
      <rect x={x - w / 2} y={y - w * 0.32} width={w} height={w * 0.64} rx={1.2} className="placement-glyph-mark" />
    </svg>
  )
}

/** Tells the user when choosing a chest moved the brand mark to the other side. */
function announceBrandMove(before: BrandSide) {
  const after = useDesignStore.getState().design.brand.side
  if (after !== before && after !== 'center')
    useUiStore.getState().notify('info', t().brand.markMoved(after))
}

/** Side and print position of one logo or text block. */
export function PlacementPicker({ layer }: { layer: LogoLayer }) {
  const design = useDesignStore((s) => s.design)
  const m = useT()
  const setSide = useDesignStore((s) => s.setSide)
  const setPlacement = useDesignStore((s) => s.setPlacement)
  const setView = useUiStore((s) => s.setView)
  const garment = getGarment(design.productId)
  const side = layer.placement.side
  const presets = garment.placements.filter((p) => p.side === side)
  const others = design.logos.filter((l) => l.id !== layer.id)
  const brand = brandPlacement(garment, design.brand).center

  return (
    <div className="placement">
      <Segmented<Side>
        label={m.logo.sideAria}
        value={side}
        options={[
          { value: 'front', label: m.logo.front },
          { value: 'back', label: m.logo.back },
        ]}
        onChange={(s) => {
          const before = useDesignStore.getState().design.brand.side
          setSide(layer.id, s)
          setView(s)
          announceBrandMove(before)
        }}
      />
      <div className="placement-grid" role="radiogroup" aria-label={m.logo.placementAria(side)}>
        {presets.map((p) => {
          // Taking the mark's chest moves the mark across — unless another logo is already there.
          const blocked = !canUsePlacement(design, layer.id, p.id)
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={layer.placement.placement === p.id}
              aria-disabled={blocked || undefined}
              className={`placement-card ${blocked ? 'is-blocked' : ''}`}
              title={blocked ? m.brand.blockedTitle : undefined}
              onClick={() => {
                if (blocked) {
                  useUiStore.getState().notify('info', m.brand.blocked)
                  return
                }
                const before = useDesignStore.getState().design.brand.side
                setPlacement(layer.id, p.id)
                setView(p.side)
                announceBrandMove(before)
              }}
            >
              <PlacementGlyph preset={p} brand={brand} brandLabel={m.brand.glyph} others={others.filter((o) => o.placement.side === p.side).map((o) => logoRect(design, o))} />
              <span className="placement-label">{m.placements[p.id].label}</span>
              <span className="placement-hint">{blocked ? m.brand.glyph : m.placements[p.id].hint}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
