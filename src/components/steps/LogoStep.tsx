import { MousePointerClick } from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { LogoUploader } from '../logo/LogoUploader'
import { PlacementPicker } from '../logo/PlacementPicker'
import { LogoTransformControls } from '../logo/LogoTransformControls'
import { BrandMarkControls } from '../logo/BrandMarkControls'
import { Section } from './Section'

export function LogoStep() {
  const hasLogo = useDesignStore((s) => !!s.design.logo)
  const flatOnly = useUiStore((s) => s.viewerStatus === 'unsupported' || s.viewerStatus === 'error')
  return (
    <>
      <Section title="Your logo" description="Transparent PNGs and SVGs look best on fabric.">
        <LogoUploader />
      </Section>
      <Section title="Placement" description="Pick a side, then a print position. The dashed frame on the shirt shows the printable area.">
        <PlacementPicker />
      </Section>
      <Section title="Adjust" description={hasLogo ? undefined : 'Upload a logo to adjust its size, rotation and position.'}>
        {hasLogo && !flatOnly && (
          <p className="logo-tip">
            <MousePointerClick size={15} aria-hidden />
            <span>
              Click the logo on the shirt to drag it, resize it from a corner or rotate it from the top handle (snaps every 45°,{' '}
              <kbd>Shift</kbd> for free rotation). <kbd>←</kbd>
              <kbd>→</kbd> nudge, <kbd>Del</kbd> removes.
            </span>
          </p>
        )}
        <LogoTransformControls />
      </Section>
      <Section title="HONEG mark" description="Every HONEG garment carries the brand mark, like a sportswear maker's logo. Choose the chest it sits on — your logo takes the other side.">
        <BrandMarkControls />
      </Section>
    </>
  )
}
