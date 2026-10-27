import { MousePointerClick } from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { useActiveLogo } from '../../state/useActiveLogo'
import { MAX_LOGOS } from '../../state/design'
import { useT } from '../../i18n'
import { LogoUploader } from '../logo/LogoUploader'
import { PlacementPicker } from '../logo/PlacementPicker'
import { LogoTransformControls } from '../logo/LogoTransformControls'
import { BrandMarkControls } from '../logo/BrandMarkControls'
import { Section } from './Section'

export function LogoStep() {
  const count = useDesignStore((s) => s.design.logos.filter((l) => !l.text).length)
  const active = useActiveLogo('image')
  const flatOnly = useUiStore((s) => s.viewerStatus === 'unsupported' || s.viewerStatus === 'error')
  const m = useT()
  // With several logos, say which one the placement and sliders below apply to.
  const editing = count > 1 && active ? m.logo.editing(active.asset.name) : ''
  return (
    <>
      <Section title={m.logo.title} description={m.logo.desc(MAX_LOGOS, count > 1)}>
        <LogoUploader />
      </Section>
      {active && (
        <>
          <Section title={m.logo.placement} description={`${editing}${m.logo.placementDesc}`}>
            <PlacementPicker layer={active} />
          </Section>
          <Section title={m.logo.adjust} description={editing || undefined}>
            {!flatOnly && (
              <p className="logo-tip">
                <MousePointerClick size={15} aria-hidden />
                <span>
                  {m.logo.tipLogo}
                  <kbd>{m.logo.tipShift}</kbd>
                  {m.logo.tipFree}
                  <kbd>←</kbd>
                  <kbd>→</kbd>
                  {m.logo.tipNudge}
                  <kbd>{m.logo.tipDel}</kbd>
                  {m.logo.tipRemoves}
                </span>
              </p>
            )}
            <LogoTransformControls layer={active} />
          </Section>
        </>
      )}
      <Section title={m.brand.title} description={m.brand.desc}>
        <BrandMarkControls />
      </Section>
    </>
  )
}
