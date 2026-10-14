import { Pencil } from 'lucide-react'
import { getGarment } from '../../garments/catalog'
import { useDesignStore } from '../../state/designStore'
import { useUiStore, type StepId } from '../../state/uiStore'
import { resolvedColor } from '../../state/design'
import { useColorRegions } from '../../state/useColorRegions'
import { presetName } from '../../config/palette'
import { isLight } from '../../lib/color'
import { describeLook } from '../../lib/logoTransform'
import { describePatterns } from '../../patterns/describe'
import { describeBrand } from '../../garments/brand'

function Swatch({ hex }: { hex: string }) {
  return <span className={`dot ${isLight(hex) ? 'is-light' : ''}`} style={{ background: hex }} aria-hidden />
}

/** Read-only recap of every design decision, with shortcuts back to the relevant step. */
export function DesignSummary() {
  const design = useDesignStore((s) => s.design)
  const setStep = useUiStore((s) => s.setStep)
  const garment = getGarment(design.productId)
  const regions = useColorRegions()
  const patternLines = describePatterns(design.patterns, regions)
  const preset = garment.placements.find((p) => p.id === design.placement.placement)
  const p = design.placement

  const edit = (step: StepId, what: string) => (
    <button type="button" className="icon-btn icon-btn-sm" aria-label={`Edit ${what}`} data-tip="Edit" data-tip-side="left" onClick={() => setStep(step)}>
      <Pencil size={14} />
    </button>
  )

  const colorRow = (label: string, region: 'body' | 'sleeves' | 'collar') => {
    const hex = resolvedColor(design.colors, region)
    const follows = region !== 'body' && design.colors[region] === null
    return (
      <div className="summary-row" key={region}>
        <dt>{label}</dt>
        <dd>
          <Swatch hex={hex} />
          <span>{presetName(hex) ?? 'Custom'}</span>
          <code>{hex}</code>
          {follows && <span className="muted">· matches body</span>}
        </dd>
        {edit('color', `${label.toLowerCase()} color`)}
      </div>
    )
  }

  return (
    <dl className="summary">
      <div className="summary-row">
        <dt>Product</dt>
        <dd>
          <span>{garment.name}</span>
          <span className="muted">· {garment.tagline}</span>
        </dd>
        {edit('product', 'product')}
      </div>
      {colorRow('Body', 'body')}
      {regions.includes('sleeves') && colorRow('Sleeves', 'sleeves')}
      {regions.includes('collar') && colorRow('Collar', 'collar')}
      <div className="summary-row">
        <dt>Pattern</dt>
        <dd className="summary-stack">
          {patternLines.length ? (
            patternLines.map((p) => (
              <span key={p.zone}>
                <span className="muted">{p.label}:</span> {p.text}
              </span>
            ))
          ) : (
            <span className="muted">Plain fabric</span>
          )}
        </dd>
        {edit('pattern', 'pattern')}
      </div>
      <div className="summary-row">
        <dt>HONEG</dt>
        <dd>
          <span>{describeBrand(design.brand, design.colors.body)}</span>
        </dd>
        {edit('logo', 'HONEG mark')}
      </div>
      <div className="summary-row">
        <dt>Logo</dt>
        <dd>
          {design.logo ? (
            <>
              <span className="summary-logo checker">
                <img src={design.logo.dataUrl} alt="" />
              </span>
              <span>
                {preset?.label} · {p.widthCm} cm wide · {p.rotationDeg}°
                {describeLook(p) && <span className="muted"> · {describeLook(p)}</span>}
                {(p.offsetXCm !== 0 || p.offsetYCm !== 0) && (
                  <span className="muted">
                    {' '}
                    · offset {p.offsetXCm > 0 ? '+' : ''}
                    {p.offsetXCm} / {p.offsetYCm > 0 ? '+' : ''}
                    {p.offsetYCm} cm
                  </span>
                )}
              </span>
            </>
          ) : (
            <span className="muted">No logo yet</span>
          )}
        </dd>
        {edit('logo', 'logo')}
      </div>
    </dl>
  )
}
