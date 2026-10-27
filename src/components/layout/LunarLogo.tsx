import { APP_NAME, LUNAR_LOGO_URL } from '../../config/lunar'

/** Lunar Innovate mark with the Lunar 3D wordmark. */
export function LunarLogo() {
  return (
    <span className="brand-logo">
      <img src={LUNAR_LOGO_URL} alt="" width={34} height={34} />
      <span className="brand-wordmark">{APP_NAME}</span>
    </span>
  )
}
