import { useEffect, useState } from 'react'

/**
 * Vrai quand la page a terminé de charger (événement `load` : images, polices, scripts).
 * Si le script est évalué après le `load` (chargement tardif), la page est déjà chargée.
 */
export function usePageLoaded(): boolean {
  const [loaded, setLoaded] = useState(
    () => typeof document !== 'undefined' && document.readyState === 'complete',
  )

  useEffect(() => {
    if (document.readyState === 'complete') return undefined
    const onLoad = (): void => setLoaded(true)
    window.addEventListener('load', onLoad, { once: true })
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return loaded
}
