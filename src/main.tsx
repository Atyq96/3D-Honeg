import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope'
import '@fontsource-variable/unbounded'
import './styles/app.css'
import { CustomizerPage } from './components/CustomizerPage'
import { useDesignStore } from './state/designStore'
import { useUiStore } from './state/uiStore'

// Dev-only handles for end-to-end tests.
if (import.meta.env.DEV) Object.assign(window, { __lunar3d: { useDesignStore, useUiStore } })

const root = createRoot(document.getElementById('root')!)
// Dev-only pattern review page; the import is dropped from production builds.
if (import.meta.env.DEV && location.pathname === '/patterns-preview') {
  void import('./dev/PatternsPreview').then(({ PatternsPreview }) =>
    root.render(
      <StrictMode>
        <PatternsPreview />
      </StrictMode>,
    ),
  )
} else {
  root.render(
    <StrictMode>
      <CustomizerPage />
    </StrictMode>,
  )
}
