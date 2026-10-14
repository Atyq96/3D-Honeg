import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { useUiStore } from '../../state/uiStore'
import { Scene } from './Scene'
import { draggedRecently } from './gizmoDrag'

/**
 * Everything that depends on three.js lives behind this lazily-loaded module,
 * so the customization UI renders before the 3D bundle arrives.
 */
export default function ViewerCanvas() {
  const setViewerStatus = useUiStore((s) => s.setViewerStatus)

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 30, near: 0.05, far: 30, position: [0, 0.4, 2.4] }}
      // Clicking empty space or plain fabric deselects the logo (OpenMerch's stage-click behaviour).
      onPointerMissed={() => {
        if (!draggedRecently()) useUiStore.getState().selectLogo(false)
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping
        gl.toneMappingExposure = 1.02
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          setViewerStatus('error', 'The graphics context was lost (the GPU may be busy or the tab was in the background).')
        })
      }}
    >
      <Scene />
    </Canvas>
  )
}
