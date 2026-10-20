import { Check } from 'lucide-react'
import { BRAND_ASSETS, BRAND_COLORS, brandInk, type BrandSide, type BrandStyle } from '../../config/brand'
import { useDesignStore } from '../../state/designStore'
import { brandFabric } from '../../state/paint'
import { useUiStore } from '../../state/uiStore'
import { isLight, onColor } from '../../lib/color'
import { Segmented } from '../ui/controls'

const WHERE: Record<BrandSide, string> = {
  left: 'sur la poitrine gauche du porteur',
  center: 'au centre de la poitrine',
  right: 'sur la poitrine droite du porteur',
}

/**
 * The HONEG mark is always printed (like a sportswear maker's logo); customers
 * only pick where it sits (left chest, centre or right chest), its style and
 * its colour. Choosing the chest your own logo is on moves your logo across;
 * centred, it leaves both chests free.
 */
export function BrandMarkControls() {
  const brand = useDesignStore((s) => s.design.brand)
  // The fabric under the mark (a painted half or stripe can change it).
  const fabric = useDesignStore((s) => brandFabric(s.design))
  const setBrand = useDesignStore((s) => s.setBrand)

  const changeSide = (side: BrandSide) => {
    const before = useDesignStore.getState().design.logos
    setBrand({ side })
    const after = useDesignStore.getState().design.logos
    const moved = after.filter((l) => before.find((b) => b.id === l.id)?.placement.placement !== l.placement.placement)
    useUiStore.getState().setView('front')
    if (moved.length && side !== 'center') {
      const chest = side === 'left' ? 'droite' : 'gauche'
      useUiStore
        .getState()
        .notify('info', `${moved.length > 1 ? 'Vos logos de poitrine passent' : 'Votre logo passe'} sur la poitrine ${chest} pour laisser la place à la marque HONEG.`)
    }
  }

  return (
    <div className="brand-controls">
      <Segmented<BrandSide>
        label="Position de la marque HONEG"
        value={brand.side}
        onChange={changeSide}
        options={[
          { value: 'left', label: 'Gauche', title: 'Poitrine gauche du porteur' },
          { value: 'center', label: 'Centre', title: 'Au centre de la poitrine' },
          { value: 'right', label: 'Droite', title: 'Poitrine droite du porteur' },
        ]}
      />

      <div className="field">
        <span className="field-label" aria-hidden>
          Style
        </span>
        <div className="brand-styles" role="radiogroup" aria-label="Style de la marque HONEG">
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
          Couleur
        </span>
        <div className="brand-colors" role="radiogroup" aria-label="Couleur de la marque HONEG">
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
                title={c.value === 'auto' ? `Auto\u00a0: ${ink === '#FFFFFF' ? 'blanc' : 'noir'} sur ce tissu` : c.label}
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

      <p className="field-hint">Imprimée {WHERE[brand.side]}. Vos propres impressions restent toujours à distance.</p>
    </div>
  )
}
