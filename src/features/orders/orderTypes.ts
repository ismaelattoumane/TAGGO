import type { QrRecord } from '../qr/qrTypes'

export type OrderStatus = 'draft' | 'pending' | 'ready_for_assignment' | 'assigned' | 'cancelled'

export type Order = {
  id: string
  customerId: string
  status: OrderStatus
  createdAt: string
  updatedAt?: string
}

export type OrderItem = {
  id: string
  orderId: string
  productType: 'taggo'
  quantity: number
  taggoId: string | null
  qr?: QrRecord
  createdAt: string
  updatedAt?: string
}

export type OrderDetails = Order & {
  items: OrderItem[]
}

export type OrderSummary = Pick<Order, 'id' | 'status' | 'createdAt' | 'updatedAt'>
