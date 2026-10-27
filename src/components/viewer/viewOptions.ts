import type { ViewId } from '../../state/uiStore'
import type { SegmentOption } from '../ui/controls'
import type { Messages } from '../../i18n'

export const viewOptions = (m: Messages): SegmentOption<ViewId>[] => [
  { value: 'front', label: m.views.front },
  { value: 'back', label: m.views.back },
  { value: 'left', label: m.views.left, title: m.views.leftTitle },
  { value: 'right', label: m.views.right, title: m.views.rightTitle },
]
