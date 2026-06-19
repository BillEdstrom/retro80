import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/electron/renderer'
import App from './App'
import './styles/main.css'

// Renderer-side crash/error capture. Config is inherited from the main process
// (see src/main/sentry.ts); we only init when a DSN was configured at build time.
declare const __SENTRY_DSN__: string
if (__SENTRY_DSN__) Sentry.init({})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
