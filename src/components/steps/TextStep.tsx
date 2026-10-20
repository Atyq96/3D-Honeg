import { useRef, useState } from 'react'
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, ChevronUp, LoaderCircle, MousePointerClick, Trash2, Type } from 'lucide-react'
import { useDesignStore } from '../../state/designStore'
import { useUiStore } from '../../state/uiStore'
import { editLayer, useActiveLogo } from '../../state/useActiveLogo'
import { cleanTextContent, letterHeightCm, logoAspect, MAX_TEXT_LINE_CHARS, MAX_TEXT_LINES, MAX_TEXTS, type LogoLayer, type TextAlign, type TextSpec } from '../../state/design'
import { getGarment } from '../../garments/catalog'
import { DEFAULT_FONT, getFont, TEXT_FONTS } from '../../config/fonts'
import { isLight } from '../../lib/color'
import { maxWidthCm, MIN_LOGO_CM } from '../../lib/logoTransform'
import { renderText } from '../../lib/textRender'
import { fr } from '../../lib/format'
import { IconButton, RangeField, Segmented } from '../ui/controls'
import { InkPicker } from '../ui/InkPicker'
import { PlacementPicker } from '../logo/PlacementPicker'
import { LogoTransformControls } from '../logo/LogoTransformControls'
import { Section } from './Section'

type TextLayer = LogoLayer & { text: TextSpec }

/** Quick letter heights, cm (common on sportswear: crest, chest, back name, big back print). */
const SIZE_PRESETS: [string, number][] = [
  ['S', 2],
  ['M', 4],
  ['L', 7],
  ['XL', 10],
]

export function TextStep() {
  const active = useActiveLogo('text') as TextLayer | null
  const flatOnly = useUiStore((s) => s.viewerStatus === 'unsupported' || s.viewerStatus === 'error')
  return (
    <>
      <Section title="Vos textes" description={`Noms, numéros ou slogans\u00a0: jusqu’à ${MAX_TEXTS} blocs de texte, chacun avec sa police, sa taille et sa couleur.`}>
        <TextList />
      </Section>
      {active && (
        <>
          <Section title="Modifier le texte">
            {/* Keyed so the draft and pending renders never leak between text blocks. */}
            <TextEditor key={active.id} layer={active} />
          </Section>
          <Section title="Emplacement" description="Choisissez une face, puis une position. Le cadre en pointillés sur le t-shirt montre la zone imprimable.">
            <PlacementPicker layer={active} />
          </Section>
          <Section title="Ajuster">
            {!flatOnly && (
              <p className="logo-tip">
                <MousePointerClick size={15} aria-hidden />
                <span>
                  Cliquez sur le texte du t-shirt pour le déplacer, l’agrandir par un coin ou le faire pivoter avec la poignée du haut. <kbd>←</kbd>
                  <kbd>→</kbd> pour décaler, <kbd>Suppr</kbd> pour supprimer.
                </span>
              </p>
            )}
            <LogoTransformControls layer={active} showSize={false} />
          </Section>
        </>
      )}
    </>
  )
}

/** Focuses the wording field with its text selected, so typing replaces the placeholder. */
const focusContent = () =>
  requestAnimationFrame(() => {
    const el = document.getElementById('text-content') as HTMLTextAreaElement | null
    el?.focus()
    el?.select()
  })

