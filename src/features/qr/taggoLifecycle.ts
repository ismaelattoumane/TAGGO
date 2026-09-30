import type { TaggoLifecycleStatus } from './qrTypes'

const ALLOWED_TRANSITIONS: Record<TaggoLifecycleStatus, readonly TaggoLifecycleStatus[]> = {
  available: ['reserved', 'cancelled'],
  reserved: ['available', 'assigned', 'cancelled'],
  assigned: ['activated', 'cancelled'],
  activated: ['active', 'cancelled'],
  active: ['inactive', 'expired', 'suspended', 'replaced'],
  inactive: ['active', 'replaced', 'cancelled'],
  expired: ['active', 'replaced', 'cancelled'],
  suspended: ['active', 'replaced', 'cancelled'],
  replaced: [],
  cancelled: [],
}

export function canTransitionTaggo(from: TaggoLifecycleStatus | undefined, to: TaggoLifecycleStatus): boolean {
  return Boolean(from && ALLOWED_TRANSITIONS[from].includes(to))
}

export function assertTaggoTransition(from: TaggoLifecycleStatus | undefined, to: TaggoLifecycleStatus): void {
  if (!canTransitionTaggo(from, to)) {
    throw new Error(`Transition TAGGO interdite: ${from ?? 'inconnu'} -> ${to}`)
  }
}