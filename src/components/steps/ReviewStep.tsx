import { useState } from 'react'
import { Download, FileJson, FileUp, RotateCcw, Save } from 'lucide-react'
import { getGarment } from '../../garments/catalog'
import { useDesignStore } from '../../state/designStore'
import { exportJson, exportPreviewImage, pickDesignFile, saveLocally } from '../../state/actions'
import { FlatPreview } from '../viewer/FlatPreview'
import { ConfirmDialog } from '../ui/controls'
import { DesignSummary } from '../summary/DesignSummary'
import { Section } from './Section'
import { useT } from '../../i18n'

export function ReviewStep() {
  const design = useDesignStore((s) => s.design)
  const resetAll = useDesignStore((s) => s.resetAll)
  const [confirm, setConfirm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const garment = getGarment(design.productId)
  const m = useT()

  return (
    <>
      <Section title={m.review.summary} description={m.review.summaryDesc}>
        <DesignSummary />
      </Section>

      <Section title={m.review.flats} description={m.review.flatsDesc}>
        <div className="flats">
          {(['front', 'back'] as const).map((side) => (
            <figure key={side} className="flat-card">
              <FlatPreview
                garment={garment}
                side={side}
                colors={design.colors}
                patterns={design.patterns}
                brand={design.brand}
                zones={design.zones}
                logos={design.logos}
                label={m.review.flatAria(side)}
              />
              <figcaption>{side === 'front' ? m.logo.front : m.logo.back}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section title={m.review.exportTitle} description={m.review.exportDesc}>
        <div className="export-grid">
          <button
            type="button"
            className="btn btn-accent"
            disabled={exporting}
            onClick={async () => {
              setExporting(true)
              await exportPreviewImage()
              setExporting(false)
            }}
          >
            <Download size={16} aria-hidden /> {exporting ? m.review.rendering : m.review.downloadPng}
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportJson}>
            <FileJson size={16} aria-hidden /> {m.review.exportJson}
          </button>
          <button type="button" className="btn btn-secondary" onClick={pickDesignFile}>
            <FileUp size={16} aria-hidden /> {m.review.importDesign}
          </button>
          <button type="button" className="btn btn-secondary" onClick={saveLocally}>
            <Save size={16} aria-hidden /> {m.review.saveBrowser}
          </button>
        </div>
        <button type="button" className="btn btn-ghost is-danger reset-all" onClick={() => setConfirm(true)}>
          <RotateCcw size={15} aria-hidden /> {m.review.resetAll}
        </button>
      </Section>

      <ConfirmDialog
        open={confirm}
        title={m.topbar.confirmTitle}
        body={m.topbar.confirmBody}
        confirmLabel={m.topbar.confirmLabel}
        onConfirm={resetAll}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}
