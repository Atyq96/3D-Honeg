import { useState } from 'react'
import { Copy, Dices, Droplets, Download, Maximize2, RotateCw, Trash2, Waves } from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { PATTERN_SIZE_CM, presetFill, type PatternFill } from '../../state/design'
import { useColorRegions, useZones } from '../../state/useColorRegions'
import { zonePaint } from '../../state/paint'
import { fillSvg, fillThumb } from '../../state/patternArt'
import { isPaintZone, type ZoneId } from '../../garments/zones'
import { useT } from '../../i18n'
import { patternName } from '../../i18n/labels'
import { exportForPrint, getPatternType, getPreset, randomSeed, type Preset } from '../../patterns'
import { ArtworkError, importSvg, MAX_IMPORT_BYTES } from '../../patterns/importSvg'
import { downloadBlob, stamp } from '../../lib/persistence'
import { RangeField } from '../ui/controls'
import { ZonePicker } from '../color/ZonePicker'
import { ShirtColorPicker } from '../color/ShirtColorPicker'
import { PatternLibrary } from '../pattern/PatternLibrary'
import { Section } from './Section'

/** Longest side of the PNG print file, px (keeps it within every browser's canvas limits). */
const PRINT_MAX_PX = 6000

export function PatternStep() {
  const zones = useZones()
  const m = useT()
  const parts = useColorRegions()
  const zoneState = useUiStore((s) => s.patternZone)
  const setZone = useUiStore((s) => s.setPatternZone)
  const notify = useUiStore((s) => s.notify)
  const design = useDesignStore((s) => s.design)
  const { setPattern, applyPattern, updatePattern, copyPattern } = useDesignStore.getState()
  const zone: ZoneId = zones.includes(zoneState) ? zoneState : 'body'
  const paint = zonePaint(design, zone)
  const fill = paint?.pattern ?? null
  // An unpainted half or stripe takes the body colour when it gets a pattern.
  const base = paint?.color ?? design.colors.body
  const def = fill && fill.type !== 'artwork' ? getPatternType(fill.type) : undefined

  // A preset brings its own fabric colour (layer 0) as well as its inks.
  const pick = (p: Preset) => {
    const { fill: next, base: b } = presetFill(p)
    applyPattern(zone, next, b)
  }

  const importArt = async (file: File) => {
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new ArtworkError('tooBig')
      const art = importSvg(await file.text())
      const next: PatternFill = { type: 'artwork', preset: null, colors: art.colors.slice(1), seed: 1, scale: 1, direction: 0, density: 0.5, sizeCm: 50, angle: 0, opacity: 1, art: art.svg }
      applyPattern(zone, next, art.colors[0])
      notify('success', [m.pattern.importedOk(art.layers), ...art.warnings.map((w) => m.pattern.importWarn[w])].join(' '))
    } catch (e) {
      notify('error', e instanceof ArtworkError ? m.pattern.importErr[e.code] : m.pattern.importErr.notSvg)
    }
  }

  const printFiles = async (f: PatternFill) => {
    try {
      const mm = f.sizeCm * 10
      const dpi = Math.min(300, Math.floor((PRINT_MAX_PX / mm) * 25.4))
      const { png, svg } = await exportForPrint(fillSvg(f, base), { dpi, widthMm: mm, heightMm: mm })
      const name = `lunar-3d-pattern-${zone}-${stamp()}`
      downloadBlob(svg, `${name}.svg`)
      downloadBlob(png, `${name}-${dpi}dpi.png`)
      notify('success', m.pattern.printFilesDone)
    } catch {
      notify('error', m.pattern.printFilesFailed)
    }
  }

  // Patterned zones show their pattern; parts always show their fabric, unpainted zones nothing.
  const swatch = (z: ZoneId) => {
    const p = zonePaint(design, z)
    if (!p || (!p.pattern && isPaintZone(z))) return null
    const style = p.pattern ? { backgroundImage: `url("${fillThumb(p.pattern, p.color, 48)}")`, backgroundSize: 'cover' } : { background: p.color }
    return <span className="zone-dot zone-dot-pattern" style={style} aria-hidden />
  }

  return (
    <>
      <Section title={m.pattern.title} description={m.pattern.desc}>
        {zones.length > 1 && <ZonePicker label={m.pattern.zoneLabel} value={zone} onChange={setZone} swatch={swatch} />}
        {zones.length > 1 && (
          <p className="zone-caption">
            {m.pattern.patterning} <strong>{m.zones.items[zone].label.toLowerCase()}</strong>
            {isPaintZone(zone) && !paint ? m.pattern.overBody : '.'}
          </p>
        )}
        <PatternLibrary
          selected={fill ? (fill.type === 'artwork' ? 'artwork' : fill.preset) : null}
          artworkThumb={fill?.type === 'artwork' ? fillThumb(fill, base) : undefined}
          onPick={pick}
          onClear={() => setPattern(zone, null)}
          onImport={(file) => void importArt(file)}
        />
      </Section>

      {fill && (
        <Section
          title={m.pattern.adjust(patternName(fill))}
          actions={
            <button type="button" className="btn btn-ghost btn-sm is-danger" onClick={() => setPattern(zone, null)}>
              <Trash2 size={14} aria-hidden /> {m.pattern.remove}
            </button>
          }
        >
          <LayerColors key={zone} zone={zone} fill={fill} base={base} />
          {def && (
            <button type="button" className="btn btn-secondary pattern-shuffle" onClick={() => updatePattern(zone, { seed: randomSeed() })}>
              <Dices size={16} aria-hidden /> {m.pattern.shuffle}
              <span className="muted">{m.pattern.shuffleHint}</span>
            </button>
          )}
          <RangeField
            label={m.pattern.size}
            icon={<Maximize2 size={15} aria-hidden />}
            value={fill.sizeCm}
            min={PATTERN_SIZE_CM[0]}
            max={PATTERN_SIZE_CM[1]}
            step={1}
            unit="cm"
            onChange={(v, dragging) => updatePattern(zone, { sizeCm: v }, { coalesce: dragging ? 'pattern.size' : undefined })}
          />
          <RangeField
            label={m.pattern.angle}
            icon={<RotateCw size={15} aria-hidden />}
            value={fill.angle}
            min={-180}
            max={180}
            step={1}
            unit="°"
            onChange={(v, dragging) => updatePattern(zone, { angle: v }, { coalesce: dragging ? 'pattern.angle' : undefined })}
          />
          {def?.uses.density && (
            <RangeField
              label={m.pattern.density}
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
            label={m.pattern.opacity}
            icon={<Droplets size={15} aria-hidden />}
            value={Math.round(fill.opacity * 100)}
            min={10}
            max={100}
            step={1}
            unit="%"
            onChange={(v, dragging) => updatePattern(zone, { opacity: v / 100 }, { coalesce: dragging ? 'pattern.opacity' : undefined })}
          />
          <div className="pattern-actions">
            {!isPaintZone(zone) && parts.length > 1 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  copyPattern(
                    zone,
                    parts.filter((z) => z !== zone),
                  )
                  notify('success', m.pattern.appliedAll(patternName(fill)))
                }}
              >
                <Copy size={15} aria-hidden /> {m.pattern.applyAll}
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void printFiles(fill)} title={m.pattern.printFilesHint}>
              <Download size={15} aria-hidden /> {m.pattern.printFiles}
            </button>
          </div>
        </Section>
      )}
    </>
  )
}

