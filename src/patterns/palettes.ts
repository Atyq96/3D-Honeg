/**
 * Named sport palettes. The first colour is the base (the fabric under the
 * print); the rest are inks in print order. Display names live in the i18n
 * dictionaries (`patterns.palettes`).
 */
export interface Palette {
  id: string
  colors: string[]
}

export const PALETTES: Palette[] = [
  { id: 'electric', colors: ['#1F5BD8', '#F2762E', '#14234A', '#5FB3E8', '#0E0E12'] },
  { id: 'peloton', colors: ['#F4F1EA', '#0B1F3A', '#C8102E', '#F2B705', '#5B6B7C'] },
  { id: 'breakaway', colors: ['#111316', '#F7D417', '#FFFFFF', '#E4002B', '#3C4048'] },
  { id: 'lagoon', colors: ['#0D3B66', '#00A6A6', '#F4D35E', '#EE6352', '#FFFFFF'] },
  { id: 'trail', colors: ['#E8DCC4', '#2F3E2E', '#C46A2C', '#7A8B5A', '#1C1C1C'] },
  { id: 'volt', colors: ['#0F0F14', '#D7FF1F', '#FF2E88', '#2EE6FF', '#FFFFFF'] },
  { id: 'graphite', colors: ['#F5F5F5', '#111111', '#6E6E6E', '#BDBDBD', '#3A3A3A'] },
  { id: 'tricolore', colors: ['#FFFFFF', '#002395', '#ED2939', '#0B132B', '#8FA3D6'] },
  { id: 'sunset', colors: ['#2B2D42', '#FF5E3A', '#FF9F1C', '#FDF0D5', '#8D0801'] },
  { id: 'glacier', colors: ['#E8F1F8', '#16425B', '#3A7CA5', '#9CC9E6', '#D9A441'] },
]

const BY_ID = new Map(PALETTES.map((p) => [p.id, p]))
export const getPalette = (id: string): Palette | undefined => BY_ID.get(id)
