// Text fonts, bundled with the app (all SIL Open Font License, via Fontsource).
// Only the faces actually drawn are downloaded by the browser.
import '@fontsource/anton/400.css'
import '@fontsource/bebas-neue/400.css'
import '@fontsource/graduate/400.css'
import '@fontsource/black-ops-one/400.css'
import '@fontsource/permanent-marker/400.css'
import '@fontsource/pacifico/400.css'
import '@fontsource/playfair-display/800.css'

export interface TextFont {
  id: string
  label: string
  /** CSS font-family as registered by the @font-face rules. */
  family: string
  weight: number
  /** What it's good for, shown under the name. */
  hint: string
}

export const TEXT_FONTS: TextFont[] = [
  { id: 'anton', label: 'Anton', family: 'Anton', weight: 400, hint: 'Bold condensed' },
  { id: 'bebas', label: 'Bebas Neue', family: 'Bebas Neue', weight: 400, hint: 'Tall caps' },
  { id: 'graduate', label: 'Graduate', family: 'Graduate', weight: 400, hint: 'Varsity' },
  { id: 'unbounded', label: 'Unbounded', family: 'Unbounded Variable', weight: 800, hint: 'Wide, HONEG style' },
  { id: 'manrope', label: 'Manrope', family: 'Manrope Variable', weight: 800, hint: 'Clean sans' },
  { id: 'playfair', label: 'Playfair', family: 'Playfair Display', weight: 800, hint: 'Classic serif' },
  { id: 'stencil', label: 'Black Ops', family: 'Black Ops One', weight: 400, hint: 'Stencil' },
  { id: 'marker', label: 'Marker', family: 'Permanent Marker', weight: 400, hint: 'Hand-drawn' },
  { id: 'script', label: 'Pacifico', family: 'Pacifico', weight: 400, hint: 'Script' },
]

export const DEFAULT_FONT = 'anton'

export const getFont = (id: string): TextFont => TEXT_FONTS.find((f) => f.id === id) ?? TEXT_FONTS[0]

/** CSS shorthand for a font at a pixel size, e.g. `400 200px "Anton"`. */
export const fontCss = (font: TextFont, px: number) => `${font.weight} ${px}px "${font.family}"`
