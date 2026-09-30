import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_USER_IDS, saveLocalAuthSession } from '../../lib/demoAuth'
import { LocalQrRepository } from '../qr/LocalQrRepository'
import { LocalOrderRepository } from './LocalOrderRepository'

function setLocalStorageQrState(publicId: string | undefined, overrides: Partial<Record<string, unknown>>): void {
  const stored = JSON.parse(window.localStorage.getItem('taggo-demo-qrs') ?? '[]') as Array<Record<string, unknown>>
  if (publicId) {
    const idx = stored.findIndex((qr) => qr.publicId === publicId)
    if (idx >= 0) stored[idx] = { ...stored[idx], ...overrides }
  } else if (stored.length > 0) {
    stored[stored.length - 1] = { ...stored[stored.length - 1], ...overrides }
  }
  window.localStorage.setItem('taggo-demo-qrs', JSON.stringify(stored))
}

describe('LocalOrderRepository', () => {
  let qrRepo: LocalQrRepository
  let orderRepo: LocalOrderRepository

  beforeEach(() => {
    window.localStorage.clear()
    saveLocalAuthSession({ id: DEMO_USER_IDS.demo, email: 'demo@taggo.local', fullName: 'Demo User' })
    qrRepo = new LocalQrRepository()
    orderRepo = new LocalOrderRepository()
  })

  describe('createOrder', () => {
    it('creates a draft order tied to the current user', () => {
      const order = orderRepo.createOrder()
      expect(order.status).toBe('draft')
      expect(order.customerId).toBe(DEMO_USER_IDS.demo)
      expect(order.id).toBeTruthy()
    })

    it('allows multiple orders per user', () => {
      const a = orderRepo.createOrder()
      const b = orderRepo.createOrder()
      expect(a.id).not.toBe(b.id)
    })
  })

  describe('getOrder / ownership', () => {
    it('returns the order for its owner', () => {
      const order = orderRepo.createOrder()
      const fetched = orderRepo.getOrder(order.id, DEMO_USER_IDS.demo)
      expect(fetched?.id).toBe(order.id)
      expect(fetched?.customerId).toBe(DEMO_USER_IDS.demo)
    })

    it('returns null when a different user queries the order', () => {
      const order = orderRepo.createOrder()
      expect(orderRepo.getOrder(order.id, 'attacker-id')).toBeNull()
    })

    it('returns all orders for a user', () => {
      orderRepo.createOrder()
      orderRepo.createOrder()
      const all = orderRepo.listOrders(DEMO_USER_IDS.demo)
      expect(all).toHaveLength(2)
    })

    it('returns empty list for a non-owner', () => {
      orderRepo.createOrder()
      expect(orderRepo.listOrders('attacker-id')).toHaveLength(0)
    })
  })

  describe('reserveTaggo', () => {
    it('reserves an available TAGGO and transitions it to reserved', () => {
      const created = qrRepo.create({
        title: 'Stock',
        destinationUrl: 'https://taggo.example/stock',
      })
      setLocalStorageQrState(created.publicId, { lifecycleStatus: 'available', ownerId: undefined, reservedAt: undefined, assignedAt: undefined })

      const order = orderRepo.createOrder()
      const reserved = orderRepo.reserveTaggo(order.id, DEMO_USER_IDS.demo)

      expect(reserved.lifecycleStatus).toBe('reserved')
      expect(reserved.reservedAt).toBeDefined()
      expect(reserved.ownerId).toBeUndefined()

      const details = orderRepo.getOrder(order.id, DEMO_USER_IDS.demo)
      expect(details?.status).toBe('ready_for_assignment')
      expect(details?.items).toHaveLength(1)
      expect(details?.items[0]?.taggoId).toBe(reserved.id)
    })

    it('is idempotent: same order returns the same TAGGO', () => {
      const created = qrRepo.create({ title: 'Stock', destinationUrl: 'https://taggo.example/stock' })
      setLocalStorageQrState(created.publicId, { lifecycleStatus: 'available', ownerId: undefined })

      const order = orderRepo.createOrder()
      const first = orderRepo.reserveTaggo(order.id, DEMO_USER_IDS.demo)
      const second = orderRepo.reserveTaggo(order.id, DEMO_USER_IDS.demo)
      expect(second.id).toBe(first.id)
    })

    it('assigns different TAGGOs to concurrent orders', () => {
      const c1 = qrRepo.create({ title: 'S1', destinationUrl: 'https://taggo.example/s1' })
      const c2 = qrRepo.create({ title: 'S2', destinationUrl: 'https://taggo.example/s2' })
      setLocalStorageQrState(c1.publicId, { lifecycleStatus: 'available', ownerId: undefined })
      setLocalStorageQrState(c2.publicId, { lifecycleStatus: 'available', ownerId: undefined })

      const orderA = orderRepo.createOrder()
      const orderB = orderRepo.createOrder()
      const resA = orderRepo.reserveTaggo(orderA.id, DEMO_USER_IDS.demo)
      const resB = orderRepo.reserveTaggo(orderB.id, DEMO_USER_IDS.demo)

      expect(resA.id).not.toBe(resB.id)
      expect(resA.lifecycleStatus).toBe('reserved')
      expect(resB.lifecycleStatus).toBe('reserved')
    })

    it('throws when no TAGGO is available', () => {
      const order = orderRepo.createOrder()
      expect(() => orderRepo.reserveTaggo(order.id, DEMO_USER_IDS.demo)).toThrow('Aucun TAGGO disponible')
    })

    it('throws for a non-existent order', () => {
      const created = qrRepo.create({ title: 'Stock', destinationUrl: 'https://taggo.example/stock' })
      setLocalStorageQrState(created.publicId, { lifecycleStatus: 'available', ownerId: undefined })
      expect(() => orderRepo.reserveTaggo('non-existent', DEMO_USER_IDS.demo)).toThrow('Commande introuvable')
    })
  })

  describe('assignTaggo', () => {
    it('assigns a reserved TAGGO to the order owner', () => {
      const created = qrRepo.create({ title: 'Stock', destinationUrl: 'https://taggo.example/stock' })
      setLocalStorageQrState(created.publicId, { lifecycleStatus: 'available', ownerId: undefined })
      const order = orderRepo.createOrder()
      const reserved = orderRepo.reserveTaggo(order.id, DEMO_USER_IDS.demo)

      const assigned = orderRepo.assignTaggo(order.id, reserved.id, DEMO_USER_IDS.demo)
      expect(assigned?.lifecycleStatus).toBe('assigned')
      expect(assigned?.ownerId).toBe(DEMO_USER_IDS.demo)
      expect(assigned?.assignedAt).toBeDefined()

      const details = orderRepo.getOrder(order.id, DEMO_USER_IDS.demo)
      expect(details?.status).toBe('assigned')
    })

    it('returns null when a wrong user calls assign', () => {
      const created = qrRepo.create({ title: 'Stock', destinationUrl: 'https://taggo.example/stock' })
      setLocalStorageQrState(created.publicId, { lifecycleStatus: 'available', ownerId: undefined })
      const order = orderRepo.createOrder()
      const reserved = orderRepo.reserveTaggo(order.id, DEMO_USER_IDS.demo)

      expect(orderRepo.assignTaggo(order.id, reserved.id, 'attacker-id')).toBeNull()
    })

    it('returns null if the TAGGO is already owned by someone else', () => {
      const created = qrRepo.create({ title: 'Stock', destinationUrl: 'https://taggo.example/stock' })
      setLocalStorageQrState(created.publicId, { lifecycleStatus: 'available', ownerId: undefined })
      const order = orderRepo.createOrder()
      const reserved = orderRepo.reserveTaggo(order.id, DEMO_USER_IDS.demo)

      setLocalStorageQrState(reserved.publicId, { ownerId: 'third-party' })
      expect(orderRepo.assignTaggo(order.id, reserved.id, DEMO_USER_IDS.demo)).toBeNull()
    })

    it('returns null when the TAGGO does not belong to the order reservation', () => {
      const c1 = qrRepo.create({ title: 'S1', destinationUrl: 'https://taggo.example/s1' })
      const c2 = qrRepo.create({ title: 'S2', destinationUrl: 'https://taggo.example/s2' })
      setLocalStorageQrState(c1.publicId, { lifecycleStatus: 'available', ownerId: undefined })
      setLocalStorageQrState(c2.publicId, { lifecycleStatus: 'available', ownerId: undefined })

      const orderA = orderRepo.createOrder()
      const orderB = orderRepo.createOrder()
      const resA = orderRepo.reserveTaggo(orderA.id, DEMO_USER_IDS.demo)
      orderRepo.reserveTaggo(orderB.id, DEMO_USER_IDS.demo)

      // Order B tries to claim the TAGGO reserved by Order A
      expect(orderRepo.assignTaggo(orderB.id, resA.id, DEMO_USER_IDS.demo)).toBeNull()
    })

    it('returns null when the order does not exist', () => {
      const created = qrRepo.create({ title: 'Stock', destinationUrl: 'https://taggo.example/stock' })
      setLocalStorageQrState(created.publicId, { lifecycleStatus: 'available', ownerId: undefined })
      const order = orderRepo.createOrder()
      const reserved = orderRepo.reserveTaggo(order.id, DEMO_USER_IDS.demo)

      expect(orderRepo.assignTaggo('non-existent-order', reserved.id, DEMO_USER_IDS.demo)).toBeNull()
    })

    it('returns null when the TAGGO was not reserved for this order', () => {
      const stock = qrRepo.create({ title: 'Stock', destinationUrl: 'https://taggo.example/stock' })
      const unassociated = qrRepo.create({ title: 'Unassoc', destinationUrl: 'https://taggo.example/unassoc' })
      setLocalStorageQrState(stock.publicId, { lifecycleStatus: 'available', ownerId: undefined })
      setLocalStorageQrState(unassociated.publicId, { lifecycleStatus: 'available', ownerId: undefined })

      const order = orderRepo.createOrder()
      orderRepo.reserveTaggo(order.id, DEMO_USER_IDS.demo)

      // TAGGO that exists but was never linked to this order
      expect(orderRepo.assignTaggo(order.id, unassociated.id, DEMO_USER_IDS.demo)).toBeNull()
    })
  })

  describe('duplicate protection', () => {
    it('prevents two orders from sharing the same TAGGO', () => {
      const created = qrRepo.create({ title: 'Stock', destinationUrl: 'https://taggo.example/stock' })
      setLocalStorageQrState(created.publicId, { lifecycleStatus: 'available', ownerId: undefined })

      const orderA = orderRepo.createOrder()
      const orderB = orderRepo.createOrder()

      const resA = orderRepo.reserveTaggo(orderA.id, DEMO_USER_IDS.demo)

      // Order B cannot reserve the same TAGGO — it is already reserved
      expect(() => orderRepo.reserveTaggo(orderB.id, DEMO_USER_IDS.demo)).toThrow('Aucun TAGGO disponible')

      // resA is the only reserved TAGGO
      const details = orderRepo.getOrder(orderA.id, DEMO_USER_IDS.demo)
      expect(details?.items).toHaveLength(1)
      expect(details?.items[0]?.taggoId).toBe(resA.id)
    })
  })
})
