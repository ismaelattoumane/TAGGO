import { useEffect, useMemo, type RefObject } from 'react'
import { clamp } from './experienceTimeline'

/**
 * Contrôleur de progression du hero.
 *
 * - `progress` : valeur lissée 0 → 1, lue par la caméra ET l’overlay (une seule source).
 * - `subscribe` : les abonnés ne sont notifiés que si la progression change
 *   (ou pendant l’oscillation d’accueil) : pas de rendu inutile quand l’écran est immobile.
 */
export type ScrollController = {
  progress: { current: number }
  inView: { current: boolean }
  jumpTo: (value: number, smooth?: boolean) => void
  subscribe: (listener: () => void) => () => void
  /** À rappeler quand la hauteur de l’en-tête (offset sticky) change. */
  remeasure: () => void
  attach: (hero: HTMLElement, stage: HTMLElement) => () => void
}

export function createScrollController(): ScrollController {
  const progress = { current: 0 }
  const inView = { current: true }
  const listeners = new Set<() => void>()
  let dirty = true
  let hero: HTMLElement | null = null
  let stage: HTMLElement | null = null
  let stuckTop = 0

  const measure = (): void => {
    if (!stage) return
    stuckTop = parseFloat(getComputedStyle(stage).top) || 0
    dirty = true
  }

  const scrollDistance = (): number => (hero && stage ? Math.max(1, hero.offsetHeight - stage.clientHeight) : 1)

  return {
    progress,
    inView,
    remeasure: measure,
    subscribe(listener) {
      listeners.add(listener)
      dirty = true
      return () => {
        listeners.delete(listener)
      }
    },
    jumpTo(value, smooth = false) {
      if (!hero || !stage) return
      const heroTop = hero.getBoundingClientRect().top + window.scrollY
      const y = heroTop - stuckTop + clamp(value) * scrollDistance()
      if (!smooth) progress.current = clamp(value)
      window.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' })
    },
    attach(heroEl, stageEl) {
      hero = heroEl
      stage = stageEl
      measure()
      let frame = 0
      let last = -1
      let target = 0

      const tick = (): void => {
        const rect = heroEl.getBoundingClientRect()
        inView.current = rect.bottom > stuckTop + stageEl.clientHeight * 0.5
        target = clamp((stuckTop - rect.top) / scrollDistance())
        let next = progress.current + (target - progress.current) * 0.12
        if (Math.abs(target - next) < 0.0004) next = target
        progress.current = next
        if (next !== last || next < 0.05 || dirty) {
          last = next
          dirty = false
          listeners.forEach((listener) => listener())
        }
        frame = requestAnimationFrame(tick)
      }

      window.addEventListener('resize', measure, { passive: true })
      frame = requestAnimationFrame(tick)
      return () => {
        cancelAnimationFrame(frame)
        window.removeEventListener('resize', measure)
        hero = null
        stage = null
      }
    },
  }
}

export function useScrollProgress(
  heroRef: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): ScrollController {
  const controller = useMemo(() => createScrollController(), [])
  useEffect(() => {
    const hero = heroRef.current
    const stage = stageRef.current
    if (!enabled || !hero || !stage) return undefined
    return controller.attach(hero, stage)
  }, [controller, enabled, heroRef, stageRef])
  return controller
}
