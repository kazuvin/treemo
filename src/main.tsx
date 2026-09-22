import '@fontsource-variable/noto-sans-mono'
import '@fontsource-variable/noto-sans-jp'
import './styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/app'

const root = document.querySelector('#root')
if (!root) {
  throw new Error('#root が index.html にありません')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
