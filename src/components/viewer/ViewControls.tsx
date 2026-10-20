import { useUiStore } from '../../state/uiStore'
import { Segmented } from '../ui/controls'
import { VIEW_OPTIONS } from './viewOptions'

/** Camera view shortcuts overlaid on the preview. In the 2D fallback only front/back apply. */
export function ViewControls() {
  const view = useUiStore((s) => s.view)
  const setView = useUiStore((s) => s.setView)
  const flat = useUiStore((s) => s.viewerStatus === 'unsupported' || s.viewerStatus === 'error')
  const options = flat ? VIEW_OPTIONS.map((o) => ({ ...o, disabled: o.value === 'left' || o.value === 'right' })) : VIEW_OPTIONS
  return (
    <div className="stage-views">
      <Segmented label="Vue de la caméra" value={view} options={options} onChange={setView} size="sm" />
    </div>
  )
}
