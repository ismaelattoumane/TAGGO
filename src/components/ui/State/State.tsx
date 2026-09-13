import type { HTMLAttributes, ReactNode } from 'react'
import './State.css'

type SpinnerProps = {
  label?: string
}

/** TAGGO Loading — accessible spinner (CSS only, reduced-motion safe). */
export function Loading({ label = 'Chargement…' }: SpinnerProps) {
  return (
    <p className="taggo-loading" role="status">
      <span className="taggo-loading__spinner" aria-hidden="true" />
      {label}
    </p>
  )
}

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title: string
  description?: string
  action?: ReactNode
}

/** TAGGO EmptyState — normalise le "Aucun QR code trouvé" du dashboard. */
export function EmptyState({ title, description, action, ...rest }: EmptyStateProps) {
  const { className, ...attrs } = rest
  return (
    <div
      role="status"
      className={['taggo-empty', className].filter(Boolean).join(' ')}
      {...attrs}
    >
      <p className="taggo-empty__title">{title}</p>
      {description ? <p className="taggo-empty__description">{description}</p> : null}
      {action ? <div className="taggo-empty__action">{action}</div> : null}
    </div>
  )
}
