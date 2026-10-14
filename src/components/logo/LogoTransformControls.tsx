import { ArrowLeftRight, ArrowUpDown, RotateCcw, RotateCw, Scaling } from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { logoAspect } from '../../state/design'
import type { LogoLayer } from '../../state/design'
import { getGarment } from '../../garments/catalog'
import { maxWidthCm, MIN_LOGO_CM, offsetRange } from '../../lib/logoTransform'
import { RangeField } from '../ui/controls'

/**
 * Size, rotation and position of one print, with ranges derived from the
 * printable area so values are always reachable. Text sets its size as a
 * letter height in the Text section instead (`showSize={false}`).
 */
export function LogoTransformControls({ layer, showSize = true }: { layer: LogoLayer; showSize?: boolean }) {
  const productId = useDesignStore((s) => s.design.productId)
  const { updateTransform, resetTransform } = useDesignStore.getState()
  const update: (patch: Parameters<typeof updateTransform>[1], opts?: Parameters<typeof updateTransform>[2]) => void = (patch, opts) =>
    updateTransform(layer.id, patch, opts)
  const garment = getGarment(productId)
  const placement = layer.placement
  const preset = garment.placements.find((p) => p.id === placement.placement) ?? garment.placements[0]
  const area = garment.printAreas[preset.side]
  const aspect = logoAspect(layer.asset)
  const maxW = maxWidthCm(area, aspect, placement.rotationDeg)
  const range = offsetRange(placement, aspect, area, preset.anchor)

  return (
    <div className="transform-controls">
      {showSize && (
        <RangeField
          label="Size (width)"
          icon={<Scaling size={15} aria-hidden />}
          value={placement.widthCm}
          min={MIN_LOGO_CM}
          max={maxW}
          step={0.5}
          unit="cm"
          onChange={(v, dragging) => update({ widthCm: v }, { coalesce: dragging ? 'size' : undefined })}
        />
      )}
      <RangeField
        label="Rotation"
        icon={<RotateCw size={15} aria-hidden />}
        value={placement.rotationDeg}
        min={-180}
        max={180}
        step={1}
        unit="°"
        onChange={(v, dragging) => update({ rotationDeg: v }, { coalesce: dragging ? 'rotation' : undefined })}
      />
      <RangeField
        label="Horizontal"
        icon={<ArrowLeftRight size={15} aria-hidden />}
        value={placement.offsetXCm}
        min={range.x[0]}
        max={range.x[1]}
        step={0.5}
        unit="cm"
        onChange={(v, dragging) => update({ offsetXCm: v }, { coalesce: dragging ? 'offsetX' : undefined })}
      />
      <RangeField
        label="Vertical"
        icon={<ArrowUpDown size={15} aria-hidden />}
        value={placement.offsetYCm}
        min={range.y[0]}
        max={range.y[1]}
        step={0.5}
        unit="cm"
        onChange={(v, dragging) => update({ offsetYCm: v }, { coalesce: dragging ? 'offsetY' : undefined })}
        hint="Offsets are measured from the preset position and limited to the printable area."
      />
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => resetTransform(layer.id)}>
        <RotateCcw size={15} aria-hidden /> Reset size, rotation &amp; position
      </button>
    </div>
  )
}
