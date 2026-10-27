import { useEffect } from 'react'
import { useLang, useT, type Lang } from '../../i18n'

const LANGS: Lang[] = ['en', 'fr']

/** EN | FR switch. Keeps the page language and title in step with the choice. */
export function LanguageSwitch() {
  const lang = useLang((s) => s.lang)
  const setLang = useLang((s) => s.setLang)
  const m = useT()
  useEffect(() => {
    document.documentElement.lang = lang
    document.title = m.meta.title
  }, [lang, m])
  return (
    <div className="lang-switch" role="radiogroup" aria-label={m.lang.label}>
      {LANGS.map((l) => (
        <button key={l} type="button" role="radio" aria-checked={lang === l} title={m.lang.names[l]} lang={l} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
