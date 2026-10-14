import { parseDesign, type Design } from '../state/design'

const STORAGE_KEY = 'honeg.customizer.design.v1'

export type SaveResult = { ok: true; withoutLogo?: boolean } | { ok: false; reason: string }

/** Saves to localStorage. If the logo makes it exceed the quota, saves without it and says so. */
export function saveDesignLocally(design: Design): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(design))
    return { ok: true }
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...design, logo: null }))
      return { ok: true, withoutLogo: true }
    } catch {
      return { ok: false, reason: "Your browser blocked local storage, so the design couldn't be saved. Use Export design instead." }
    }
  }
}

export function loadSavedDesign(): Design | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? parseDesign(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function hasSavedDesign(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportDesignJson(design: Design) {
  const payload = { ...design, exportedAt: new Date().toISOString(), app: 'HONEG 3D Customizer (prototype)' }
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `honeg-design-${stamp()}.json`)
}

export async function readDesignFile(file: File): Promise<Design> {
  if (file.size > 12 * 1024 * 1024) throw new Error('This file is too large to be a design export.')
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new Error("This file isn't valid JSON. Choose a design exported from this customizer.")
  }
  return parseDesign(json)
}

export function stamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}
