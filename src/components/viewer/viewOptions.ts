import type { ViewId } from '../../state/uiStore'
import type { SegmentOption } from '../ui/controls'

export const VIEW_OPTIONS: SegmentOption<ViewId>[] = [
  { value: 'front', label: 'Face' },
  { value: 'back', label: 'Dos' },
  { value: 'left', label: 'Gauche', title: 'Côté gauche du porteur' },
  { value: 'right', label: 'Droite', title: 'Côté droit du porteur' },
]
