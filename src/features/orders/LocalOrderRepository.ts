import { getLocalAuthSession } from '../../lib/demoAuth'
import { readStore, writeStore, toRecord, type StoredQr } from '../qr/qrStore'
import type { QrRecord } from '../qr/qrTypes'
import type { OrderRepository } from './OrderRepository'
import type { Order, OrderDetails, OrderItem, OrderStatus, OrderSummary } from './orderTypes'

const ORDERS_KEY = 'taggo-demo-orders'
const ORDER_ITEMS_KEY = 'taggo-demo-order-items'

type StoredOrder = {
  id: string
  customerId: string
  status: OrderStatus
  createdAt: string
  updatedAt?: string
}

type StoredOrderItem = {
  id: string
  orderId: string
  productType: 'taggo'
  quantity: number
  taggoId: string | null
  createdAt: string
  updatedAt?: string
}

function readOrders(): StoredOrder[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(ORDERS_KEY)
    return raw ? JSON.parse(raw) as StoredOrder[] : []
  } catch {
    return []
  }
}

function writeOrders(orders: StoredOrder[]): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
}

function readOrderItems(): StoredOrderItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(ORDER_ITEMS_KEY)
    return raw ? JSON.parse(raw) as StoredOrderItem[] : []
  } catch {
    return []
  }
}

function writeOrderItems(items: StoredOrderItem[]): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(ORDER_ITEMS_KEY, JSON.stringify(items))
}

function newId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined
  if (cryptoApi && 'randomUUID' in cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return `ord-${Math.random().toString(36).slice(2, 11).toUpperCase()}`
}

function toOrderSummary(stored: StoredOrder): OrderSummary {
  return {
    id: stored.id,
    status: stored.status,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  }
}

function toOrderDetails(stored: StoredOrder, items: StoredOrderItem[], qrs: StoredQr[]): OrderDetails {
  return {
    id: stored.id,
    customerId: stored.customerId,
    status: stored.status,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    items: items
      .filter((item) => item.orderId === stored.id)
      .map((item): OrderItem => ({
        id: item.id,
        orderId: item.orderId,
        productType: item.productType,
        quantity: item.quantity,
        taggoId: item.taggoId,
        qr: item.taggoId ? (() => { const qr = qrs.find((q) => q.id === item.taggoId); return qr ? toRecord(qr) : undefined })() : undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
  }
}

/**
 * LocalStorage-backed OrderRepository (demo only).
 * Pages must use `orderRepository` instead of touching localStorage directly.
 */
export class LocalOrderRepository implements OrderRepository {
  createOrder(): Order {
    const user = getLocalAuthSession()
    if (!user) throw new Error('Utilisateur non authentifié.')
    const now = new Date().toISOString()
    const order: StoredOrder = {
      id: newId(),
      customerId: user.id,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }
    const orders = readOrders()
    orders.push(order)
    writeOrders(orders)
    return { ...order }
  }

  getOrder(id: string, ownerId?: string): OrderDetails | null {
    const orders = readOrders()
    const order = orders.find((o) => o.id === id) ?? null
    if (!order) return null
    if (ownerId && order.customerId !== ownerId) return null
    const items = readOrderItems()
    const qrs = readStore()
    return toOrderDetails(order, items, qrs)
  }

  listOrders(ownerId?: string): OrderSummary[] {
    const orders = readOrders()
    const scoped = ownerId ? orders.filter((o) => o.customerId === ownerId) : orders
    return scoped.map(toOrderSummary)
  }

  updateOrderStatus(id: string, status: OrderStatus, ownerId?: string): Order | null {
    const orders = readOrders()
    const index = orders.findIndex((o) => o.id === id)
    if (index === -1) return null
    const current = orders[index]
    if (ownerId && current.customerId !== ownerId) return null
    const updated: StoredOrder = {
      ...current,
      status,
      updatedAt: new Date().toISOString(),
    }
    orders[index] = updated
    writeOrders(orders)
    return { ...updated }
  }

  reserveTaggo(orderId: string, ownerId?: string): QrRecord {
    const order = this.getOrder(orderId, ownerId)
    if (!order) throw new Error('Commande introuvable.')

    const existingItems = readOrderItems().filter((i) => i.orderId === orderId && i.taggoId)
    if (existingItems.length > 0) {
      const qrs = readStore()
      const existingQr = qrs.find((qr) => qr.id === existingItems[0].taggoId)
      if (existingQr) return toRecord(existingQr)
    }

    if (order.status !== 'draft' && order.status !== 'pending') {
      throw new Error('La commande n’est pas en attente de réservation.')
    }

    const qrs = readStore()
    const qrIndex = qrs.findIndex((qr) => qr.lifecycleStatus === 'available' && !qr.ownerId)
    if (qrIndex === -1) throw new Error('Aucun TAGGO disponible.')

    const now = new Date().toISOString()
    const updatedQr: StoredQr = {
      ...qrs[qrIndex],
      lifecycleStatus: 'reserved',
      reservedAt: now,
      updatedAt: now,
    }
    qrs[qrIndex] = updatedQr
    writeStore(qrs)

    const items = readOrderItems()
    items.push({
      id: newId(),
      orderId,
      productType: 'taggo',
      quantity: 1,
      taggoId: updatedQr.id,
      createdAt: now,
      updatedAt: now,
    })
    writeOrderItems(items)

    this.updateOrderStatus(orderId, 'ready_for_assignment', ownerId)

    return toRecord(updatedQr)
  }

  assignTaggo(orderId: string, taggoId: string, ownerId?: string): QrRecord | null {
    const order = this.getOrder(orderId, ownerId)
    if (!order) return null

    const items = readOrderItems()
    const item = items.find((i) => i.orderId === orderId && i.taggoId === taggoId) ?? null
    if (!item) return null

    const qrs = readStore()
    const qrIndex = qrs.findIndex((qr) => qr.id === taggoId)
    if (qrIndex === -1) return null
    const current = qrs[qrIndex]

    if (current.ownerId && current.ownerId !== ownerId) return null
    if (current.lifecycleStatus !== 'reserved') return null

    const now = new Date().toISOString()
    const updatedQr: StoredQr = {
      ...current,
      ownerId: ownerId ?? current.ownerId,
      lifecycleStatus: 'assigned',
      assignedAt: now,
      updatedAt: now,
    }
    qrs[qrIndex] = updatedQr
    writeStore(qrs)

    this.updateOrderStatus(orderId, 'assigned', ownerId)

    return toRecord(updatedQr)
  }
}
