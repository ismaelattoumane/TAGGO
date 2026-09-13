import type { ReactNode } from 'react'
import './Typography.css'

type EyebrowProps = {
  children: ReactNode
}

/** TAGGO Eyebrow — normalise .eyebrow (kicker premium). */
export function Eyebrow({ children }: EyebrowProps) {
  return <p className="taggo-eyebrow">{children}</p>
}
