import { useDesignStore } from '../../state/designStore'
import { presetName } from '../../config/palette'
import { isLight } from '../../lib/color'
import { useT } from '../../i18n'

/** Compact live summary pinned to the preview: product, colour, logo placement. */
export function StageSummary() {
  const design = useDesignStore((s) => s.design)
  const m = useT()
  const images = design.logos.filter((l) => !l.text)
  const texts = design.logos.length - images.length
  const only = images.length === 1 && !texts ? images[0] : null
  const prints = [images.length && m.summary.countLogos(images.length), texts && m.summary.countTexts(texts)].filter(Boolean).join(' · ')
  const body = design.colors.body
  return (
    <div className="stage-summary" aria-label={m.summary.current}>
      <span className="stage-summary-product">{m.garments[design.productId]?.name}</span>
      <span className="stage-summary-sep" aria-hidden />
      <span className="stage-summary-color">
        <span className={`dot ${isLight(body) ? 'is-light' : ''}`} style={{ background: body }} aria-hidden />
        <span>{presetName(body) ?? m.common.custom}</span>
        <code>{body}</code>
      </span>
      {design.logos.length > 0 && (
        <>
          <span className="stage-summary-sep" aria-hidden />
          <span>{only ? `${m.summary.logo} · ${m.placements[only.placement.placement].label}` : prints}</span>
        </>
      )}
    </div>
  )
}
