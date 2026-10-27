import { create } from 'zustand'
import { en, type Messages } from './en'
import { fr } from './fr'

export type Lang = 'en' | 'fr'
export type { Messages }

const STORAGE_KEY = 'lunar3d.lang'
const DICTIONARIES: Record<Lang, Messages> = { en, fr }

/** English is the main language; a choice made with the switcher is remembered in this browser. */
function initialLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'fr' ? 'fr' : 'en'
  } catch {
    return 'en'
  }
}

export const useLang = create<{ lang: Lang; setLang: (lang: Lang) => void }>()((set) => ({
  lang: initialLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Private mode: the choice lasts for this visit only.
    }
    set({ lang })
  },
}))

export const getLang = (): Lang => useLang.getState().lang

/** Messages in the current language, for components (they re-render when it changes). */
export function useT(): Messages {
  return DICTIONARIES[useLang((s) => s.lang)]
}

/** Messages in the current language, outside React: toasts, exports, validation errors. */
export function t(): Messages {
  return DICTIONARIES[getLang()]
}
