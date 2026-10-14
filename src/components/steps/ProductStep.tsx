import { Check } from 'lucide-react'
import { GARMENTS } from '../../garments/catalog'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { FlatPreview } from '../viewer/FlatPreview'
import { Segmented } from '../ui/controls'
import { VIEW_OPTIONS } from '../viewer/viewOptions'
import { Section } from './Section'

export function ProductStep() {
  const productId = useDesignStore((s) => s.design.productId)
  const colors = useDesignStore((s) => s.design.colors)
  const patterns = useDesignStore((s) => s.design.patterns)
  const setProduct = useDesignStore((s) => s.setProduct)
  const view = useUiStore((s) => s.view)
  const setView = useUiStore((s) => s.setView)
  const flatOnly = useUiStore((s) => s.viewerStatus === 'unsupported' || s.viewerStatus === 'error')

  return (
    <>
      <Section title="Choose your cut" description="Colors and your logo carry over when you switch cuts.">
        <div className="product-list" role="radiogroup" aria-label="Product">
          {GARMENTS.map((g) => {
            const selected = g.id === productId
            return (
              <button key={g.id} type="button" role="radio" aria-checked={selected} className="product-card" onClick={() => setProduct(g.id)}>
                <span className="product-thumb">
                  <FlatPreview garment={g} side="front" colors={colors} patterns={patterns} />
                </span>
                <span className="product-info">
                  <span className="product-name">{g.name}</span>
                  <span className="product-tagline">{g.tagline}</span>
                  <span className="product-tags">
                    {g.tags.map((t) => (
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
      <Section title="View" description={flatOnly ? 'Front and back are available in the flat preview.' : 'Drag the preview to rotate freely, or jump to a side.'}>
        <Segmented
          label="Garment view"
          value={view}
          options={flatOnly ? VIEW_OPTIONS.map((o) => ({ ...o, disabled: o.value === 'left' || o.value === 'right' })) : VIEW_OPTIONS}
          onChange={setView}
        />
      </Section>
    </>
  )
}
