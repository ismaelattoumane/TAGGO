export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

export function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * clamp(progress)
}

export function smoothstep(value: number): number {
  const t = clamp(value)
  return t * t * (3 - 2 * t)
}

export function normalize(value: number, start: number, end: number): number {
  if (end === start) return 0
  return clamp((value - start) / (end - start))
}
