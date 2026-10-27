import { Check } from 'lucide-react'
import { GARMENTS } from '../../garments/catalog'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { FlatPreview } from '../viewer/FlatPreview'
import { Segmented } from '../ui/controls'
import { viewOptions } from '../viewer/viewOptions'
import { useT } from '../../i18n'
import { Section } from './Section'

export function ProductStep() {
  const productId = useDesignStore((s) => s.design.productId)
  const colors = useDesignStore((s) => s.design.colors)
  const patterns = useDesignStore((s) => s.design.patterns)
  const brand = useDesignStore((s) => s.design.brand)
  const zones = useDesignStore((s) => s.design.zones)
  const setProduct = useDesignStore((s) => s.setProduct)
  const view = useUiStore((s) => s.view)
  const setView = useUiStore((s) => s.setView)
  const flatOnly = useUiStore((s) => s.viewerStatus === 'unsupported' || s.viewerStatus === 'error')
  const m = useT()
  const views = viewOptions(m)

  return (
    <>
      <Section title={m.product.cutTitle} description={m.product.cutDesc}>
        <div className="product-list" role="radiogroup" aria-label={m.product.aria}>
          {GARMENTS.map((g) => {
            const selected = g.id === productId
            return (
              <button key={g.id} type="button" role="radio" aria-checked={selected} className="product-card" onClick={() => setProduct(g.id)}>
                <span className="product-thumb">
                  <FlatPreview garment={g} side="front" colors={colors} patterns={patterns} brand={brand} zones={zones} />
                </span>
                <span className="product-info">
                  <span className="product-name">{m.garments[g.id].name}</span>
                  <span className="product-tagline">{m.garments[g.id].tagline}</span>
                  <span className="product-tags">
                    {m.garments[g.id].tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="product-check" aria-hidden>
                  {selected && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            )
          })}
        </div>
      </Section>
      <Section title={m.product.viewTitle} description={flatOnly ? m.product.viewFlat : m.product.viewDrag}>
        <Segmented
          label={m.views.garment}
          value={view}
          options={flatOnly ? views.map((o) => ({ ...o, disabled: o.value === 'left' || o.value === 'right' })) : views}
          onChange={setView}
        />
      </Section>
    </>
  )
}
