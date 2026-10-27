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
  const editing = count > 1 && active ? `Modification de «\u00a0${active.asset.name}\u00a0». ` : ''
  return (
    <>
      <Section
        title="Logos et photos"
        description={`Jusqu’à ${MAX_LOGOS} par vêtement. Les PNG transparents et les SVG rendent le mieux ; les photos s’impriment en rectangle.${count > 1 ? ' Sélectionnez-en un pour le modifier.' : ''}`}
      >
        <LogoUploader />
      </Section>
      {active && (
        <>
          <Section title="Emplacement" description={`${editing}Choisissez une face, puis une position. Le cadre en pointillés sur le t-shirt montre la zone imprimable.`}>
            <PlacementPicker layer={active} />
          </Section>
          <Section title="Ajuster" description={editing || undefined}>
            {!flatOnly && (
              <p className="logo-tip">
                <MousePointerClick size={15} aria-hidden />
                <span>
                  Cliquez sur un logo du t-shirt pour le déplacer, l’agrandir par un coin ou le faire pivoter avec la poignée du haut (crans de 45°,{' '}
                  <kbd>Maj</kbd> pour une rotation libre). <kbd>←</kbd>
                  <kbd>→</kbd> pour décaler, <kbd>Suppr</kbd> pour supprimer.
                </span>
              </p>
            )}
            <LogoTransformControls layer={active} />
          </Section>
        </>
      )}
      <Section title="Logo de marque" description="Comme celui d’un équipementier sportif, le logo de la marque figure sur chaque vêtement (ici un logo d’exemple, «&nbsp;YOUR LOGO&nbsp;»). Placez-le à gauche, au centre ou à droite&nbsp;: vos impressions s’organisent autour.">
        <BrandMarkControls />
      </Section>
    </>
  )
}
