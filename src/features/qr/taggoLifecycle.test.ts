import { describe, expect, it } from 'vitest'
import { assertTaggoTransition, canTransitionTaggo } from './taggoLifecycle'

describe('TAGGO lifecycle transitions', () => {
  it('allows the physical TAGGO lifecycle', () => {
    expect(canTransitionTaggo('available', 'reserved')).toBe(true)
    expect(canTransitionTaggo('reserved', 'assigned')).toBe(true)
    expect(canTransitionTaggo('assigned', 'activated')).toBe(true)
    expect(canTransitionTaggo('activated', 'active')).toBe(true)
  })

  it('rejects transitions that skip ownership or activation', () => {
    expect(canTransitionTaggo('available', 'active')).toBe(false)
    expect(canTransitionTaggo('assigned', 'active')).toBe(false)
    expect(() => assertTaggoTransition('active', 'available')).toThrow('Transition TAGGO interdite')
  })

  it('prepares non-commercial future states without triggering them', () => {
    expect(canTransitionTaggo('active', 'inactive')).toBe(true)
    expect(canTransitionTaggo('active', 'expired')).toBe(true)
    expect(canTransitionTaggo('active', 'suspended')).toBe(true)
    expect(canTransitionTaggo('active', 'replaced')).toBe(true)
  })
})