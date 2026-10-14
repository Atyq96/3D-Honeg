import { RotateCcw } from 'lucide-react'
import type { RegionId } from '../../garments/types'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { resolvedColor } from '../../state/design'
import { useColorRegions } from '../../state/useColorRegions'
import { DEFAULT_BODY_COLOR } from '../../config/palette'
import { isLight } from '../../lib/color'
import { Segmented, Switch } from '../ui/controls'
import { ShirtColorPicker } from '../color/ShirtColorPicker'
import { Section } from './Section'

const ZONE_LABEL: Record<RegionId, string> = { body: 'Body', sleeves: 'Sleeves', collar: 'Collar' }

export function ColorStep() {
  const colors = useDesignStore((s) => s.design.colors)
  const setColor = useDesignStore((s) => s.setColor)
  const resetColors = useDesignStore((s) => s.resetColors)
  const zoneState = useUiStore((s) => s.colorZone)
  const setZone = useUiStore((s) => s.setColorZone)
  const zones = useColorRegions()
  const zone = zones.includes(zoneState) ? zoneState : 'body'
  const linked = zone !== 'body' && colors[zone] === null
  const customised = colors.body !== DEFAULT_BODY_COLOR || colors.sleeves !== null || colors.collar !== null

  return (
    <>
      <Section
        title="Shirt color"
        description={zones.length > 1 ? 'Color the whole shirt, or set sleeves and collar separately.' : undefined}
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={resetColors} disabled={!customised}>
            <RotateCcw size={14} aria-hidden /> Reset all
          </button>
        }
      >
        {zones.length > 1 && (
          <Segmented<RegionId>
            label="Color zone"
            value={zone}
            onChange={setZone}
            options={zones.map((z) => {
              const c = resolvedColor(colors, z)
              return {
                value: z,
                label: ZONE_LABEL[z],
                icon: <span className={`zone-dot ${isLight(c) ? 'is-light' : ''}`} style={{ background: c }} aria-hidden />,
              }
            })}
          />
        )}

        {zone !== 'body' && (
          <Switch
            label={`Match body color`}
            description={linked ? `${ZONE_LABEL[zone]} follow the body color.` : `${ZONE_LABEL[zone]} use their own color.`}
            checked={linked}
            onChange={(on) => setColor(zone, on ? null : colors.body)}
          />
        )}

        {zone === 'body' ? (
          <ShirtColorPicker
            label="Body"
            value={colors.body}
            defaultValue={DEFAULT_BODY_COLOR}
            onChange={(hex, dragging) => setColor('body', hex, { coalesce: dragging ? 'color.body' : undefined })}
          />
        ) : (
          !linked && (
            <ShirtColorPicker
              key={zone}
              label={ZONE_LABEL[zone]}
              value={colors[zone] ?? colors.body}
              defaultValue={colors.body}
              onChange={(hex, dragging) => setColor(zone, hex, { coalesce: dragging ? `color.${zone}` : undefined })}
            />
          )
        )}
      </Section>
    </>
  )
}
