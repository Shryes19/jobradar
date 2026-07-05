import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const container = document.getElementById('root')!

// Reuse root across HMR updates to avoid double-mount warnings
let root = (container as any).__reactRoot
if (!root) {
  root = createRoot(container)
  ;(container as any).__reactRoot = root
}

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