function TextList() {
  const logos = useDesignStore((s) => s.design.logos)
  const body = useDesignStore((s) => s.design.colors.body)
  const productId = useDesignStore((s) => s.design.productId)
  const active = useActiveLogo('text')
  const notify = useUiStore((s) => s.notify)
  const [busy, setBusy] = useState(false)
  const texts = logos.filter((l): l is TextLayer => !!l.text)
  const garment = getGarment(productId)

  const add = async () => {
    setBusy(true)
    try {
      const spec = { content: 'Votre texte', font: DEFAULT_FONT, align: 'center' as TextAlign }
      const { asset, capPx } = await renderText(spec)
      // Readable on the fabric: white on dark, black on light.
      const id = useDesignStore.getState().addText({ ...spec, capPx, sizeCm: 4 }, asset, isLight(body) ? '#0E0E0E' : '#FFFFFF')
      const layer = useDesignStore.getState().design.logos.find((l) => l.id === id)
      if (!layer) return notify('info', `Un vêtement accueille jusqu’à ${MAX_TEXTS} blocs de texte. Retirez-en un pour en ajouter un autre.`)
      editLayer(layer)
      focusContent()
    } catch (err) {
      console.error(err)
      notify('error', 'Le texte n’a pas pu être créé. Réessayez.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="logo-library">
      {texts.length > 0 && (
        <ul className="logo-list" aria-label="Vos blocs de texte">
          {[...texts].reverse().map((layer) => {
            const index = logos.indexOf(layer)
            const isActive = layer.id === active?.id
            const name = layer.asset.name
            const preset = garment.placements.find((p) => p.id === layer.placement.placement)
            return (
              <li key={layer.id} className={`logo-item ${isActive ? 'is-active' : ''}`}>
                <button type="button" className="logo-item-main" aria-pressed={isActive} onClick={() => editLayer(layer)}>
                  {/* The rendered lettering in its colour, on the fabric colour. */}
                  <span className="logo-item-thumb text-thumb" style={{ background: body }} aria-hidden>
                    <span
                      className="text-thumb-ink"
                      style={{ background: layer.placement.tint ?? '#0E0E0E', maskImage: `url(${layer.asset.dataUrl})`, WebkitMaskImage: `url(${layer.asset.dataUrl})` }}
                    />
                  </span>
                  <span className="logo-item-text">
                    <strong title={name}>{name}</strong>
                    <span>
                      {getFont(layer.text.font).label} · {fr(letterHeightCm(layer))} cm · {preset?.label}
                    </span>
                  </span>
                </button>
                <div className="logo-item-actions">
                  {logos.length > 1 && (
                    <>
                      <IconButton
                        label={`Avancer «\u00a0${name}\u00a0»`}
                        tip="Avancer"
                        className="icon-btn-sm"
                        disabled={index === logos.length - 1}
                        onClick={() => useDesignStore.getState().moveLogo(layer.id, 1)}
                      >
                        <ChevronUp size={16} />
                      </IconButton>
                      <IconButton
                        label={`Reculer «\u00a0${name}\u00a0»`}
                        tip="Reculer"
                        className="icon-btn-sm"
                        disabled={index === 0}
                        onClick={() => useDesignStore.getState().moveLogo(layer.id, -1)}
                      >
                        <ChevronDown size={16} />
                      </IconButton>
                    </>
                  )}
                  <IconButton
                    label={`Retirer «\u00a0${name}\u00a0»`}
                    tip="Retirer"
                    tipSide="left"
                    className="icon-btn-sm is-danger"
                    onClick={() => {
                      useDesignStore.getState().removeLogo(layer.id)
                      useUiStore.getState().selectLogo(false)
                      notify('info', `«\u00a0${name}\u00a0» retiré. Annulez pour le récupérer.`)
                    }}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {texts.length < MAX_TEXTS ? (
        <button type="button" className="logo-add" onClick={() => void add()} disabled={busy}>
          {busy ? <LoaderCircle size={16} className="spin" aria-hidden /> : <Type size={16} aria-hidden />}
          <span>{texts.length ? 'Ajouter un autre texte' : 'Ajouter du texte'}</span>
          <span className="logo-add-count">
            {texts.length} sur {MAX_TEXTS}
          </span>
        </button>
      ) : (
        <p className="logo-limit">
          {MAX_TEXTS} sur {MAX_TEXTS} utilisés&nbsp;: retirez-en un pour en ajouter un autre.
        </p>
      )}
    </div>
  )
}

/**
 * Wording, font, letter height, colour and alignment of one text block.
 * Wording and font changes re-render the lettering; colour and size don't need to.
 */
function TextEditor({ layer }: { layer: TextLayer }) {
  const productId = useDesignStore((s) => s.design.productId)
  const notify = useUiStore((s) => s.notify)
  const [draft, setDraft] = useState<string | null>(null)
  // Changes waiting for a render; merged so quick font + typing changes don't drop each other.
  const pending = useRef<Partial<TextSpec>>({})
  const seq = useRef(0)
  const { text, asset, placement } = layer
  const value = draft ?? text.content

  const apply = async (patch: Partial<TextSpec>, coalesce?: string) => {
    pending.current = { ...pending.current, ...patch }
    const current = useDesignStore.getState().design.logos.find((l) => l.id === layer.id)?.text
    if (!current) return
    const next = { ...current, ...pending.current }
    if (!next.content.trim()) return
    const n = ++seq.current
    try {
      const rendered = await renderText(next)
      if (n !== seq.current) return
      pending.current = {}
      useDesignStore.getState().setText(layer.id, { ...next, capPx: rendered.capPx }, rendered.asset, coalesce ? { coalesce } : undefined)
      setDraft(null)
    } catch (err) {
      console.error(err)
      notify('error', 'Ce texte n’a pas pu être dessiné. Essayez d’autres caractères.')
    }
  }

  // Letter-height range follows from the print area (and the 3 cm minimum print width).
  const garment = getGarment(productId)
  const preset = garment.placements.find((p) => p.id === placement.placement) ?? garment.placements[0]
  const toLetter = (widthCm: number) => (widthCm * text.capPx) / asset.width
  const maxLetter = Math.max(1, Math.floor(toLetter(maxWidthCm(garment.printAreas[preset.side], logoAspect(asset), placement.rotationDeg)) * 2) / 2)
  const minLetter = Math.min(maxLetter, Math.max(0.5, Math.ceil(toLetter(MIN_LOGO_CM) * 2) / 2))
  const setLetter = (cm: number, coalesce?: string) =>
    useDesignStore.getState().updateTransform(layer.id, { widthCm: (cm * asset.width) / text.capPx }, coalesce ? { coalesce } : undefined)
  const letter = letterHeightCm(layer)
  const sample = value.split('\n')[0].trim().slice(0, 12) || 'Aa'
  const empty = !value.trim()

  return (
    <div className="text-editor">
      <div className="field">
        <label className="field-label" htmlFor="text-content">
          Texte
        </label>
        <textarea
          id="text-content"
          className={`text-input ${empty ? 'is-invalid' : ''}`}
          value={value}
          rows={Math.min(MAX_TEXT_LINES, value.split('\n').length)}
          spellCheck={false}
          aria-invalid={empty}
          aria-describedby="text-content-hint"
          onChange={(e) => {
            const v = cleanTextContent(e.target.value)
            setDraft(v)
            void apply({ content: v }, 'text')
          }}
          onBlur={() => {
            if (!empty) return
            // Leaving it empty keeps the last printed wording (and applies any font picked meanwhile).
            delete pending.current.content
            setDraft(null)
            void apply({})
          }}
        />
        <p id="text-content-hint" className={empty ? 'field-error' : 'field-hint'}>
          {empty ? 'Saisissez un texte à imprimer.' : `Jusqu’à ${MAX_TEXT_LINES} lignes de ${MAX_TEXT_LINE_CHARS} caractères. Entrée pour aller à la ligne.`}
        </p>
      </div>

      <div className="field">
        <span className="field-label" id="text-font-label">
          Police
        </span>
        <div className="font-grid" role="radiogroup" aria-labelledby="text-font-label">
          {TEXT_FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={text.font === f.id}
              className="font-card"
              title={f.hint}
              onClick={() => void apply({ font: f.id })}
            >
              <span className="font-sample" style={{ fontFamily: `"${f.family}"`, fontWeight: f.weight }}>
                {sample}
              </span>
              <span className="font-name">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <RangeField
          label="Hauteur des lettres"
          icon={<Type size={15} aria-hidden />}
          value={letter}
          min={minLetter}
          max={maxLetter}
          step={0.5}
          unit="cm"
          onChange={(v, dragging) => setLetter(v, dragging ? 'size' : undefined)}
          hint="Hauteur des majuscules une fois imprimées. Un texte long est limité par la largeur imprimable."
        />
        <div className="size-chips" role="group" aria-label="Hauteurs rapides">
          {SIZE_PRESETS.map(([label, cm]) => (
            <button
              key={label}
              type="button"
              className={`size-chip ${Math.abs(letter - Math.min(cm, maxLetter)) < 0.05 ? 'is-active' : ''}`}
              disabled={cm > maxLetter && label !== 'S'}
              title={`Lettres de ${cm} cm`}
              onClick={() => setLetter(Math.min(cm, maxLetter))}
            >
              {label} <span>{cm} cm</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Couleur</span>
        <InkPicker value={placement.tint} onChange={(hex) => useDesignStore.getState().updateTransform(layer.id, { tint: hex })} label="Couleur du texte" id="text-color-hex" />
      </div>

      {text.content.includes('\n') && (
        <Segmented<TextAlign>
          label="Alignement des lignes"
          value={text.align}
          size="sm"
          options={[
            { value: 'left', label: 'Gauche', icon: <AlignLeft size={15} aria-hidden /> },
            { value: 'center', label: 'Centre', icon: <AlignCenter size={15} aria-hidden /> },
            { value: 'right', label: 'Droite', icon: <AlignRight size={15} aria-hidden /> },
          ]}
          onChange={(align) => void apply({ align })}
        />
      )}
    </div>
  )
}