/**
 * The pattern's colour layers: layer 0 is the zone's fabric colour, the rest
 * its inks. Pick a layer, then recolour it — the geometry never changes.
 */
function LayerColors({ zone, fill, base }: { zone: ZoneId; fill: PatternFill; base: string }) {
  const m = useT()
  const { setColor, updatePattern } = useDesignStore.getState()
  const [active, setActive] = useState(0)
  const layers = [base, ...fill.colors]
  const i = Math.min(active, layers.length - 1)
  const original = (fill.preset && getPreset(fill.preset)?.colors[i]) || layers[i]
  const name = (k: number) => (k === 0 ? m.pattern.base : m.pattern.layer(k))

  return (
    <div className="layer-colors">
      <div className="field-label">{m.pattern.layers}</div>
      <div className="layer-chips" role="radiogroup" aria-label={m.pattern.layerAria}>
        {layers.map((c, k) => (
          <button key={k} type="button" role="radio" aria-checked={k === i} aria-label={`${name(k)} · ${c}`} className="layer-chip" onClick={() => setActive(k)} title={`${name(k)} · ${c}`}>
            <span className="layer-swatch" style={{ background: c }} aria-hidden />
            <span className="layer-name">{k === 0 ? m.pattern.base : k}</span>
          </button>
        ))}
      </div>
      <p className="muted layer-hint">{m.pattern.layersHint}</p>
      <ShirtColorPicker
        key={i}
        compact
        label={name(i)}
        value={layers[i]}
        defaultValue={original}
        onChange={(hex, dragging) => {
          const coalesce = dragging ? `pattern.layer${i}` : undefined
          if (i === 0) setColor(zone, hex, { coalesce })
          else updatePattern(zone, { colors: fill.colors.map((c, j) => (j === i - 1 ? hex : c)) }, { coalesce })
        }}
      />
    </div>
  )
}
