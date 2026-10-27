import { Check } from 'lucide-react'
import { BRAND_ASSETS, BRAND_COLORS, brandInk, type BrandSide, type BrandStyle } from '../../config/brand'
import { useDesignStore } from '../../state/designStore'
import { brandFabric } from '../../state/paint'
import { useUiStore } from '../../state/uiStore'
import { isLight, onColor } from '../../lib/color'
import { t, useT } from '../../i18n'
import { Segmented } from '../ui/controls'

/**
 * The brand mark is always printed (like a sportswear maker's logo); customers
 * only pick where it sits (left chest, centre or right chest), its style and
 * its colour. Choosing the chest your own logo is on moves your logo across;
 * centred, it leaves both chests free.
 */
export function BrandMarkControls() {
  const brand = useDesignStore((s) => s.design.brand)
  // The fabric under the mark (a painted half or stripe can change it).
  const fabric = useDesignStore((s) => brandFabric(s.design))
  const setBrand = useDesignStore((s) => s.setBrand)
  const m = useT()

  const changeSide = (side: BrandSide) => {
    const before = useDesignStore.getState().design.logos
    setBrand({ side })
    const after = useDesignStore.getState().design.logos
    const moved = after.filter((l) => before.find((b) => b.id === l.id)?.placement.placement !== l.placement.placement)
    useUiStore.getState().setView('front')
    if (moved.length && side !== 'center') useUiStore.getState().notify('info', t().brand.moved(moved.length > 1, side === 'left' ? 'right' : 'left'))
  }

  return (
    <div className="brand-controls">
      <Segmented<BrandSide>
        label={m.brand.positionAria}
        value={brand.side}
        onChange={changeSide}
        options={[
          { value: 'left', label: m.brand.left, title: m.brand.leftTitle },
          { value: 'center', label: m.brand.center, title: m.brand.centerTitle },
          { value: 'right', label: m.brand.right, title: m.brand.rightTitle },
        ]}
      />

      <div className="field">
        <span className="field-label" aria-hidden>
          {m.brand.style}
        </span>
        <div className="brand-styles" role="radiogroup" aria-label={m.brand.styleAria}>
          {(Object.keys(BRAND_ASSETS) as BrandStyle[]).map((style) => (
            <button
              key={style}
              type="button"
              role="radio"
              aria-checked={brand.style === style}
              className="brand-style"
              onClick={() => setBrand({ style })}
            >
              <img src={BRAND_ASSETS[style].url} alt="" />
              <span>{m.brand.styles[style]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label" aria-hidden>
          {m.brand.color}
        </span>
        <div className="brand-colors" role="radiogroup" aria-label={m.brand.colorAria}>
          {BRAND_COLORS.map((value) => {
            const ink = brandInk(value, fabric)
            const selected = brand.color === value
            const label = m.brand.colors[value] ?? value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                className="brand-color"
                title={value === 'auto' ? m.brand.autoTitle(ink === '#FFFFFF') : label}
                onClick={() => setBrand({ color: value })}
              >
                <span className={`brand-color-dot ${isLight(ink) ? 'is-light' : ''}`} style={{ background: ink, color: onColor(ink) }} aria-hidden>
                  {selected && <Check size={13} strokeWidth={3} />}
                </span>
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <p className="field-hint">{m.brand.hint(m.brand.where[brand.side])}</p>
    </div>
  )
}
