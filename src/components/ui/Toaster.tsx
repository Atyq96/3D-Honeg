import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useUiStore } from '../../state/uiStore'

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info }

/** Polite live region for action feedback; errors are announced assertively. */
export function Toaster() {
  const toasts = useUiStore((s) => s.toasts)
  const dismiss = useUiStore((s) => s.dismiss)
  return (
    <div className="toaster">
      <div aria-live="polite" className="sr-only">
        {toasts.filter((t) => t.kind !== 'error').map((t) => t.message).join('. ')}
      </div>
      <div aria-live="assertive" className="sr-only">
        {toasts.filter((t) => t.kind === 'error').map((t) => t.message).join('. ')}
      </div>
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <Icon size={18} aria-hidden />
            <span>{t.message}</span>
            <button type="button" className="toast-close" aria-label="Fermer la notification" onClick={() => dismiss(t.id)}>
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
