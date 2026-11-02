/**
 * Sportswear pattern library — public API. Zero dependencies, original code.
 * See README.md in this folder.
 */
export { generatePattern, getPatternType, isPatternType, layerCount, normalizeColor, PATTERN_TYPES, SCALE_RANGE } from './generate'
export type { GeneratedPattern, PatternOptions } from './generate'
export type { PatternType, PatternTypeDef } from './types'
export { recolor, layerColors, countLayers, geometryOf, svgDataUrl } from './svg'
export { toCanvas, exportForPrint, printSvg, printPixels } from './raster'
export type { PrintOptions } from './raster'
export { isLayered, parseLayered } from './layered'
export { PALETTES, getPalette } from './palettes'
export type { Palette } from './palettes'
export { PRESETS, SPORTS, getPreset } from './presets'
export type { Preset, Sport } from './presets'
export { randomSeed } from './rng'
