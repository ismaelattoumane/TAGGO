import type { Order, OrderDetails, OrderSummary, OrderStatus } from './orderTypes'
import type { QrRecord } from '../qr/qrTypes'

/**
 * Storage abstraction for TAGGO orders.
 *
 * UI pages must depend on this interface only.
 * Current implementation: LocalStorage (`LocalOrderRepository`).
 * Future implementation: Supabase (`SupabaseOrderRepository`).
 *
 * `ownerId` scoping is part of the contract so the Supabase
 * implementation can enforce RLS ownership without changing callers.
 */
export interface OrderRepository {
  createOrder(): Promise<Order> | Order
  getOrder(id: string, ownerId?: string): Promise<OrderDetails | null> | OrderDetails | null
  listOrders(ownerId?: string): Promise<OrderSummary[]> | OrderSummary[]
  updateOrderStatus(id: string, status: OrderStatus, ownerId?: string): Promise<Order | null> | Order | null
  reserveTaggo(orderId: string, ownerId?: string): Promise<QrRecord> | QrRecord
  assignTaggo(orderId: string, taggoId: string, ownerId?: string): Promise<QrRecord | null> | QrRecord | null
}
