import { Eraser, RotateCcw } from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { useZones } from '../../state/useColorRegions'
import { zonePaint } from '../../state/paint'
import { getGarment } from '../../garments/catalog'
import { isPaintZone, type ZoneId } from '../../garments/zones'
import { DEFAULT_BODY_COLOR } from '../../config/palette'
import { isLight } from '../../lib/color'
import { useT } from '../../i18n'
import { Switch } from '../ui/controls'
import { ShirtColorPicker } from '../color/ShirtColorPicker'
import { ZonePicker } from '../color/ZonePicker'
import { Section } from './Section'

export function ColorStep() {
  const design = useDesignStore((s) => s.design)
  const resetColors = useDesignStore((s) => s.resetColors)
  const zoneState = useUiStore((s) => s.colorZone)
  const setZone = useUiStore((s) => s.setColorZone)
  const zones = useZones()
  const m = useT()
  const zone: ZoneId = zones.includes(zoneState) ? zoneState : 'body'
  const { colors } = design
  const customised = colors.body !== DEFAULT_BODY_COLOR || colors.sleeves !== null || colors.collar !== null || Object.keys(design.zones).length > 0

  const swatch = (z: ZoneId) => {
    const paint = zonePaint(design, z)
    return paint ? <span className={`zone-dot ${isLight(paint.color) ? 'is-light' : ''}`} style={{ background: paint.color }} aria-hidden /> : null
  }

  return (
    <Section
      title={m.color.title}
      description={zones.length > 1 ? m.color.desc : undefined}
      actions={
        <button type="button" className="btn btn-ghost btn-sm" onClick={resetColors} disabled={!customised}>
          <RotateCcw size={14} aria-hidden /> {m.color.resetAll}
        </button>
      }
    >
      {zones.length > 1 && <ZonePicker label={m.color.zoneLabel} value={zone} onChange={setZone} swatch={swatch} />}
      {isPaintZone(zone) ? <PaintZoneColor key={zone} zone={zone} /> : <PartColor key={zone} zone={zone} label={m.zones.items[zone].label} />}
    </Section>
  )
}

/** Body, sleeves or collar. Sleeves and collar can follow the body colour. */
function PartColor({ zone, label }: { zone: 'body' | 'sleeves' | 'collar'; label: string }) {
  const colors = useDesignStore((s) => s.design.colors)
  const setColor = useDesignStore((s) => s.setColor)
  const m = useT()
  const linked = zone !== 'body' && colors[zone] === null
  return (
    <>
      {zone !== 'body' && (
        <Switch
          label={m.color.matchBody}
          description={linked ? m.color.follows(label) : m.color.own(label)}
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
  const m = useT()
  const info = m.zones.items[zone]
  const paint = design.zones[zone]
  const def = getGarment(design.productId).paintZones.find((z) => z.id === zone)
  const covers = def?.parts.map((p) => m.color.parts[p]).join(m.color.and) ?? ''
  return (
    <>
      <div className="zone-status">
        <p>
          <strong>{info.label}</strong> — {info.hint.toLowerCase()}. {m.color.printsOver(covers)}
          {!paint && <span className="muted"> {m.color.notPainted}</span>}
        </p>
        {paint && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setColor(zone, null)}>
            <Eraser size={14} aria-hidden /> {m.color.clearZone}
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
