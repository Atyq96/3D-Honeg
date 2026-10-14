import type { ViewId } from '../../state/uiStore'
import type { SegmentOption } from '../ui/controls'

export const VIEW_OPTIONS: SegmentOption<ViewId>[] = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'left', label: 'Left', title: "Wearer's left side" },
  { value: 'right', label: 'Right', title: "Wearer's right side" },
]
