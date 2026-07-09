import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { registerServiceWorker } from './lib/pwa/registerServiceWorker'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker()
