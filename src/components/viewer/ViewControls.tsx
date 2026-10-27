import { useUiStore } from '../../state/uiStore'
import { Segmented } from '../ui/controls'
import { viewOptions } from './viewOptions'
import { useT } from '../../i18n'

/** Camera view shortcuts overlaid on the preview. In the 2D fallback only front/back apply. */
export function ViewControls() {
  const view = useUiStore((s) => s.view)
  const setView = useUiStore((s) => s.setView)
  const flat = useUiStore((s) => s.viewerStatus === 'unsupported' || s.viewerStatus === 'error')
  const m = useT()
  const all = viewOptions(m)
  const options = flat ? all.map((o) => ({ ...o, disabled: o.value === 'left' || o.value === 'right' })) : all
  return (
    <div className="stage-views">
      <Segmented label={m.views.camera} value={view} options={options} onChange={setView} size="sm" />
    </div>
  )
}
