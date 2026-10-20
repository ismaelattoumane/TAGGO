import { useEffect, type RefObject } from 'react'
import { prefersReducedMotion } from '../three/device'

const HEADER_SELECTOR = '.taggo-landing-header'

/**
 * Sections empilées : chaque section reste collée (sticky) et la suivante passe par-dessus.
 *
 * Particularité corrigée : `scrollIntoView` / l’ancre native ne bougent pas pour une section
 * déjà collée. Les liens `#ancre` sont donc interceptés : on calcule la vraie position de la
 * section dans le flux (somme des hauteurs précédentes) et on y défile.
 *
 * Reduced motion : pas d’empilement, mais les ancres restent gérées.
 */
export function useStackedSections(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    const reduced = prefersReducedMotion()
    const sections = (): HTMLElement[] =>
      Array.from(root.children).filter((el): el is HTMLElement => el instanceof HTMLElement && el.tagName === 'SECTION')
    const headerHeight = (): number => document.querySelector<HTMLElement>(HEADER_SELECTOR)?.offsetHeight ?? 0

    const fit = (): void => {
      sections().forEach((section, index) => {
        section.style.zIndex = String(index + 2)
        // Plus haute que l’écran : elle se colle quand son bas atteint le bas de l’écran.
        section.style.top = `${Math.min(0, window.innerHeight - section.offsetHeight)}px`
        if (!section.dataset.tgStacked) {
          section.dataset.tgStacked = '1'
          if (getComputedStyle(section).backgroundColor === 'rgba(0, 0, 0, 0)') {
            section.style.backgroundColor = 'var(--taggo-background, #f5e1da)'
          }
        }
      })
    }

    const naturalTop = (target: HTMLElement): number => {
      const list = sections()
      const base = root.getBoundingClientRect().top + window.scrollY
      return list.slice(0, list.indexOf(target)).reduce((y, section) => y + section.offsetHeight, base)
    }

    const scrollToId = (id: string, behavior: ScrollBehavior): boolean => {
      const target = document.getElementById(id)
      if (!target) return false
      const inStack = target.parentElement === root
      const y = (inStack ? naturalTop(target) : target.getBoundingClientRect().top + window.scrollY) - headerHeight()
      window.scrollTo({ top: Math.max(0, y), behavior })
      return true
    }

    const onClick = (event: MouseEvent): void => {
      const anchor = (event.target as Element | null)?.closest?.('a[href^="#"]')
      const id = anchor?.getAttribute('href')?.slice(1)
      if (!id || !document.getElementById(id)) return
      event.preventDefault()
      scrollToId(id, reduced ? 'auto' : 'smooth')
      window.history.replaceState(null, '', `#${id}`)
    }

    if (!reduced) {
      root.classList.add('tg-stack--on')
      fit()
    }
    document.addEventListener('click', onClick)
    window.addEventListener('resize', fit, { passive: true })
    const observer = typeof ResizeObserver !== 'undefined' && !reduced ? new ResizeObserver(fit) : null
    sections().forEach((section) => observer?.observe(section))

    const hash = window.location.hash.slice(1)
    const timer = hash ? window.setTimeout(() => scrollToId(hash, 'auto'), 300) : 0

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('click', onClick)
      window.removeEventListener('resize', fit)
      observer?.disconnect()
      root.classList.remove('tg-stack--on')
      sections().forEach((section) => {
        section.style.zIndex = ''
        section.style.top = ''
      })
    }
  }, [rootRef])
}
