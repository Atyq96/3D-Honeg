import { useDesignStore } from '../../state/designStore'
import { getGarment } from '../../garments/catalog'
import { presetName } from '../../config/palette'
import { isLight } from '../../lib/color'

/** Compact live summary pinned to the preview: product, colour, logo placement. */
export function StageSummary() {
  const design = useDesignStore((s) => s.design)
  const garment = getGarment(design.productId)
  const images = design.logos.filter((l) => !l.text)
  const texts = design.logos.length - images.length
  const only = images.length === 1 && !texts ? images[0] : null
  const preset = only && garment.placements.find((p) => p.id === only.placement.placement)
  const prints = [images.length && `${images.length} logo${images.length > 1 ? 's' : ''}`, texts && `${texts} text`].filter(Boolean).join(' · ')
  const body = design.colors.body
  return (
    <div className="stage-summary" aria-label="Current design">
      <span className="stage-summary-product">{garment.name}</span>
      <span className="stage-summary-sep" aria-hidden />
      <span className="stage-summary-color">
        <span className={`dot ${isLight(body) ? 'is-light' : ''}`} style={{ background: body }} aria-hidden />
        <span>{presetName(body) ?? 'Custom'}</span>
        <code>{body}</code>
      </span>
      {design.logos.length > 0 && (
        <>
          <span className="stage-summary-sep" aria-hidden />
          <span>{preset ? `Logo · ${preset.label}` : prints}</span>
        </>
      )}
    </div>
  )
}
