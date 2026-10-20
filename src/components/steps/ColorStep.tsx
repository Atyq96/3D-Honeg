import { Eraser, RotateCcw } from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { useZones } from '../../state/useColorRegions'
import { zonePaint } from '../../state/paint'
import { getGarment } from '../../garments/catalog'
import { isPaintZone, ZONE_INFO, type ZoneId } from '../../garments/zones'
import { DEFAULT_BODY_COLOR } from '../../config/palette'
import { isLight } from '../../lib/color'
import { Switch } from '../ui/controls'
import { ShirtColorPicker } from '../color/ShirtColorPicker'
import { ZonePicker } from '../color/ZonePicker'
import { Section } from './Section'

const PART_NAMES = { body: 'le corps', sleeves: 'les manches', collar: 'le col' }

export function ColorStep() {
  const design = useDesignStore((s) => s.design)
  const resetColors = useDesignStore((s) => s.resetColors)
  const zoneState = useUiStore((s) => s.colorZone)
  const setZone = useUiStore((s) => s.setColorZone)
  const zones = useZones()
  const zone: ZoneId = zones.includes(zoneState) ? zoneState : 'body'
  const { colors } = design
  const info = ZONE_INFO[zone]
  const customised = colors.body !== DEFAULT_BODY_COLOR || colors.sleeves !== null || colors.collar !== null || Object.keys(design.zones).length > 0

  const swatch = (z: ZoneId) => {
    const paint = zonePaint(design, z)
    return paint ? <span className={`zone-dot ${isLight(paint.color) ? 'is-light' : ''}`} style={{ background: paint.color }} aria-hidden /> : null
  }

  return (
    <Section
      title="Couleur du t-shirt"
      description={zones.length > 1 ? 'Choisissez une pièce ou une zone, puis sa couleur. Les moitiés, panneaux et bandes s’impriment par-dessus les pièces.' : undefined}
      actions={
        <button type="button" className="btn btn-ghost btn-sm" onClick={resetColors} disabled={!customised}>
          <RotateCcw size={14} aria-hidden /> Tout réinitialiser
        </button>
      }
    >
      {zones.length > 1 && <ZonePicker label="Zone de couleur" value={zone} onChange={setZone} swatch={swatch} />}
      {isPaintZone(zone) ? <PaintZoneColor key={zone} zone={zone} /> : <PartColor key={zone} zone={zone} label={info.label} />}
    </Section>
  )
}

/** Body, sleeves or collar. Sleeves and collar can follow the body colour. */
function PartColor({ zone, label }: { zone: 'body' | 'sleeves' | 'collar'; label: string }) {
  const colors = useDesignStore((s) => s.design.colors)
  const setColor = useDesignStore((s) => s.setColor)
  const linked = zone !== 'body' && colors[zone] === null
  return (
    <>
      {zone !== 'body' && (
        <Switch
          label="Même couleur que le corps"
          description={linked ? `${label}\u00a0: suit la couleur du corps.` : `${label}\u00a0: couleur propre.`}
          checked={linked}
          onChange={(on) => setColor(zone, on ? null : colors.body)}
        />
      )}
      {(zone === 'body' || !linked) && (
        <ShirtColorPicker
          label={label}
          value={colors[zone] ?? colors.body}
          defaultValue={zone === 'body' ? DEFAULT_BODY_COLOR : colors.body}
          onChange={(hex, dragging) => setColor(zone, hex, { coalesce: dragging ? `color.${zone}` : undefined })}
        />
      )}
    </>
  )
}

/** A half, panel or stripe: unpainted until a colour is picked; can be cleared again. */
function PaintZoneColor({ zone }: { zone: Exclude<ZoneId, 'body' | 'sleeves' | 'collar'> }) {
  const design = useDesignStore((s) => s.design)
  const setColor = useDesignStore((s) => s.setColor)
  const info = ZONE_INFO[zone]
  const paint = design.zones[zone]
  const def = getGarment(design.productId).paintZones.find((z) => z.id === zone)
  const covers = def?.parts.map((p) => PART_NAMES[p]).join(' et ') ?? ''
  return (
    <>
      <div className="zone-status">
        <p>
          <strong>{info.label}</strong> — {info.hint.toLowerCase()}. S’imprime sur {covers}.
          {!paint && <span className="muted"> Pas encore colorée&nbsp;: choisissez une couleur.</span>}
        </p>
        {paint && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setColor(zone, null)}>
            <Eraser size={14} aria-hidden /> Effacer la zone
          </button>
        )}
      </div>
      <ShirtColorPicker
        label={info.label}
        value={paint?.color ?? design.colors.body}
        defaultValue={design.colors.body}
        onChange={(hex, dragging) => setColor(zone, hex, { coalesce: dragging ? `color.${zone}` : undefined })}
      />
    </>
  )
}
