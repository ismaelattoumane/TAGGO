import type { HTMLAttributes, ReactNode } from 'react'
import './Card.css'

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'div'
  padding?: 'md' | 'lg'
  children: ReactNode
}

/** TAGGO Card — normalise .auth-panel / .settings-card / .public-card / .panel. */
export function Card({ as = 'section', padding = 'md', children, ...rest }: CardProps) {
  const Tag = as
  const { className, ...attrs } = rest
  return (
    <Tag
      className={['taggo-card', `taggo-card--${padding}`, className].filter(Boolean).join(' ')}
      {...attrs}
    >
      {children}
    </Tag>
  )
}
