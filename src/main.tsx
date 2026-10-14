import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope'
import '@fontsource-variable/unbounded'
import './styles/app.css'
import { CustomizerPage } from './components/CustomizerPage'
import { useDesignStore } from './state/designStore'
import { useUiStore } from './state/uiStore'

// Dev-only handles for end-to-end tests.
if (import.meta.env.DEV) Object.assign(window, { __honeg: { useDesignStore, useUiStore } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CustomizerPage />
  </StrictMode>,
)
