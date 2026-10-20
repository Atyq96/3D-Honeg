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
      <Section title="Récapitulatif" description="Faites tourner l’aperçu pour tout vérifier avant d’exporter.">
        <DesignSummary />
      </Section>

      <Section title="Vues à plat" description="Devant et dos, avec vos impressions dans la zone imprimable.">
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
                label={`Vue à plat (${side === 'front' ? 'devant' : 'dos'})`}
              />
              <figcaption>{side === 'front' ? 'Devant' : 'Dos'}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section title="Exporter et enregistrer" description="Tout reste sur votre appareil&nbsp;: rien n’est envoyé ni commandé.">
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
            <Download size={16} aria-hidden /> {exporting ? 'Rendu en cours…' : 'Télécharger l’aperçu (PNG)'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportJson}>
            <FileJson size={16} aria-hidden /> Exporter le design (JSON)
          </button>
          <button type="button" className="btn btn-secondary" onClick={pickDesignFile}>
            <FileUp size={16} aria-hidden /> Importer un design
          </button>
          <button type="button" className="btn btn-secondary" onClick={saveLocally}>
            <Save size={16} aria-hidden /> Enregistrer dans ce navigateur
          </button>
        </div>
        <button type="button" className="btn btn-ghost is-danger reset-all" onClick={() => setConfirm(true)}>
          <RotateCcw size={15} aria-hidden /> Réinitialiser tout le design
        </button>
      </Section>

      <ConfirmDialog
        open={confirm}
        title="Réinitialiser tout le design&nbsp;?"
        body="Le produit, les couleurs, les logos et le texte reviennent aux valeurs par défaut. Vous pourrez encore annuler."
        confirmLabel="Réinitialiser"
        onConfirm={resetAll}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}
