import { useEffect, useState, type RefObject } from 'react'
import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { IconButton } from '../ui/controls'
import { viewerBridge } from './viewerBridge'
import { useT } from '../../i18n'

/**
 * Zoom / reset / fullscreen. Fullscreen uses the Fullscreen API where available
 * and falls back to an expanded in-page mode (e.g. iPhone Safari).
 */
export function ViewerToolbar({ stageRef }: { stageRef: RefObject<HTMLElement | null> }) {
  const [expanded, setExpanded] = useState(false)
  const m = useT()

  useEffect(() => {
    const onChange = () => setExpanded(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [stageRef])

  useEffect(() => {
    const el = stageRef.current
    if (!el || document.fullscreenEnabled) return
    el.classList.toggle('is-expanded', expanded)
    document.body.classList.toggle('no-scroll', expanded)
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded, stageRef])

  const toggleFullscreen = () => {
    const el = stageRef.current
    if (!el) return
    if (document.fullscreenEnabled) {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void el.requestFullscreen().catch(() => setExpanded((v) => !v))
    } else setExpanded((v) => !v)
  }

  return (
    <div className="stage-tools" role="toolbar" aria-label={m.viewer.controls} aria-orientation="vertical">
      <IconButton label={m.viewer.zoomIn} tipSide="left" className="hide-touch" onClick={() => viewerBridge.get()?.zoom(1)}>
        <ZoomIn size={18} />
      </IconButton>
      <IconButton label={m.viewer.zoomOut} tipSide="left" className="hide-touch" onClick={() => viewerBridge.get()?.zoom(-1)}>
        <ZoomOut size={18} />
      </IconButton>
      <IconButton label={m.viewer.resetCamera} tipSide="left" onClick={() => viewerBridge.get()?.resetCamera()}>
        <RotateCcw size={18} />
      </IconButton>
      <IconButton
        label={expanded ? m.viewer.exitFullscreen : m.viewer.fullscreen}
        tipSide="left"
        aria-pressed={expanded}
        onClick={toggleFullscreen}
      >
        {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </IconButton>
    </div>
  )
}
