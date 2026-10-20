import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { act, render } from '@testing-library/react'
import { AnimatedFavicon } from './AnimatedFavicon'

/**
 * Favicon animée : elle ne doit tourner QUE lorsque l'onglet est en arrière-plan.
 * L'onglet visible garde la favicon statique du site.
 */

type Ctx2D = {
  canvas: HTMLCanvasElement
  clearRect: () => void
  fillRect: () => void
  beginPath: () => void
  moveTo: () => void
  lineTo: () => void
  stroke: () => void
  fill: () => void
  rect: () => void
  roundRect: () => void
  fillStyle: string
  strokeStyle: string
  globalAlpha: number
  lineWidth: number
  lineCap: string
}

function stubCanvas(): void {
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,AAAA')
  HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement) {
    const ctx = {
      canvas: this,
      clearRect: () => undefined,
      fillRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => undefined,
      fill: () => undefined,
      rect: () => undefined,
      roundRect: () => undefined,
      fillStyle: '',
      strokeStyle: '',
      globalAlpha: 1,
      lineWidth: 1,
      lineCap: 'butt',
    } as unknown as Ctx2D
    return ctx
  }) as unknown as HTMLCanvasElement['getContext']
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
}

function iconLinks(): HTMLLinkElement[] {
  return Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'))
}

describe('AnimatedFavicon', () => {
  beforeEach(() => {
    document.head.querySelectorAll('link[rel~="icon"]').forEach((link) => link.remove())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.head.querySelectorAll('link[rel~="icon"]').forEach((link) => link.remove())
  })

  it('laisse la favicon normale tant que l’onglet est visible', () => {
    stubCanvas()
    setHidden(false)
    const staticIcon = document.createElement('link')
    staticIcon.rel = 'icon'
    staticIcon.href = '/favicon.ico'
    document.head.appendChild(staticIcon)

    render(<AnimatedFavicon />)

    expect(iconLinks()).toHaveLength(1)
    expect(iconLinks()[0].getAttribute('href')).toBe('/favicon.ico')
  })

  it('bascule sur la favicon animée quand l’onglet passe en arrière-plan', () => {
    stubCanvas()
    setHidden(true)
    const staticIcon = document.createElement('link')
    staticIcon.rel = 'icon'
    staticIcon.href = '/favicon.ico'
    document.head.appendChild(staticIcon)

    render(<AnimatedFavicon />)

    const links = iconLinks()
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toMatch(/^data:image\/png/)
  })

  it('restaure la favicon normale quand l’onglet redevient visible', () => {
    stubCanvas()
    setHidden(true)
    const staticIcon = document.createElement('link')
    staticIcon.rel = 'icon'
    staticIcon.href = '/favicon.ico'
    document.head.appendChild(staticIcon)

    render(<AnimatedFavicon />)
    expect(iconLinks()).toHaveLength(1)
    expect(iconLinks()[0].getAttribute('href')).toMatch(/^data:image\/png/)

    act(() => {
      setHidden(false)
      document.dispatchEvent(new Event('visibilitychange'))
    })

    const links = iconLinks()
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('/favicon.ico')
  })
})
