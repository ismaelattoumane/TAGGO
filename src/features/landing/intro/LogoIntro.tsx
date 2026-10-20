import { useEffect, useState, type CSSProperties } from 'react'
import { prefersReducedMotion } from '../../three/device'
import { FRAME_PATHS, LOGOMARK_VIEWBOX, PIXEL_PATHS } from './logomarkPaths'
import './LogoIntro.css'

const MIN_FIRST_MS = 1400
const MIN_REDUCED_MS = 600
const SAFETY_MS = 9000
const FADE_MS = 700

/**
 * Écran de chargement : le logomark TAGGO se construit (cadre, puis diagonale pixel par pixel,
 * puis balayage de scan). Il se ferme quand TOUT est chargé (page + T-shirt 3D) et se
 * réaffiche à chaque rechargement de la page.
 */
export function LogoIntro({ ready }: { ready: boolean }) {
  const [out, setOut] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const safety = window.setTimeout(() => setOut(true), SAFETY_MS)
    return () => window.clearTimeout(safety)
  }, [])

  useEffect(() => {
    if (!ready) return undefined
    const minimum = prefersReducedMotion() ? MIN_REDUCED_MS : MIN_FIRST_MS
    const timer = window.setTimeout(() => setOut(true), Math.max(0, minimum - performance.now()))
    return () => window.clearTimeout(timer)
  }, [ready])

  useEffect(() => {
    if (!out) return undefined
    const timer = window.setTimeout(() => setGone(true), FADE_MS)
    return () => window.clearTimeout(timer)
  }, [out])

  if (gone) return null

  return (
    <div
      className={`tg-intro${out ? ' tg-intro--out' : ''}`}
      role="status"
      aria-label="Chargement de TAGGO"
    >
      <svg className="tg-intro__mark" viewBox={LOGOMARK_VIEWBOX} aria-hidden="true" focusable="false">
        <g className="tg-intro__frame">
          {FRAME_PATHS.map((d, i) => (
            <path key={d} d={d} fill="currentColor" style={{ '--i': i } as CSSProperties} />
          ))}
        </g>
        <g className="tg-intro__pixels">
          {PIXEL_PATHS.map((d, i) => (
            <path key={d} d={d} fill="currentColor" style={{ '--d': `${(0.45 + i * 0.07).toFixed(2)}s` } as CSSProperties} />
          ))}
        </g>
        <rect className="tg-intro__scan" x="-6" y="-2" width="138" height="4" rx="2" />
      </svg>
      <p className="tg-intro__tag">Le T-shirt connecté.</p>
    </div>
  )
}
