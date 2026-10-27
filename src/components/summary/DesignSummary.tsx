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
import { brandFabric, describeZones } from '../../state/paint'
import { describeText } from '../../state/describeText'
import { num } from '../../lib/format'
import { useT } from '../../i18n'

function Swatch({ hex }: { hex: string }) {
  return <span className={`dot ${isLight(hex) ? 'is-light' : ''}`} style={{ background: hex }} aria-hidden />
}

/** Read-only recap of every design decision, with shortcuts back to the relevant step. */
export function DesignSummary() {
  const design = useDesignStore((s) => s.design)
  const setStep = useUiStore((s) => s.setStep)
  const m = useT()
  const garment = getGarment(design.productId)
  const regions = useColorRegions()
  const patternLines = describePatterns(design.patterns, regions)
  const zoneLines = describeZones(design)
  const images = design.logos.filter((l) => !l.text)
  const texts = design.logos.filter((l) => l.text)

  const edit = (step: StepId, what: string) => (
    <button type="button" className="icon-btn icon-btn-sm" aria-label={m.common.editWhat(what)} data-tip={m.common.edit} data-tip-side="left" onClick={() => setStep(step)}>
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
          <span>{presetName(hex) ?? m.common.custom}</span>
          <code>{hex}</code>
          {follows && <span className="muted">{m.summary.matchesBody}</span>}
        </dd>
        {edit('color', m.summary.editColor(label))}
      </div>
    )
  }

  return (
    <dl className="summary">
      <div className="summary-row">
        <dt>{m.summary.product}</dt>
        <dd>
          <span>{m.garments[garment.id]?.name}</span>
          <span className="muted">· {m.garments[garment.id]?.tagline}</span>
        </dd>
        {edit('product', m.summary.editProduct)}
      </div>
      {colorRow('Corps', 'body')}
      {regions.includes('sleeves') && colorRow('Manches', 'sleeves')}
      {regions.includes('collar') && colorRow('Col', 'collar')}
      <div className="summary-row">
        <dt>{m.summary.pattern}</dt>
        <dd className="summary-stack">
          {patternLines.length ? (
            patternLines.map((p) => (
              <span key={p.zone}>
                <span className="muted">{p.label}{m.common.colon}</span> {p.text}
              </span>
            ))
          ) : (
            <span className="muted">{m.summary.plain}</span>
          )}
        </dd>
        {edit('pattern', m.summary.editPattern)}
      </div>
      {zoneLines.length > 0 && (
        <div className="summary-row">
          <dt>{m.summary.zones}</dt>
          <dd className="summary-stack">
            {zoneLines.map((z) => (
              <span key={z.zone}>
                <span className="muted">{z.label}{m.common.colon}</span> {z.text}
              </span>
            ))}
          </dd>
          {edit('color', m.summary.editZones)}
        </div>
      )}
      <div className="summary-row">
        <dt>{m.summary.brand}</dt>
        <dd>
          <span>{describeBrand(design.brand, brandFabric(design))}</span>
        </dd>
        {edit('logo', m.summary.editBrand)}
      </div>
      <div className="summary-row">
        <dt>{images.length > 1 ? m.summary.logos : m.summary.logo}</dt>
        <dd className={images.length > 1 ? 'summary-stack' : undefined}>
          {images.length ? (
            images.map(({ id, asset, placement: p }) => (
              <span key={id} className="summary-logo-line">
                <span className="summary-logo checker">
                  <img src={asset.dataUrl} alt="" />
                </span>
                <span>
                  {m.placements[p.placement].label} · {m.summary.wide(num(p.widthCm))} · {p.rotationDeg}°
                  {describeLook(p) && <span className="muted"> · {describeLook(p)}</span>}
                  {(p.offsetXCm !== 0 || p.offsetYCm !== 0) && (
                    <span className="muted">
                      {' '}
                      · {m.summary.offset} {p.offsetXCm > 0 ? '+' : ''}
                      {num(p.offsetXCm)} / {p.offsetYCm > 0 ? '+' : ''}
                      {num(p.offsetYCm)} cm
                    </span>
                  )}
                </span>
              </span>
            ))
          ) : (
            <span className="muted">{m.summary.noLogo}</span>
          )}
        </dd>
        {edit('logo', m.summary.editLogos)}
      </div>
      <div className="summary-row">
        <dt>{m.summary.text}</dt>
        <dd className="summary-stack">
          {texts.length ? (
            texts.map((t) => <span key={t.id}>{describeText(design, t)}</span>)
          ) : (
            <span className="muted">{m.summary.noText}</span>
          )}
        </dd>
        {edit('text', m.summary.editText)}
      </div>
    </dl>
  )
}
