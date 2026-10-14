import { MousePointerClick } from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { useActiveLogo } from '../../state/useActiveLogo'
import { MAX_LOGOS } from '../../state/design'
import { LogoUploader } from '../logo/LogoUploader'
import { PlacementPicker } from '../logo/PlacementPicker'
import { LogoTransformControls } from '../logo/LogoTransformControls'
import { BrandMarkControls } from '../logo/BrandMarkControls'
import { Section } from './Section'

export function LogoStep() {
  const count = useDesignStore((s) => s.design.logos.filter((l) => !l.text).length)
  const active = useActiveLogo('image')
  const flatOnly = useUiStore((s) => s.viewerStatus === 'unsupported' || s.viewerStatus === 'error')
  // With several logos, say which one the placement and sliders below apply to.
  const editing = count > 1 && active ? `Editing “${active.asset.name}”. ` : ''
  return (
    <>
      <Section
        title="Logos & photos"
        description={`Up to ${MAX_LOGOS} per garment. Transparent PNGs and SVGs look best; photos print as a rectangle.${count > 1 ? ' Select one to edit it.' : ''}`}
      >
        <LogoUploader />
      </Section>
      {active && (
        <>
          <Section title="Placement" description={`${editing}Pick a side, then a print position. The dashed frame on the shirt shows the printable area.`}>
            <PlacementPicker layer={active} />
          </Section>
          <Section title="Adjust" description={editing || undefined}>
            {!flatOnly && (
              <p className="logo-tip">
                <MousePointerClick size={15} aria-hidden />
                <span>
                  Click a logo on the shirt to drag it, resize it from a corner or rotate it from the top handle (snaps every 45°,{' '}
                  <kbd>Shift</kbd> for free rotation). <kbd>←</kbd>
                  <kbd>→</kbd> nudge, <kbd>Del</kbd> removes.
                </span>
              </p>
            )}
            <LogoTransformControls layer={active} />
          </Section>
        </>
      )}
      <Section title="HONEG mark" description="Every HONEG garment carries the brand mark, like a sportswear maker's logo. Choose the chest it sits on — chest prints take the other side.">
        <BrandMarkControls />
      </Section>
    </>
  )
}
