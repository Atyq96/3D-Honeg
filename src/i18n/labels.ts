import { t } from '.'

/** Name of a palette colour in the current language, or null for a custom colour. */
export const colorName = (hex: string): string | null => t().palette[hex.toUpperCase()] ?? null

/** Pattern name in the current language. */
export const patternName = (id: string): string => t().pattern.names[id] ?? id
