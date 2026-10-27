import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Hand, LoaderCircle, MonitorX, RefreshCw } from 'lucide-react'
import { useUiStore } from '../../state/uiStore'
import { useDesignStore } from '../../state/designStore'
import { getGarment } from '../../garments/catalog'
import { ViewerErrorBoundary } from './ViewerErrorBoundary'
import { FlatPreview } from './FlatPreview'
import { ViewControls } from './ViewControls'
import { ViewerToolbar } from './ViewerToolbar'
import { StageSummary } from '../summary/StageSummary'
import { LogoToolbar } from '../logo/LogoToolbar'
import { editLayer } from '../../state/useActiveLogo'
import { t, useT } from '../../i18n'

const ViewerCanvas = lazy(() => import('./ViewerCanvas'))

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

const coarsePointer = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches

/** `?flat` forces the 2D fallback, handy for testing the no-WebGL path. */
const forceFlat = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('flat')

export function ProductViewer3D() {
  const [supported] = useState(() => !forceFlat && detectWebGL())
  const [attempt, setAttempt] = useState(0)
  const [interacted, setInteracted] = useState(false)
  const stageRef = useRef<HTMLElement>(null)
  const status = useUiStore((s) => s.viewerStatus)
  const m = useT()
  const viewerError = useUiStore((s) => s.viewerError)
  const setViewerStatus = useUiStore((s) => s.setViewerStatus)
  const logoSelected = useUiStore((s) => s.logoSelected)
  const hasLogo = useDesignStore((s) => s.design.logos.length > 0)

  useEffect(() => {
    if (!supported) setViewerStatus('unsupported')
  }, [supported, setViewerStatus])

  const fallback = !supported || status === 'error'

  return (
    <section className="stage" ref={stageRef} aria-label={m.viewer.preview} data-status={status}>
      {fallback ? (
        <FallbackPreview
          reason={supported ? viewerError ?? m.viewer.stopped : null}
          onRetry={
            supported
              ? () => {
                  setViewerStatus('loading')
                  setAttempt((a) => a + 1)
                }
              : undefined
          }
        />
      ) : (
        <div className="stage-canvas" onPointerDown={() => setInteracted(true)} onWheel={() => setInteracted(true)}>
          <ViewerErrorBoundary key={attempt} onError={(e) => setViewerStatus('error', friendlyError(e))}>
            <Suspense fallback={null}>
              <ViewerCanvas />
            </Suspense>
          </ViewerErrorBoundary>
        </div>
      )}

      {status === 'loading' && !fallback && (
        <div className="stage-loading" role="status">
          <LoaderCircle className="spin" size={22} aria-hidden />
          <span>{m.viewer.preparing}</span>
        </div>
      )}

      {logoSelected && hasLogo ? <LogoToolbar /> : <StageSummary />}
      {!fallback && <ViewerToolbar stageRef={stageRef} />}
      <ViewControls />
      {!fallback && status === 'ready' && !interacted && (
        <p className="stage-hint" aria-hidden>
          <Hand size={14} /> {coarsePointer ? m.viewer.hintTouch : m.viewer.hintMouse}
        </p>
      )}
    </section>
  )
}

function friendlyError(e: Error) {
  const msg = e.message || ''
  if (/webgl|context/i.test(msg)) return t().viewer.errWebgl
  if (/fetch|load|404|gltf|glb/i.test(msg)) return t().viewer.errModel
  return t().viewer.errUnexpected
}

function FallbackPreview({ reason, onRetry }: { reason: string | null; onRetry?: () => void }) {
  const design = useDesignStore((s) => s.design)
  const view = useUiStore((s) => s.view)
  const m = useT()
  const side = view === 'back' ? 'back' : 'front'
  return (
    <div className="stage-fallback">
      <FlatPreview
        className="stage-flat"
        garment={getGarment(design.productId)}
        side={side}
        colors={design.colors}
        patterns={design.patterns}
        brand={design.brand}
        zones={design.zones}
        logos={design.logos}
        label={m.viewer.flatLabel(side)}
        onLogoClick={(id) => {
          const layer = design.logos.find((l) => l.id === id)
          if (layer) editLayer(layer, { turn: false })
        }}
      />
      <div className="fallback-note" role="status">
        <MonitorX size={18} aria-hidden />
        <div>
          <strong>{reason ? m.viewer.unavailable : m.viewer.unsupported}</strong>
          <p>
            {reason ?? m.viewer.noWebgl} {m.viewer.keepGoing}
          </p>
        </div>
        {onRetry && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
            <RefreshCw size={15} aria-hidden /> {m.viewer.retry}
          </button>
        )}
      </div>
    </div>
  )
}
