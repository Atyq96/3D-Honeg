import { Check } from 'lucide-react'
import { BRAND_ASSETS, BRAND_COLORS, brandInk, type BrandSide, type BrandStyle } from '../../config/brand'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { isLight, onColor } from '../../lib/color'
import { Segmented } from '../ui/controls'

const SIDE_LABEL: Record<BrandSide, string> = { left: 'left', right: 'right' }
const otherChest = (side: BrandSide) => SIDE_LABEL[side === 'left' ? 'right' : 'left']

/**
 * The HONEG mark is always printed (like a sportswear maker's logo); customers
 * only pick its chest, style and colour. Choosing the chest your own logo is on
 * moves your logo across, and vice versa.
 */
export function BrandMarkControls() {
  const brand = useDesignStore((s) => s.design.brand)
  const fabric = useDesignStore((s) => s.design.colors.body)
  const setBrand = useDesignStore((s) => s.setBrand)

  const changeSide = (side: BrandSide) => {
    const before = useDesignStore.getState().design.logos
    setBrand({ side })
    const after = useDesignStore.getState().design.logos
    const moved = after.filter((l) => before.find((b) => b.id === l.id)?.placement.placement !== l.placement.placement)
    useUiStore.getState().setView('front')
    if (moved.length)
      useUiStore
        .getState()
        .notify('info', `${moved.length > 1 ? 'Your chest logos' : 'Your logo'} moved to the ${otherChest(side)} chest to make room for the HONEG mark.`)
  }

  return (
    <div className="brand-controls">
      <Segmented<BrandSide>
        label="HONEG mark position"
        value={brand.side}
        onChange={changeSide}
        options={[
          { value: 'left', label: 'Left chest', title: "Wearer's left" },
          { value: 'right', label: 'Right chest', title: "Wearer's right" },
        ]}
      />

      <div className="field">
        <span className="field-label" aria-hidden>
          Style
        </span>
        <div className="brand-styles" role="radiogroup" aria-label="HONEG mark style">
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
              <span>{BRAND_ASSETS[style].label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label" aria-hidden>
          Color
        </span>
        <div className="brand-colors" role="radiogroup" aria-label="HONEG mark color">
          {BRAND_COLORS.map((c) => {
            const ink = brandInk(c.value, fabric)
            const selected = brand.color === c.value
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className="brand-color"
                title={c.value === 'auto' ? `Auto — ${ink === '#FFFFFF' ? 'white' : 'black'} on this fabric` : c.label}
                onClick={() => setBrand({ color: c.value })}
              >
                <span className={`brand-color-dot ${isLight(ink) ? 'is-light' : ''}`} style={{ background: ink, color: onColor(ink) }} aria-hidden>
                  {selected && <Check size={13} strokeWidth={3} />}
                </span>
                <span>{c.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <p className="field-hint">
        Printed on the wearer's {SIDE_LABEL[brand.side]} chest. Your own prints always keep clear of it.
      </p>
    </div>
  )
}
