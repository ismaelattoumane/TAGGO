/**
 * Timeline unique de l’expérience hero TAGGO.
 *
 * Fonctions pures (aucun import three / React) : une seule progression 0 → 1
 * pilote la caméra, le T-shirt, son côté d’affichage, l’overlay HTML et la
 * simulation de scan. Aucune animation indépendante : tout dérive de `p`.
 */
export type Vec3 = readonly [number, number, number]

export const PI = Math.PI

export const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value))
export const smooth = (t: number): number => t * t * (3 - 2 * t)
export const ramp = (p: number, from: number, to: number): number => smooth(clamp((p - from) / (to - from)))
export const windowed = (p: number, from: number, to: number, fade = 0.015): number =>
  ramp(p, from, from + fade) * (1 - ramp(p, to - fade, to))

/** Position du QR dans le repère du GLB `taggo-shirt.glb` et demi-largeur (unités modèle). */
export const QR_LOCAL: Vec3 = [-0.03, 0.19, -0.3]
export const QR_HALF_WIDTH = 0.285
/** Position du QR dans le monde quand le dos est face caméra (rotation Y = π). */
const Q: Vec3 = [0.03, 0.19, 0.3]

/** Un affichage « large » : T-shirt et contenu côte à côte. Sinon : empilés (mobile / portrait). */
export function isWideLayout(width: number, height: number): boolean {
  return width > 800 && width / Math.max(1, height) >= 1.1
}

/* ------------------------------ segments ------------------------------ */

function segment<T extends { p: number }>(keys: readonly T[], p: number): { a: T; b: T; t: number } {
  let i = 0
  while (i < keys.length - 2 && p >= keys[i + 1].p) i++
  const a = keys[i]
  const b = keys[i + 1]
  return { a, b, t: smooth(clamp((p - a.p) / (b.p - a.p))) }
}

/* -------------------------------- caméra ------------------------------- */

type ZMode = 'abs' | 'far' | 'ui' | 'qr'
type PoseKey = { p: number; cam: Vec3; target: Vec3; rotY: number; z: ZMode }

const key = (p: number, cam: Vec3, target: Vec3, rotY: number, z: ZMode = 'abs'): PoseKey => ({ p, cam, target, rotY, z })

const UI_CAM: Vec3 = [0, 0.05, 1]
const UI_TARGET: Vec3 = [0, 0.05, 0]

export const POSE_KEYS: readonly PoseKey[] = [
  key(0, [0.5, 0.35, 3.6], [0, -0.1, 0], 0.5, 'far'),
  key(0.09, [0.35, 0.3, 3], [0, -0.05, 0], 0.5, 'far'),
  key(0.16, [0, 0.25, 3], [0, 0.05, 0], PI, 'far'),
  key(0.23, [0, 0.22, 2.2], Q, PI),
  key(0.3, [Q[0], Q[1], 1], Q, PI, 'qr'),
  key(0.35, [Q[0], Q[1], 1], Q, PI, 'qr'),
  key(0.42, UI_CAM, UI_TARGET, PI, 'ui'),
  key(0.46, UI_CAM, UI_TARGET, PI, 'ui'),
  key(0.52, UI_CAM, UI_TARGET, 2 * PI + 0.5, 'ui'),
  key(0.55, UI_CAM, UI_TARGET, 2 * PI + 0.5, 'ui'),
  key(0.61, UI_CAM, UI_TARGET, 3 * PI, 'ui'),
  key(0.64, UI_CAM, UI_TARGET, 3 * PI, 'ui'),
  key(0.7, UI_CAM, UI_TARGET, 4 * PI + 0.5, 'ui'),
  key(0.77, UI_CAM, UI_TARGET, 4 * PI + 0.5, 'ui'),
  key(0.82, UI_CAM, UI_TARGET, 4 * PI + 0.5, 'ui'),
  key(0.88, [0, 0.25, 3], UI_TARGET, 4 * PI + 0.5, 'far'),
  key(0.94, [0.5, 0.35, 3.4], [0, -0.1, 0], 4 * PI + 0.5, 'far'),
  key(1, [0.5, 0.35, 3.4], [0, -0.1, 0], 4 * PI + 0.5, 'far'),
]

export type Pose = { cam: [number, number, number]; target: [number, number, number]; rotY: number }

/** Distances caméra qui gardent T-shirt et QR cadrés selon le format d’écran. */
export function cameraDistances(aspect: number): { far: number; ui: number; qr: number } {
  const a = Math.max(0.2, aspect)
  return {
    far: Math.max(1, 0.744 / a),
    ui: a < 1.1 ? 3 / a : Math.max(2.4, 4.47 / a),
    qr: 0.3 + Math.max(1.2, 1.13 / a),
  }
}

export function getPose(progress: number, aspect: number): Pose {
  const d = cameraDistances(aspect)
  const { a, b, t } = segment(POSE_KEYS, clamp(progress))
  const zOf = (k: PoseKey): number =>
    k.z === 'far' ? k.cam[2] * d.far : k.z === 'ui' ? d.ui : k.z === 'qr' ? d.qr : k.cam[2]
  const mix = (x: number, y: number): number => x + (y - x) * t
  return {
    cam: [mix(a.cam[0], b.cam[0]), mix(a.cam[1], b.cam[1]), mix(zOf(a), zOf(b))],
    target: [mix(a.target[0], b.target[0]), mix(a.target[1], b.target[1]), mix(a.target[2], b.target[2])],
    rotY: mix(a.rotY, b.rotY),
  }
}

/** Mobile : pas de changement de côté, donc pas de rotations décoratives. */
const MOBILE_ROT = [
  { p: 0, v: 0.5 },
  { p: 0.09, v: 0.5 },
  { p: 0.16, v: PI },
  { p: 0.82, v: PI },
  { p: 0.94, v: 2 * PI + 0.5 },
  { p: 1, v: 2 * PI + 0.5 },
] as const

