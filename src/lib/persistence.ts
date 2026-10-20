import { parseDesign, type Design } from '../state/design'

const STORAGE_KEY = 'honeg.customizer.design.v1'

export type SaveResult = { ok: true; withoutLogo?: boolean } | { ok: false; reason: string }

/** Saves to localStorage. If the logos make it exceed the quota, saves without them and says so. */
export function saveDesignLocally(design: Design): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(design))
    return { ok: true }
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...design, logos: [] }))
      return { ok: true, withoutLogo: true }
    } catch {
      return { ok: false, reason: 'Votre navigateur bloque le stockage local\u00a0: le design n’a pas pu être enregistré. Exportez-le plutôt.' }
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
  const payload = { ...design, exportedAt: new Date().toISOString(), app: 'HONEG Personnalisation 3D (prototype)' }
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `honeg-design-${stamp()}.json`)
}

export async function readDesignFile(file: File): Promise<Design> {
  if (file.size > 12 * 1024 * 1024) throw new Error('Ce fichier est trop lourd pour être un export de design.')
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new Error('Ce fichier n’est pas un JSON valide. Choisissez un design exporté depuis cet outil.')
  }
  return parseDesign(json)
}

export function stamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}
