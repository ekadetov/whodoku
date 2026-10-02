import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/caveat/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-700.css'
import './index.css'
import App from './App.tsx'
import { registerBuiltins } from './plugins'

registerBuiltins()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
