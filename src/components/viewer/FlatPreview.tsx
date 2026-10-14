import { useId } from 'react'
import type { GarmentDefinition, RegionId, Side } from '../../garments/types'
import type { V2 } from '../../garments/flat/geom2d'
import { resolvedColor, type Design } from '../../state/design'
import { getPattern } from '../../patterns/library'
import { brandPlacement } from '../../garments/brand'
import { BRAND_ASSETS, brandInk } from '../../config/brand'

interface FlatPreviewProps {
  garment: GarmentDefinition
  side: Side
  colors: Design['colors']
  /** Printed in order, so later logos sit on top. */
  logos?: Design['logos']
  showPrintArea?: boolean
  /** Accessible label; omit for decorative thumbnails. */
  label?: string
  className?: string
  /** Makes logos clickable (the no-WebGL fallback uses it to select one). */
  onLogoClick?: (id: string) => void
  /** All-over patterns per zone (same library and parameters as the 3D view). */
  patterns?: Design['patterns']
  /** HONEG chest mark; omit only for pure silhouettes. */
  brand?: Design['brand']
}

const path = (pts: V2[], close = true) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(4)} ${(-p[1]).toFixed(4)}`).join(' ') + (close ? ' Z' : '')

/** Flat technical sketch of the garment with live colours and logo placements (SVG, no WebGL needed). */
export function FlatPreview({ garment, side, colors, logos = [], showPrintArea, label, className, onLogoClick, patterns, brand }: FlatPreviewProps) {
  const uid = useId().replace(/:/g, '')
  const flat = garment.flat[side]
  const all = [...garment.flat.front.body, ...garment.flat.back.body]
  const minX = Math.min(...all.map((p) => p[0]))
  const maxX = Math.max(...all.map((p) => p[0]))
  const maxY = Math.max(...all.map((p) => p[1]))
  const pad = 0.03
  const viewBox = `${minX - pad} ${-maxY - pad} ${maxX - minX + pad * 2} ${maxY + pad * 2}`

  // A zone's paint is its pattern (if any) or its plain colour.
  const paint = (region: RegionId) => (patterns?.[region] && getPattern(patterns[region]!.id) ? `url(#pat-${uid}-${region})` : resolvedColor(colors, region))
  const body = paint('body')
  const sleeves = paint('sleeves')
  const collar = paint('collar')
  const patternDefs = (['body', 'sleeves', 'collar'] as RegionId[]).map((region) => {
    const fill = patterns?.[region]
    const def = fill ? getPattern(fill.id) : undefined
    if (!fill || !def) return null
    const [w, h] = def.tile
    const bg = resolvedColor(colors, region)
    // Tile units → metres: one repeat is sizeCm wide, rotated clockwise like the 3D print.
    return (
      <pattern key={region} id={`pat-${uid}-${region}`} patternUnits="userSpaceOnUse" width={w} height={h} patternTransform={`rotate(${fill.angle}) scale(${fill.sizeCm / 100 / w})`}>
        <rect width={w} height={h} fill={bg} />
        {/* Library output is generated from validated values only (hex colours, numbers). */}
        <g opacity={fill.opacity} dangerouslySetInnerHTML={{ __html: def.render({ color: fill.color, bg, density: fill.density, seed: fill.seed }) }} />
      </pattern>
    )
  })

  const area = garment.printAreas[side]

  // HONEG mark (front only), recoloured with the same flood filter as a logo fill.
  let brandEl = null
  let brandInkColor: string | null = null
  if (brand && side === 'front') {
    const b = brandPlacement(garment, brand)
    brandInkColor = brandInk(brand.color, colors.body)
    brandEl = (
      <image
        href={BRAND_ASSETS[brand.style].url}
        x={b.center[0] - b.width / 2}
        y={-b.center[1] - b.height / 2}
        width={b.width}
        height={b.height}
        preserveAspectRatio="none"
        filter={`url(#brand-${uid})`}
      />
    )
  }

  const logoEls = logos.map((layer, i) => {
    const { asset, placement } = layer
    const preset = garment.placements.find((p) => p.id === placement.placement)
    if (!preset || preset.side !== side) return null
    const w = placement.widthCm / 100
    const h = w * (asset.height / asset.width)
    const cx = preset.anchor[0] + placement.offsetXCm / 100
    const cy = -(preset.anchor[1] + placement.offsetYCm / 100)
    return (
      <image
        key={layer.id}
        href={asset.dataUrl}
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        preserveAspectRatio="none"
        opacity={placement.opacity}
        filter={placement.tint ? `url(#tint-${uid}-${i})` : undefined}
        transform={`rotate(${placement.rotationDeg} ${cx} ${cy}) translate(${cx} ${cy}) scale(${placement.flipX ? -1 : 1} ${placement.flipY ? -1 : 1}) translate(${-cx} ${-cy})`}
        onClick={onLogoClick ? () => onLogoClick(layer.id) : undefined}
        style={onLogoClick ? { cursor: 'pointer' } : undefined}
      />
    )
  })

  return (
    <svg
      className={className}
      viewBox={viewBox}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id={`clip-${uid}`}>
          <path d={path(flat.body)} />
        </clipPath>
        {logos.map(
          ({ placement }, i) =>
            placement.tint && (
              // Same as the 3D "Fill color": recolour every visible pixel, keep alpha.
              <filter key={i} id={`tint-${uid}-${i}`} colorInterpolationFilters="sRGB">
                <feFlood floodColor={placement.tint} />
                <feComposite in2="SourceAlpha" operator="in" />
              </filter>
            ),
        )}
        {patternDefs}
        {brandInkColor && (
          <filter id={`brand-${uid}`} colorInterpolationFilters="sRGB">
            <feFlood floodColor={brandInkColor} />
            <feComposite in2="SourceAlpha" operator="in" />
          </filter>
        )}
        <linearGradient id={`shade-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.14" />
        </linearGradient>
      </defs>
      <path d={path(flat.body)} fill={body} />
      {flat.sleeves.map((s, i) => (
        <path key={i} d={path(s)} fill={sleeves} />
      ))}
      <g clipPath={`url(#clip-${uid})`}>
        <rect x={minX - pad} y={-maxY - pad} width={maxX - minX + pad * 2} height={maxY + pad * 2} fill={`url(#shade-${uid})`} />
        {showPrintArea && (
          <rect
            x={area.xMin}
            y={-area.yMax}
            width={area.xMax - area.xMin}
            height={area.yMax - area.yMin}
            fill="rgba(242,169,0,0.08)"
            stroke="#F2A900"
            strokeWidth={0.003}
            strokeDasharray="0.012 0.008"
          />
        )}
        {brandEl}
        {logoEls}
      </g>
      {flat.sleeves.map((s, i) => (
        <path key={i} d={path(s)} fill="none" stroke="rgba(14,14,14,0.22)" strokeWidth={0.0022} strokeLinejoin="round" />
      ))}
      <path d={path(flat.body)} fill="none" stroke="rgba(14,14,14,0.32)" strokeWidth={0.0028} strokeLinejoin="round" />
      <path d={path(flat.neckline, false)} fill="none" stroke={collar} strokeWidth={0.016} strokeLinecap="round" />
      <path d={path(flat.neckline, false)} fill="none" stroke="rgba(14,14,14,0.28)" strokeWidth={0.0022} />
    </svg>
  )
}
