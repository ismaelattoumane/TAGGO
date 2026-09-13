import type { HTMLAttributes, ReactNode } from 'react'
import './Layout.css'

type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

/** TAGGO Container — landing-ready, centered, responsive gutters. */
export function Container({ size = 'md', children, ...rest }: ContainerProps) {
  const { className, ...attrs } = rest
  return (
    <div
      className={['taggo-container', `taggo-container--${size}`, className]
        .filter(Boolean)
        .join(' ')}
      {...attrs}
    >
      {children}
    </div>
  )
}

type SectionProps = HTMLAttributes<HTMLElement> & {
  spacing?: 'md' | 'lg'
  children: ReactNode
}

/** TAGGO Section — vertical rhythm for pages + future landing. */
export function Section({ spacing = 'md', children, ...rest }: SectionProps) {
  const { className, ...attrs } = rest
  return (
    <section
      className={['taggo-section', `taggo-section--${spacing}`, className]
        .filter(Boolean)
        .join(' ')}
      {...attrs}
    >
      {children}
    </section>
  )
}

export function Divider() {
  return <hr className="taggo-divider" />
}
