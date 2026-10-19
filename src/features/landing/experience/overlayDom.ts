import type { OverlayState, ScanState } from './experienceTimeline'

/** Écritures DOM impératives de l’overlay : aucun setState par frame. */
export type OverlayNodes = {
  device: HTMLElement | null
  panels: HTMLElement[]
  lines: HTMLElement[]
  cue: HTMLElement | null
  skip: HTMLElement | null
  bar: HTMLElement | null
  barFill: HTMLElement | null
}

const all = (root: HTMLElement, selector: string): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>(selector))
const one = (root: HTMLElement, selector: string): HTMLElement | null => root.querySelector<HTMLElement>(selector)

export function collectNodes(root: HTMLElement): OverlayNodes {
  return {
    device: one(root, '[data-xp="device"]'),
    panels: all(root, '[data-xp="panel"]'),
    lines: all(root, '[data-xp="line"]'),
    cue: one(root, '[data-xp="cue"]'),
    skip: one(root, '[data-xp="skip"]'),
    bar: one(root, '[data-xp="bar"]'),
    barFill: one(root, '[data-xp="bar-fill"]'),
  }
}

function show(el: HTMLElement | null, opacity: number, threshold = 0.01): void {
  if (!el) return
  el.style.opacity = String(opacity)
  el.style.visibility = opacity > threshold ? 'visible' : 'hidden'
}

export function applyOverlay(nodes: OverlayNodes, state: OverlayState): void {
  show(nodes.cue, state.cue, 0.02)
  show(nodes.skip, state.skip)
  if (nodes.bar) nodes.bar.style.opacity = String(state.bar)
  if (nodes.barFill) nodes.barFill.style.transform = `scaleX(${state.barScale.toFixed(4)})`

  if (nodes.device) {
    show(nodes.device, state.device.opacity)
    nodes.device.style.transform = `translate(calc(-50% + ${state.device.dx.toFixed(1)}px), calc(-50% + ${state.device.dy.toFixed(1)}px))`
  }
  nodes.panels.forEach((panel, i) => show(panel, state.panels[i] ?? 0))
  nodes.panels[1]?.style.setProperty('--tg-sw', String(state.destinationSwitch))

  nodes.lines.forEach((line, i) => {
    const o = state.lines[i] ?? 0
    show(line, o, 0.02)
    line.style.transform = `translateY(${((1 - o) * 10).toFixed(1)}px)`
  })
}

export type ScanBox = { cx: number; cy: number; size: number }

export function applyScan(el: HTMLElement, state: ScanState, box: ScanBox | null): void {
  const visible = state.opacity > 0.01 && box !== null
  el.style.opacity = visible ? String(state.opacity) : '0'
  el.style.visibility = visible ? 'visible' : 'hidden'
  if (!visible || !box) return
  el.style.width = `${box.size}px`
  el.style.height = `${box.size}px`
  el.style.left = `${box.cx - box.size / 2}px`
  el.style.top = `${box.cy - box.size / 2}px`
  el.style.transform = `scale(${state.scale.toFixed(3)})`
  el.classList.toggle('tg-xp__scan--ok', state.locked)
  const line = el.querySelector<HTMLElement>('[data-xp="scan-line"]')
  if (line) line.style.top = `${(state.sweep * 100).toFixed(1)}%`
}