export function getMobileRotationY(progress: number): number {
  const { a, b, t } = segment(MOBILE_ROT, clamp(progress))
  return a.v + (b.v - a.v) * t
}

/* ---------------------- côté du T-shirt à l’écran ---------------------- */

/** -1 = T-shirt à gauche (contenu à droite), +1 = à droite, 0 = centré. Il change à chaque scène. */
const SIDE_KEYS = [
  { p: 0, v: 0 },
  { p: 0.16, v: 0 },
  { p: 0.3, v: -1 },
  { p: 0.46, v: -1 },
  { p: 0.52, v: 1 },
  { p: 0.55, v: 1 },
  { p: 0.61, v: -1 },
  { p: 0.64, v: -1 },
  { p: 0.7, v: 1 },
  { p: 0.82, v: 1 },
  { p: 0.88, v: 0 },
  { p: 1, v: 0 },
] as const

export function getSide(progress: number): number {
  const { a, b, t } = segment(SIDE_KEYS, clamp(progress))
  return a.v + (b.v - a.v) * t
}

const MOBILE_SHIFT_Y = [
  { p: 0, v: -0.1 },
  { p: 0.16, v: -0.1 },
  { p: 0.3, v: -0.1 },
  { p: 0.42, v: -0.2 },
  { p: 0.82, v: -0.2 },
  { p: 0.88, v: -0.08 },
  { p: 1, v: -0.08 },
] as const

/** Décalage du T-shirt à l’écran, en fraction de la largeur / hauteur (+ = droite / bas). */
export function getShift(progress: number, wide: boolean): { x: number; y: number } {
  if (wide) return { x: getSide(progress) * 0.2, y: 0 }
  const { a, b, t } = segment(MOBILE_SHIFT_Y, clamp(progress))
  return { x: 0, y: a.v + (b.v - a.v) * t }
}

/* ------------------------------- overlay ------------------------------- */

export type LineKind = 'hero' | 'text' | 'cta'
export type LineWindow = { id: string; kind: LineKind; from: number; to: number; side?: boolean }

/** Textes de scène : fenêtres de visibilité sur la timeline (les textes vivent dans experienceContent). */
export const LINE_WINDOWS: readonly LineWindow[] = [
  { id: 'hero', kind: 'hero', from: 0, to: 0.047 },
  { id: 'discover', kind: 'text', from: 0.047, to: 0.09 },
  { id: 'scan', kind: 'text', from: 0.18, to: 0.34, side: true },
  { id: 'identity', kind: 'text', from: 0.39, to: 0.47 },
  { id: 'destination', kind: 'text', from: 0.48, to: 0.56 },
  { id: 'control', kind: 'text', from: 0.57, to: 0.65 },
  { id: 'usages', kind: 'text', from: 0.66, to: 0.76 },
  { id: 'cta', kind: 'cta', from: 0.9, to: 1.01 },
]

export const PANEL_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [0.375, 0.47],
  [0.46, 0.56],
  [0.55, 0.65],
  [0.64, 0.775],
]

export function getLineOpacity(progress: number, line: LineWindow): number {
  const end = line.kind === 'cta'
  const fade = end ? 0.03 : 0.012
  const enter = line.from === 0 ? 1 : ramp(progress, line.from, line.from + fade)
  const value = enter * (1 - ramp(progress, line.to - fade, line.to))
  return end && progress > 0.93 ? 1 : value
}

export type ScanState = { opacity: number; scale: number; sweep: number; locked: boolean }

/** Simulation de scan : viseur qui apparaît, balaie le QR, puis se verrouille. */
export function getScan(progress: number): ScanState {
  const appear = ramp(progress, 0.26, 0.285)
  const t = clamp((progress - 0.285) / 0.05)
  return {
    opacity: appear * (1 - ramp(progress, 0.37, 0.41)),
    scale: 1.1 - 0.1 * appear,
    sweep: 1 - Math.abs(((t * 2) % 2) - 1),
    locked: progress > 0.34,
  }
}

export type OverlayInput = { wide: boolean; width: number; height: number; inView: boolean }

export type OverlayState = {
  cue: number
  skip: number
  bar: number
  barScale: number
  device: { opacity: number; dx: number; dy: number }
  panels: number[]
  destinationSwitch: number
  lines: number[]
}

export function getOverlay(progress: number, input: OverlayInput): OverlayState {
  const p = clamp(progress)
  const { wide, width, height, inView } = input
  const entering = ramp(p, 0.35, 0.43)
  const leaving = 1 - ramp(p, 0.76, 0.82)
  const vis = Math.min(entering, leaving)
  const side = getSide(p)
  return {
    cue: 1 - ramp(p, 0, 0.03),
    skip: inView && p < 0.9 ? 1 : 0,
    bar: inView && p > 0.002 && p < 0.999 ? 1 : 0,
    barScale: p,
    device: {
      opacity: vis,
      dx: wide ? -side * (width * 0.22 + (1 - vis) * width * 0.55) : 0,
      dy: wide ? 0 : height * 0.17 + (1 - vis) * height * 0.6,
    },
    panels: PANEL_WINDOWS.map(([from, to]) => windowed(p, from, to, 0.02)),
    destinationSwitch: ramp(p, 0.5, 0.53),
    lines: LINE_WINDOWS.map((line) => getLineOpacity(p, line)),
  }
}

/** Oscillation d’accueil du T-shirt : s’éteint dès que le scroll prend le contrôle. */
export function getIdle(progress: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : 1 - ramp(progress, 0, 0.05)
}
