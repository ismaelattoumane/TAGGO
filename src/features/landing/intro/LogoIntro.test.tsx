import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { LogoIntro } from './LogoIntro'

/**
 * Écran de chargement de la landing : il doit être visible à CHAQUE rechargement
 * de page et ne se fermer que lorsque tout est chargé (page + T-shirt 3D).
 */
describe('LogoIntro', () => {
  afterEach(() => {
    vi.useRealTimers()
    window.sessionStorage.clear()
  })

  it('s’affiche à chaque chargement de page, même si l’intro a déjà été vue', () => {
    window.sessionStorage.setItem('taggo:intro-seen', '1')
    render(<LogoIntro ready={false} />)

    expect(screen.getByRole('status', { name: /chargement/i })).toBeInTheDocument()
  })

  it('reste à l’écran tant que la page n’est pas entièrement chargée', () => {
    vi.useFakeTimers()
    render(<LogoIntro ready={false} />)

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.getByRole('status', { name: /chargement/i })).toBeInTheDocument()
  })

  it('se ferme une fois la page chargée', () => {
    vi.useFakeTimers()
    render(<LogoIntro ready />)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.queryByRole('status', { name: /chargement/i })).toBeNull()
  })
})
