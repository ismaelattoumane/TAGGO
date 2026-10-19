import { describe, expect, it } from 'vitest'
import {
  LINE_WINDOWS,
  cameraDistances,
  getIdle,
  getMobileRotationY,
  getOverlay,
  getPose,
  getScan,
  getShift,
  getSide,
  isWideLayout,
} from './experienceTimeline'

const wideInput = { wide: true, width: 1440, height: 900, inView: true }

describe('experience timeline', () => {
  it('starts centered, front 3/4, with idle sway active', () => {
    expect(getSide(0)).toBe(0)
    expect(getPose(0, 1.6).rotY).toBeCloseTo(0.5)
    expect(getIdle(0, false)).toBe(1)
    expect(getIdle(0, true)).toBe(0)
    expect(getIdle(0.2, false)).toBe(0)
  })

  it('turns the back toward the camera before the QR scene', () => {
    expect(getPose(0.2, 1.6).rotY).toBeCloseTo(Math.PI)
  })

  it('zooms on the QR without crossing the shirt (camera stays in front of the QR plane)', () => {
    const qrZoom = getPose(0.32, 1.6)
    expect(qrZoom.cam[2]).toBeGreaterThan(0.3)
    expect(qrZoom.cam[2]).toBeLessThan(2)
  })

  it('frames the QR fully on narrow screens', () => {
    expect(cameraDistances(0.46).qr).toBeGreaterThan(cameraDistances(1.78).qr)
  })

  it('alternates the shirt side from scene to scene (desktop)', () => {
    expect(getSide(0.4)).toBe(-1)
    expect(getSide(0.53)).toBe(1)
    expect(getSide(0.62)).toBe(-1)
    expect(getSide(0.72)).toBe(1)
    expect(getSide(0.95)).toBe(0)
    expect(getShift(0.4, true).x).toBeCloseTo(-0.2)
  })

  it('never moves the shirt sideways on mobile, and keeps the back fixed behind the phone', () => {
    expect(getShift(0.6, false).x).toBe(0)
    expect(getShift(0.6, false).y).toBeLessThan(0)
    expect(getMobileRotationY(0.4)).toBeCloseTo(Math.PI)
    expect(getMobileRotationY(0.6)).toBeCloseTo(Math.PI)
    expect(getMobileRotationY(1)).toBeCloseTo(2 * Math.PI + 0.5)
  })

  it('runs the scan simulation before the profile appears, then locks', () => {
    expect(getScan(0.2).opacity).toBe(0)
    expect(getScan(0.3).opacity).toBeGreaterThan(0.9)
    expect(getScan(0.3).locked).toBe(false)
    expect(getScan(0.345).locked).toBe(true)
    expect(getScan(0.5).opacity).toBe(0)
    expect(getOverlay(0.32, wideInput).device.opacity).toBe(0)
  })

  it('shows one panel at a time and slides the device in from the opposite side', () => {
    const mid = getOverlay(0.44, wideInput)
    expect(mid.panels[0]).toBeGreaterThan(0.9)
    expect(mid.panels[1]).toBe(0)
    expect(mid.device.opacity).toBe(1)
    expect(mid.device.dx).toBeGreaterThan(0)
    const swapped = getOverlay(0.58, wideInput)
    expect(swapped.device.dx).toBeLessThan(0)
  })

  it('keeps the CTA line visible at the end and hides the skip control', () => {
    const end = getOverlay(1, wideInput)
    expect(end.lines[LINE_WINDOWS.findIndex((l) => l.id === 'cta')]).toBe(1)
    expect(end.skip).toBe(0)
    expect(end.bar).toBe(0)
    expect(getOverlay(0.1, wideInput).skip).toBe(1)
    expect(getOverlay(0.1, { ...wideInput, inView: false }).skip).toBe(0)
  })

  it('shows the hero line immediately at progress 0', () => {
    expect(getOverlay(0, wideInput).lines[0]).toBe(1)
  })

  it('detects the wide layout', () => {
    expect(isWideLayout(1440, 900)).toBe(true)
    expect(isWideLayout(390, 844)).toBe(false)
    expect(isWideLayout(820, 1180)).toBe(false)
  })
})
