import { Copy, Dices, Droplets, Maximize2, RotateCw, Trash2, Waves } from 'lucide-react'
import type { RegionId } from '../../garments/types'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { resolvedColor, PATTERN_SIZE_CM, type PatternFill } from '../../state/design'
import { useColorRegions } from '../../state/useColorRegions'
import { defaultInk } from '../../lib/color'
import { getPattern, svgDataUrl, tileSvg } from '../../patterns/library'
import { RangeField, Segmented } from '../ui/controls'
import { ShirtColorPicker } from '../color/ShirtColorPicker'
import { PatternLibrary } from '../pattern/PatternLibrary'
import { Section } from './Section'

const ZONE_LABEL: Record<RegionId, string> = { body: 'Body', sleeves: 'Sleeves', collar: 'Collar' }

export function PatternStep() {
  const zones = useColorRegions()
  const zoneState = useUiStore((s) => s.patternZone)
  const setZone = useUiStore((s) => s.setPatternZone)
  const colors = useDesignStore((s) => s.design.colors)
  const patterns = useDesignStore((s) => s.design.patterns)
  const { setPattern, updatePattern, copyPattern } = useDesignStore.getState()
  const zone = zones.includes(zoneState) ? zoneState : 'body'
  const fill = patterns[zone]
  const base = resolvedColor(colors, zone)
  const def = fill ? getPattern(fill.id) : undefined
  const ink = fill?.color ?? defaultInk(base)

  const pick = (id: string) => {
    const d = getPattern(id)!
    // Switching pattern keeps ink, angle and opacity; size resets to the new motif's natural scale.
    const next: PatternFill = fill
      ? { ...fill, id, sizeCm: d.defaultSizeCm }
      : { id, color: ink, sizeCm: d.defaultSizeCm, angle: 0, density: 0.5, opacity: 1, seed: 42 }
    setPattern(zone, next)
  }

  const zoneIcon = (z: RegionId) => {
    const f = patterns[z]
    const bg = resolvedColor(colors, z)
    const d = f ? getPattern(f.id) : undefined
    const style = d && f
      ? { backgroundImage: `url("${svgDataUrl(tileSvg(d, { color: f.color, bg, density: f.density, seed: f.seed, opacity: f.opacity }, 16))}")`, backgroundSize: '9px auto', backgroundColor: bg }
      : { background: bg }
    return <span className="zone-dot zone-dot-pattern" style={style} aria-hidden />
  }

  return (
    <>
      <Section title="All-over pattern" description="Print a pattern on each zone, drawn over its fabric color. Library adapted from inkjet.">
        {zones.length > 1 && (
          <Segmented<RegionId>
            label="Pattern zone"
            value={zone}
            onChange={setZone}
            options={zones.map((z) => ({ value: z, label: ZONE_LABEL[z], icon: zoneIcon(z) }))}
          />
        )}
        <PatternLibrary selected={fill?.id ?? null} ink={ink} bg={base} onPick={(d) => pick(d.id)} onClear={() => setPattern(zone, null)} />
      </Section>

      {fill && def && (
        <Section
          title={`Adjust ${def.name.toLowerCase()}`}
          actions={
            <button type="button" className="btn btn-ghost btn-sm is-danger" onClick={() => setPattern(zone, null)}>
              <Trash2 size={14} aria-hidden /> Remove
            </button>
          }
        >
          <ShirtColorPicker
            compact
            label="Pattern"
            value={fill.color}
            defaultValue={defaultInk(base)}
            onChange={(hex, dragging) => updatePattern(zone, { color: hex }, { coalesce: dragging ? 'pattern.color' : undefined })}
          />
          <RangeField
            label="Size (one repeat)"
            icon={<Maximize2 size={15} aria-hidden />}
            value={fill.sizeCm}
            min={PATTERN_SIZE_CM[0]}
            max={PATTERN_SIZE_CM[1]}
            step={0.5}
            unit="cm"
            onChange={(v, dragging) => updatePattern(zone, { sizeCm: v }, { coalesce: dragging ? 'pattern.size' : undefined })}
          />
          <RangeField
            label="Angle"
            icon={<RotateCw size={15} aria-hidden />}
            value={fill.angle}
            min={-180}
            max={180}
            step={1}
            unit="°"
            onChange={(v, dragging) => updatePattern(zone, { angle: v }, { coalesce: dragging ? 'pattern.angle' : undefined })}
          />
          {def.usesDensity && (
            <RangeField
              label="Density"
              icon={<Waves size={15} aria-hidden />}
              value={Math.round(fill.density * 100)}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(v, dragging) => updatePattern(zone, { density: v / 100 }, { coalesce: dragging ? 'pattern.density' : undefined })}
            />
          )}
          <RangeField
            label="Opacity"
            icon={<Droplets size={15} aria-hidden />}
            value={Math.round(fill.opacity * 100)}
            min={10}
            max={100}
            step={1}
            unit="%"
            onChange={(v, dragging) => updatePattern(zone, { opacity: v / 100 }, { coalesce: dragging ? 'pattern.opacity' : undefined })}
          />
          <div className="pattern-actions">
            {def.usesSeed && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => updatePattern(zone, { seed: 1 + Math.floor(Math.random() * 2147483000) })}>
                <Dices size={15} aria-hidden /> Shuffle layout
              </button>
            )}
            {zones.length > 1 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  copyPattern(
                    zone,
                    zones.filter((z) => z !== zone),
                  )
                  useUiStore.getState().notify('success', `${def.name} applied to every zone.`)
                }}
              >
                <Copy size={15} aria-hidden /> Apply to all zones
              </button>
            )}
          </div>
        </Section>
      )}
    </>
  )
}
