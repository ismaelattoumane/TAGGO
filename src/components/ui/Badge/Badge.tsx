import type { HTMLAttributes } from 'react'
import './Badge.css'

type BadgeTone = 'active' | 'draft' | 'inactive' | 'archived' | 'neutral'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
}

/** TAGGO Badge — normalise .status-pill (statuts QR) + usage générique. */
export function Badge({ tone = 'neutral', children, ...rest }: BadgeProps) {
  const { className, ...attrs } = rest
  return (
    <span
      className={['taggo-badge', `taggo-badge--${tone}`, className].filter(Boolean).join(' ')}
      {...attrs}
    >
      {children}
    </span>
  )
}
