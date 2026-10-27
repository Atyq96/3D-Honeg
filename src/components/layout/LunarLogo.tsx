import { APP_NAME, CRESCENT_PATH, LUNAR_ACCENT, LUNAR_INK } from '../../config/lunar'

/** Lunar 3D mark (amber crescent on an ink tile) with its wordmark. Same artwork as public/favicon.svg. */
export function LunarLogo() {
  return (
    <span className="brand-logo" role="img" aria-label={APP_NAME}>
      <svg viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill={LUNAR_INK} />
        <path d={CRESCENT_PATH} fill={LUNAR_ACCENT} />
      </svg>
      <span className="brand-wordmark" aria-hidden>
        {APP_NAME}
      </span>
    </span>
  )
}
