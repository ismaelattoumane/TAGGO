import { Suspense, lazy, useEffect, useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { isWebGlSupported, prefersReducedMotion } from '../../three/device'
import { DevicePanels } from './DevicePanels'
import { EXPERIENCE_CONTENT as C } from './experienceContent'
import { LINE_WINDOWS, getOverlay, getShift, isWideLayout } from './experienceTimeline'
import { applyOverlay, collectNodes } from './overlayDom'
import { useScrollProgress } from './useScrollProgress'
import './StoryExperience.css'

const ExperienceCanvas = lazy(() => import('./ExperienceCanvas').then((m) => ({ default: m.ExperienceCanvas })))

/** full = animation complète · still = T-shirt fixe (reduced motion) · static = sans WebGL (texte seul). */
type Mode = 'full' | 'still' | 'static'

function resolveMode(): Mode {
  if (typeof window === 'undefined' || !isWebGlSupported()) return 'static'
  return prefersReducedMotion() ? 'still' : 'full'
}

/** Expose la hauteur de l’en-tête sticky du site (le hero se colle juste en dessous). */
function useHeaderOffset(rootRef: RefObject<HTMLElement | null>, onChange: () => void): void {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const header = document.querySelector<HTMLElement>('.taggo-landing-header')
    const apply = (): void => {
      root.style.setProperty('--tg-header-h', `${header?.offsetHeight ?? 0}px`)
      onChange()
    }
    apply()
    window.addEventListener('resize', apply, { passive: true })
    const observer = header && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null
    if (header) observer?.observe(header)
    return () => {
      window.removeEventListener('resize', apply)
      observer?.disconnect()
    }
  }, [rootRef, onChange])
}

type StoryExperienceProps = {
  /** Appelé quand le T-shirt est prêt (ou immédiatement sans WebGL) : ferme l’écran de chargement. */
  onReady?: () => void
}

export function StoryExperience({ onReady }: StoryExperienceProps) {
  const heroRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const scanRef = useRef<HTMLDivElement>(null)
  const [mode] = useState<Mode>(resolveMode)
  const full = mode === 'full'
  const ctrl = useScrollProgress(heroRef, stageRef, full)

  useHeaderOffset(heroRef, ctrl.remeasure)

  useEffect(() => {
    if (mode === 'static') onReady?.()
  }, [mode, onReady])

  // Overlay HTML : écrit directement dans le DOM, piloté par la même progression que la caméra.
  useEffect(() => {
    const stage = stageRef.current
    if (!full || !stage) return undefined
    const nodes = collectNodes(stage)
    const draw = (): void => {
      const width = stage.clientWidth
      const height = stage.clientHeight
      const wide = isWideLayout(width, height)
      const p = ctrl.progress.current
      applyOverlay(nodes, getOverlay(p, { wide, width, height, inView: ctrl.inView.current }))
      const shift = getShift(p, wide)
      stage.style.setProperty('--tg-gx', `${(50 + shift.x * 100).toFixed(1)}%`)
      stage.style.setProperty('--tg-gy', `${(46 + shift.y * 100).toFixed(1)}%`)
    }
    draw()
    const unsubscribe = ctrl.subscribe(draw)
    window.addEventListener('resize', draw, { passive: true })
    return () => {
      unsubscribe()
      window.removeEventListener('resize', draw)
    }
  }, [ctrl, full])

  return (
    <section
      ref={heroRef}
      id="story"
      className="tg-xp"
      data-mode={mode}
      data-flow={full ? 'false' : 'true'}
      aria-labelledby="tg-xp-title"
    >
      <div className="visually-hidden">
        <h2>{C.summary.title}</h2>
        <ol>
          {C.summary.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div ref={stageRef} className="tg-xp__stage">
        {mode !== 'static' ? (
          <Suspense fallback={null}>
            <ExperienceCanvas ctrl={ctrl} scanRef={scanRef} reduced={!full} onReady={onReady} />
          </Suspense>
        ) : null}

        <div ref={scanRef} className="tg-xp__scan" aria-hidden="true">
          <i className="tg-xp__corner tg-xp__corner--tl" />
          <i className="tg-xp__corner tg-xp__corner--tr" />
          <i className="tg-xp__corner tg-xp__corner--bl" />
          <i className="tg-xp__corner tg-xp__corner--br" />
          <span data-xp="scan-line" className="tg-xp__scanline" />
          <b className="tg-xp__chip">{C.scan.detected}</b>
        </div>

        <DevicePanels />

        <div className="tg-xp__story">
          {LINE_WINDOWS.map((line) => {
            if (line.kind === 'hero') {
              return (
                <div key={line.id} data-xp="line" className="tg-xp__line">
                  <h1 id="tg-xp-title" className="tg-xp__title">
                    {C.hero.title}
                  </h1>
                  <p className="tg-xp__sub">{C.hero.subtitle}</p>
                  <div className="tg-xp__acts">
                    <button
                      type="button"
                      className="tg-xp__btn tg-xp__btn--primary tg-xp__discover"
                      onClick={() => ctrl.jumpTo(0.1, true)}
                    >
                      {C.hero.discover}
                    </button>
                    <a className="tg-xp__btn tg-xp__btn--ghost" href="#how-it-works">
                      {C.hero.howItWorks}
                    </a>
                  </div>
                </div>
              )
            }
            if (line.kind === 'cta') {
              return (
                <div key={line.id} data-xp="line" className="tg-xp__line">
                  <p className="tg-xp__big">{C.cta.title}</p>
                  <Link className="tg-xp__btn tg-xp__btn--primary tg-xp__cta" to="/register">
                    {C.cta.button}
                  </Link>
                  <small className="tg-xp__note">{C.cta.note}</small>
                </div>
              )
            }
            return (
              <p
                key={line.id}
                data-xp="line"
                className={line.side ? 'tg-xp__line tg-xp__big tg-xp__line--side' : 'tg-xp__line tg-xp__big'}
              >
                {C.lines[line.id]}
              </p>
            )
          })}
        </div>

        <button type="button" data-xp="skip" className="tg-xp__skip" onClick={() => ctrl.jumpTo(1)}>
          {C.controls.skip}
        </button>
        <div data-xp="cue" className="tg-xp__cue" aria-hidden="true">
          {C.controls.cue}
        </div>
        <div data-xp="bar" className="tg-xp__bar" aria-hidden="true">
          <i data-xp="bar-fill" />
        </div>
      </div>
    </section>
  )
}
