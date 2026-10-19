import { useRef, type ReactNode } from 'react'
import { useStackedSections } from './useStackedSections'
import './StackedSections.css'

/** Conteneur des sections qui s’empilent au scroll (les enfants directs doivent être des <section>). */
export function StackedSections({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useStackedSections(ref)
  return (
    <div ref={ref} className="tg-stack">
      {children}
    </div>
  )
}
