import type { ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  className?: string
  /** Conservé pour la compatibilité des appels existants, sans effet. */
  delay?: number
}

/**
 * TAGGO Reveal — conteneur neutre des blocs de contenu.
 *
 * La page de référence affiche tout le contenu immédiatement : aucun fondu ni
 * translation au scroll. Le composant reste en place pour garder la structure
 * des sections, mais n'anime plus rien.
 */
export function Reveal({ children, className, delay: _delay }: RevealProps) {
  return <div className={`taggo-reveal${className ? ` ${className}` : ''}`}>{children}</div>
}
