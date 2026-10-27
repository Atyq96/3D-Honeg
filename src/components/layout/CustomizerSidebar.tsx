import { useEffect, useRef } from 'react'
import { Check, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { STEPS, useUiStore, type StepId } from '../../state/uiStore'
import { useT } from '../../i18n'
import { useDesignStore } from '../../state/designStore'
import { DEFAULT_BODY_COLOR } from '../../config/palette'
import { exportPreviewImage } from '../../state/actions'
import { ProductStep } from '../steps/ProductStep'
import { ColorStep } from '../steps/ColorStep'
import { LogoStep } from '../steps/LogoStep'
import { PatternStep } from '../steps/PatternStep'
import { ReviewStep } from '../steps/ReviewStep'
import { TextStep } from '../steps/TextStep'


export function CustomizerSidebar() {
  const step = useUiStore((s) => s.step)
  const setStep = useUiStore((s) => s.setStep)
  const design = useDesignStore((s) => s.design)
  const panel = useRef<HTMLDivElement>(null)
  const index = STEPS.indexOf(step)
  const m = useT()

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
    <aside className="sidebar" aria-label={m.steps.sidebar}>
      <nav className="stepper" aria-label={m.steps.nav}>
        <ol>
          {STEPS.map((s, i) => (
            <li key={s} className={`${i < index ? 'is-past' : ''} ${s === step ? 'is-current' : ''}`}>
              <button type="button" className="step-btn" aria-current={s === step ? 'step' : undefined} onClick={() => setStep(s)}>
                <span className={`step-num ${done[s] && s !== step ? 'is-done' : ''}`} aria-hidden>
                  {done[s] && s !== step ? <Check size={13} strokeWidth={3} /> : i + 1}
                </span>
                <span className="step-label">{m.steps[s].label}</span>
                {done[s] && <span className="sr-only">{m.common.completed}</span>}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="panel" ref={panel}>
        <div className="panel-head">
          <span className="panel-kicker">
            {m.common.stepOf(index + 1, STEPS.length)}
          </span>
          <h2 className="panel-title">{m.steps[step].title}</h2>
        </div>
        {step === 'product' && <ProductStep />}
        {step === 'color' && <ColorStep />}
        {step === 'pattern' && <PatternStep />}
        {step === 'logo' && <LogoStep />}
        {step === 'text' && <TextStep />}
        {step === 'review' && <ReviewStep />}
      </div>

      <footer className="panel-footer">
        <button type="button" className="btn btn-ghost" disabled={index === 0} onClick={() => setStep(STEPS[index - 1])}>
          <ChevronLeft size={16} aria-hidden /> {m.common.back}
        </button>
        {index < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={() => setStep(STEPS[index + 1])}>
            {m.common.next(m.steps[STEPS[index + 1]].label)} <ChevronRight size={16} aria-hidden />
          </button>
        ) : (
          <button type="button" className="btn btn-accent" onClick={() => void exportPreviewImage()}>
            <Download size={16} aria-hidden /> {m.common.downloadPreview}
          </button>
        )}
      </footer>
    </aside>
  )
}
