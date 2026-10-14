import type { ViewId } from '../../state/uiStore'

/**
 * Imperative handle registered by the scene (inside the R3F canvas) so DOM
 * controls outside the canvas can drive the camera and capture renders.
 */
export interface ViewerApi {
  zoom: (direction: 1 | -1) => void
  resetCamera: () => void
  /** Renders the given views off-screen and returns PNG data URLs (transparent background). */
  capture: (views: ViewId[], width: number, height: number) => string[]
}

let current: ViewerApi | null = null

export const viewerBridge = {
  register(api: ViewerApi) {
    current = api
    return () => {
      if (current === api) current = null
    }
  },
  get(): ViewerApi | null {
    return current
  },
}
