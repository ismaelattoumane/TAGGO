import { useEffect } from 'react'

/**
 * Favicon TAGGO animée : cadre de scan dont la couleur suit la palette
 * (violet, rose, jaune, cyan) + ligne de balayage.
 *
 * L'animation ne tourne QUE lorsque l'onglet est en arrière-plan : l'onglet
 * visible garde la favicon normale (pas de GIF à 140 ms devant l'utilisateur).
 */

const PALETTE = ['#6F2DA8', '#B56576', '#F4C95D', '#4CC9F0']
const NAVY = '#0B1320'
const CREAM = '#F5E1DA'
const SIZE = 64

type Corner = [number, number, number, number]

const CORNERS: Corner[] = [
  [10, 10, 1, 1],
  [SIZE - 10, 10, -1, 1],
  [10, SIZE - 10, 1, -1],
  [SIZE - 10, SIZE - 10, -1, -1],
]

function drawCorners(ctx: CanvasRenderingContext2D, color: string, alpha: number): void {
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = 6
  ctx.lineCap = 'square'
  for (const [x, y, dx, dy] of CORNERS) {
    ctx.beginPath()
    ctx.moveTo(x + dx * 18, y)
    ctx.lineTo(x, y)
    ctx.lineTo(x, y + dy * 18)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawFrame(ctx: CanvasRenderingContext2D, time: number): string {
  const step = Math.floor(time / 1400)
  const blend = (time % 1400) / 1400

  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = NAVY
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') ctx.roundRect(0, 0, SIZE, SIZE, 14)
  else ctx.rect(0, 0, SIZE, SIZE)
  ctx.fill()

  drawCorners(ctx, PALETTE[step % PALETTE.length], 1)
  drawCorners(ctx, PALETTE[(step + 1) % PALETTE.length], blend)

  ctx.fillStyle = CREAM
  ctx.fillRect(16, 14 + Math.abs(((time / 900) % 2) - 1) * 34, 32, 4)

  return ctx.canvas.toDataURL('image/png')
}

/**
 * Bascule la favicon du site sur une version animée quand l'onglet passe en
 * arrière-plan, et restaure la favicon statique dès qu'il redevient visible.
 */
export function AnimatedFavicon(): null {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const staticIcons = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'),
    )
    let animatedIcon: HTMLLinkElement | null = null
    let timer: number | null = null

    const start = (): void => {
      if (animatedIcon) return
      const canvas = document.createElement('canvas')
      canvas.width = SIZE
      canvas.height = SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const icon = document.createElement('link')
      icon.rel = 'icon'
      icon.type = 'image/png'
      document.head.appendChild(icon)
      animatedIcon = icon

      const paint = (): void => {
        if (!animatedIcon) return
        animatedIcon.href = drawFrame(ctx, performance.now())
      }
      paint()

      staticIcons.forEach((link) => link.remove())
      if (!reduced) timer = window.setInterval(paint, 140)
    }

    const stop = (): void => {
      if (timer !== null) {
        window.clearInterval(timer)
        timer = null
      }
      animatedIcon?.remove()
      animatedIcon = null
      staticIcons.forEach((link) => {
        if (!link.isConnected) document.head.appendChild(link)
      })
    }

    const sync = (): void => {
      if (document.hidden) start()
      else stop()
    }

    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      stop()
    }
  }, [])

  return null
}
