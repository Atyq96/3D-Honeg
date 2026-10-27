import { useState, type ReactNode } from 'react'
import { getGarment } from '../../garments/catalog'
import { isPaintZone, ZONE_GROUPS, ZONE_INFO, type ZoneGroup, type ZoneId } from '../../garments/zones'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { useZones } from '../../state/useColorRegions'
import { useT } from '../../i18n'
import { FlatPreview } from '../viewer/FlatPreview'

const NEUTRAL = '#D9D6CF'
const HIGHLIGHT = '#F2A900'

interface Props {
  /** Accessible name of the zone choice, e.g. "Color zone". */
  label: string
  value: ZoneId
  onChange: (zone: ZoneId) => void
  /** What a zone currently shows (a colour or pattern dot), or null when it isn't painted. */
  swatch: (zone: ZoneId) => ReactNode | null
}

/**
 * Pick the part or area to color or pattern, by picture: each card shows the
 * real 3D garment with that zone highlighted (rendered once per model), or
 * the flat sketch when 3D isn't available. Grouped into parts, panels,
 * halves and stripes.
 */
export function ZonePicker({ label, value, onChange, swatch }: Props) {
  const zones = useZones()
  const thumbs = useUiStore((s) => s.zoneThumbs)
  const m = useT()
  const [group, setGroup] = useState<ZoneGroup>(ZONE_INFO[value].group)
  const groups = ZONE_GROUPS.filter((g) => zones.some((z) => ZONE_INFO[z].group === g))
  const visible = zones.filter((z) => ZONE_INFO[z].group === group)
  // Painted paint zones per group, so users can see where their colours are.
  const painted = (g: ZoneGroup) => zones.filter((z) => ZONE_INFO[z].group === g && isPaintZone(z) && swatch(z)).length

  return (
    <div className="zone-picker">
      {groups.length > 1 && (
        <div className="chips zone-tabs" role="group" aria-label={m.zones.typeAria}>
          {groups.map((g) => (
            <button key={g} type="button" className="chip" aria-pressed={group === g} onClick={() => setGroup(g)}>
              {m.zones.groups[g]}
              {painted(g) > 0 && <span className="zone-tab-count">{painted(g)}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="zone-grid" role="radiogroup" aria-label={label}>
        {visible.map((z) => {
          const info = m.zones.items[z]
          const dot = swatch(z)
          return (
            <button key={z} type="button" role="radio" aria-checked={value === z} className="zone-card" title={info.hint} onClick={() => onChange(z)}>
              <span className="zone-thumb" aria-hidden>
                {thumbs[z] ? <img src={thumbs[z]} alt="" /> : <ZoneSketch zone={z} />}
              </span>
              <span className="zone-name">
                {dot}
                <span>{info.label}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Flat-sketch stand-in for the 3D thumbnail (no WebGL, or while the model loads). */
function ZoneSketch({ zone }: { zone: ZoneId }) {
  const productId = useDesignStore((s) => s.design.productId)
  const garment = getGarment(productId)
  const colors = {
    body: zone === 'body' ? HIGHLIGHT : NEUTRAL,
    sleeves: zone === 'sleeves' ? HIGHLIGHT : NEUTRAL,
    collar: zone === 'collar' ? HIGHLIGHT : NEUTRAL,
  }
  const zones = isPaintZone(zone) ? { [zone]: { color: HIGHLIGHT, pattern: null } } : {}
  return <FlatPreview garment={garment} side={ZONE_INFO[zone].view} colors={colors} zones={zones} className="zone-sketch" />
}
