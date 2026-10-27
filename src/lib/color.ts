const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Normalises `#RGB`, `RGB`, `#RRGGBB` or `RRGGBB` to `#RRGGBB` (uppercase). Returns null if invalid. */
export function normalizeHex(input: string): string | null {
  const m = HEX_RE.exec(input.trim())
  if (!m) return null
  let hex = m[1]
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c)
  return `#${hex.toUpperCase()}`
}

/** Human-readable reason a HEX value is invalid, or null if it is valid. */
export function hexError(input: string): string | null {
  const raw = input.trim()
  if (!raw) return 'Saisissez une couleur HEX, par ex. #2563EB.'
  const body = raw.startsWith('#') ? raw.slice(1) : raw
  if (/[^0-9a-f]/i.test(body)) return 'Utilisez uniquement 0–9 et A–F après le #.'
  if (body.length !== 3 && body.length !== 6) return 'Utilisez 3 ou 6 caractères, par ex. #FA0 ou #FFAA00.'
  return null
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = normalizeHex(hex) ?? '#000000'
  return [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16)) as [number, number, number]
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Ink or white, whichever reads better on top of `hex`. */
export function onColor(hex: string): '#0E0E0E' | '#FFFFFF' {
  return luminance(hex) > 0.38 ? '#0E0E0E' : '#FFFFFF'
}

/** True for very light colours that need a visible border on a light UI. */
export function isLight(hex: string) {
  return luminance(hex) > 0.82
}

/** Default pattern ink: ink black on light fabrics, amber on dark ones. */
export function defaultInk(base: string): string {
  return luminance(base) > 0.3 ? '#0E0E0E' : '#F2A900'
}
