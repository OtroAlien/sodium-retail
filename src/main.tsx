import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// La caja se instala como aplicación y abre sin internet (M4)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'))
}

// Solo en desarrollo: acceso al estado desde la consola para pruebas automáticas
if (import.meta.env.DEV) {
  import('./store').then((m) => {
    ;(window as unknown as { __store: typeof m.useStore }).__store = m.useStore
  })
}
