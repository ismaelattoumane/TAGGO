export type StoryScene = {
  start: number
  enter: number
  holdStart: number
  holdEnd: number
  exit: number
  end: number
}

export const STORY_TIMELINE = {
  hero: { start: 0, enter: 0.04, holdStart: 0.09, holdEnd: 0.12, exit: 0.15, end: 0.18 },
  concept: { start: 0.12, enter: 0.18, holdStart: 0.2, holdEnd: 0.28, exit: 0.31, end: 0.33 },
  howItWorks: { start: 0.25, enter: 0.3, holdStart: 0.33, holdEnd: 0.43, exit: 0.47, end: 0.5 },
  qr: { start: 0.4, enter: 0.47, holdStart: 0.52, holdEnd: 0.62, exit: 0.68, end: 0.72 },
  qrFocus: { start: 0.55, enter: 0.6, holdStart: 0.63, holdEnd: 0.7, exit: 0.74, end: 0.76 },
  profile: { start: 0.68, enter: 0.74, holdStart: 0.78, holdEnd: 0.82, exit: 0.86, end: 0.9 },
  customization: { start: 0.8, enter: 0.85, holdStart: 0.89, holdEnd: 0.93, exit: 0.96, end: 0.98 },
  dashboard: { start: 0.91, enter: 0.94, holdStart: 0.97, holdEnd: 1, exit: 1, end: 1 },
} satisfies Record<string, StoryScene>

export type ScenePhase = 'before' | 'enter' | 'hold' | 'exit' | 'after'

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

export function smoothstep(value: number): number {
  const t = clamp(value)
  return t * t * (3 - 2 * t)
}

export function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * clamp(progress)
}

export function mapRange(value: number, fromStart: number, fromEnd: number, toStart: number, toEnd: number): number {
  if (fromEnd === fromStart) return toStart
  return lerp(toStart, toEnd, (value - fromStart) / (fromEnd - fromStart))
}

export function normalize(value: number, start: number, end: number): number {
  return clamp((value - start) / (end - start))
}

export function getScenePhase(progress: number, scene: StoryScene): ScenePhase {
  if (progress < scene.start) return 'before'
  if (progress < scene.enter) return 'enter'
  if (progress <= scene.holdEnd) return 'hold'
  if (progress < scene.end) return 'exit'
  return 'after'
}

export type SceneState = {
  opacity: number
  x: number
  y: number
  scale: number
  translateX: number
  translateY: number
}

export function getSceneState(progress: number, scene: StoryScene, direction: 'left' | 'right' = 'right'): SceneState {
  const local = normalize(progress, scene.start, scene.end)
  const enter = smoothstep(normalize(progress, scene.start, scene.enter))
  const exit = smoothstep(normalize(progress, scene.holdEnd, scene.end))
  const offset = direction === 'left' ? -1.2 : 1.2
  const x = lerp(offset, 0, enter) * (1 - exit) + (direction === 'left' ? -1.1 : 1.1) * exit
  return {
    opacity: local <= 0 ? 0 : local >= 1 ? 0 : enter * (1 - exit),
    x,
    y: 0,
    scale: lerp(0.96, 1, enter),
    translateX: x,
    translateY: 0,
  }
}

export function getHeroState(progress: number): SceneState {
  const scene = STORY_TIMELINE.hero
  const exit = smoothstep(normalize(progress, scene.holdEnd, scene.end))
  const x = -1.35 - 0.6 * smoothstep(normalize(progress, 0.02, scene.holdEnd))
  return {
    opacity: 1 - exit,
    x,
    y: 0.16,
    scale: 1,
    translateX: x,
    translateY: 0.16,
  }
}

export function getDashboardState(progress: number): SceneState {
  const scene = STORY_TIMELINE.dashboard
  const enter = smoothstep(normalize(progress, scene.start, scene.enter))
  const x = lerp(1.4, 0, enter)
  return { opacity: enter, x, y: 0, scale: lerp(0.94, 1, enter), translateX: x, translateY: 0 }
}

export type ShirtState = {
  x: number
  y: number
  z: number
  scale: number
  rotationX: number
  rotationY: number
  rotationZ: number
  cameraZ: number
  opacity: number
}

export function getShirtState(progress: number, isMobile: boolean): ShirtState {
  const rotation = smoothstep(normalize(progress, 0.04, 0.68))
  const zoom = smoothstep(normalize(progress, 0.55, 0.68))
  const secondary = smoothstep(normalize(progress, 0.68, 0.86))
  const fade = smoothstep(normalize(progress, 0.86, 0.98))
  const initialX = isMobile ? 0 : 0.58
  const secondaryX = isMobile ? 0.2 : 0.82
  return {
    x: lerp(lerp(initialX, 0, smoothstep(normalize(progress, 0, 0.55))), secondaryX, secondary),
    y: 0.08,
    z: 0,
    scale: lerp(0.64, 0.64 * 0.84, secondary) * lerp(1, 1.06, zoom),
    rotationX: 0,
    rotationY: lerp(-0.5, 2.7, rotation),
    rotationZ: 0,
    cameraZ: lerp(isMobile ? 2.9 : 2.35, isMobile ? 2.15 : 1.8, zoom),
    opacity: lerp(1, 0.2, fade),
  }
}
