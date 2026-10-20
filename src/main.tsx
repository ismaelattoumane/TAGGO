import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppRouter } from './app/router'
import { AnimatedFavicon } from './components/AnimatedFavicon'

/**
 * Retire l'écran de chargement statique (index.html) une fois l'application
 * montée : le premier rendu est déjà à l'écran, il n'y a plus de flash blanc.
 */
function BootScreen() {
  useEffect(() => {
    document.getElementById('boot')?.remove()
  }, [])
  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BootScreen />
    <AnimatedFavicon />
    <AppRouter />
  </StrictMode>,
)
