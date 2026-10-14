import { useDesignStore } from '../../state/designStore'
import { getGarment } from '../../garments/catalog'
import { presetName } from '../../config/palette'
import { isLight } from '../../lib/color'

/** Compact live summary pinned to the preview: product, colour, logo placement. */
export function StageSummary() {
  const design = useDesignStore((s) => s.design)
  const garment = getGarment(design.productId)
  const preset = garment.placements.find((p) => p.id === design.placement.placement)
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
      {design.logo && preset && (
        <>
          <span className="stage-summary-sep" aria-hidden />
          <span>Logo · {preset.label}</span>
        </>
      )}
    </div>
  )
}
