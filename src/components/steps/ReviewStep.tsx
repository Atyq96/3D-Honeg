import { useState } from 'react'
import { Download, FileJson, FileUp, RotateCcw, Save } from 'lucide-react'
import { getGarment } from '../../garments/catalog'
import { useDesignStore } from '../../state/designStore'
import { exportJson, exportPreviewImage, pickDesignFile, saveLocally } from '../../state/actions'
import { FlatPreview } from '../viewer/FlatPreview'
import { ConfirmDialog } from '../ui/controls'
import { DesignSummary } from '../summary/DesignSummary'
import { Section } from './Section'

export function ReviewStep() {
  const design = useDesignStore((s) => s.design)
  const resetAll = useDesignStore((s) => s.resetAll)
  const [confirm, setConfirm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const garment = getGarment(design.productId)

  return (
    <>
      <Section title="Summary" description="Rotate the preview to inspect every angle before exporting.">
        <DesignSummary />
      </Section>

      <Section title="Flats" description="Front and back, as your logos sit within the printable area.">
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
                label={`${side} flat sketch`}
              />
              <figcaption>{side === 'front' ? 'Front' : 'Back'}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section title="Export & save" description="Everything stays on your device — nothing is uploaded or ordered.">
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
            <Download size={16} aria-hidden /> {exporting ? 'Rendering…' : 'Download preview (PNG)'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportJson}>
            <FileJson size={16} aria-hidden /> Export design (JSON)
          </button>
          <button type="button" className="btn btn-secondary" onClick={pickDesignFile}>
            <FileUp size={16} aria-hidden /> Import design
          </button>
          <button type="button" className="btn btn-secondary" onClick={saveLocally}>
            <Save size={16} aria-hidden /> Save in this browser
          </button>
        </div>
        <button type="button" className="btn btn-ghost is-danger reset-all" onClick={() => setConfirm(true)}>
          <RotateCcw size={15} aria-hidden /> Reset entire design
        </button>
      </Section>

      <ConfirmDialog
        open={confirm}
        title="Reset the entire design?"
        body="Product, colors and logo go back to their defaults. You can still undo this."
        confirmLabel="Reset design"
        onConfirm={resetAll}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}
