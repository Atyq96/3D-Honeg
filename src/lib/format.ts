import { getLang } from '../i18n'

/** Numbers as shown in the current language: "5.5" in English, "5,5" in French. Inputs accept both. */
export const num = (n: number): string => (getLang() === 'fr' ? String(n).replace('.', ',') : String(n))
