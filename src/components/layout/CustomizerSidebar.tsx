import { useEffect, useRef } from 'react'
import { Check, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { STEPS, useUiStore, type StepId } from '../../state/uiStore'
import { useDesignStore } from '../../state/designStore'
import { DEFAULT_BODY_COLOR } from '../../config/palette'
import { exportPreviewImage } from '../../state/actions'
import { ProductStep } from '../steps/ProductStep'
import { ColorStep } from '../steps/ColorStep'
import { LogoStep } from '../steps/LogoStep'
import { PatternStep } from '../steps/PatternStep'
import { ReviewStep } from '../steps/ReviewStep'
import { TextStep } from '../steps/TextStep'

const TITLES: Record<StepId, string> = {
  product: 'Pick your tee',
  color: 'Set your colors',
  pattern: 'Add a pattern',
  logo: 'Add your logo',
  text: 'Add text',
  review: 'Review & export',
}

export function CustomizerSidebar() {
  const step = useUiStore((s) => s.step)
  const setStep = useUiStore((s) => s.setStep)
  const design = useDesignStore((s) => s.design)
  const panel = useRef<HTMLDivElement>(null)
  const index = STEPS.findIndex((s) => s.id === step)

  const done: Record<StepId, boolean> = {
    product: true,
    color: design.colors.body !== DEFAULT_BODY_COLOR || design.colors.sleeves !== null || design.colors.collar !== null,
    pattern: Object.values(design.patterns).some(Boolean),
    logo: design.logos.some((l) => !l.text),
    text: design.logos.some((l) => l.text),
    review: false,
  }

  useEffect(() => {
    panel.current?.scrollTo({ top: 0 })
  }, [step])

  return (
    <aside className="sidebar" aria-label="Customization">
      <nav className="stepper" aria-label="Customization steps">
        <ol>
          {STEPS.map((s, i) => (
            <li key={s.id} className={`${i < index ? 'is-past' : ''} ${s.id === step ? 'is-current' : ''}`}>
              <button type="button" className="step-btn" aria-current={s.id === step ? 'step' : undefined} onClick={() => setStep(s.id)}>
                <span className={`step-num ${done[s.id] && s.id !== step ? 'is-done' : ''}`} aria-hidden>
                  {done[s.id] && s.id !== step ? <Check size={13} strokeWidth={3} /> : i + 1}
                </span>
                <span className="step-label">{s.label}</span>
                {done[s.id] && <span className="sr-only">(completed)</span>}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="panel" ref={panel}>
        <div className="panel-head">
          <span className="panel-kicker">
            Step {index + 1} of {STEPS.length}
          </span>
          <h2 className="panel-title">{TITLES[step]}</h2>
        </div>
        {step === 'product' && <ProductStep />}
        {step === 'color' && <ColorStep />}
        {step === 'pattern' && <PatternStep />}
        {step === 'logo' && <LogoStep />}
        {step === 'text' && <TextStep />}
        {step === 'review' && <ReviewStep />}
      </div>

      <footer className="panel-footer">
        <button type="button" className="btn btn-ghost" disabled={index === 0} onClick={() => setStep(STEPS[index - 1].id)}>
          <ChevronLeft size={16} aria-hidden /> Back
        </button>
        {index < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={() => setStep(STEPS[index + 1].id)}>
            Next: {STEPS[index + 1].label} <ChevronRight size={16} aria-hidden />
          </button>
        ) : (
          <button type="button" className="btn btn-accent" onClick={() => void exportPreviewImage()}>
            <Download size={16} aria-hidden /> Download preview
          </button>
        )}
      </footer>
    </aside>
  )
}
