import { supabase } from '../../lib/supabase'
import type { QrRecord } from '../qr/qrTypes'
import type { OrderRepository } from './OrderRepository'
import type { Order, OrderDetails, OrderItem, OrderStatus, OrderSummary } from './orderTypes'

type SupabaseOrder = {
  id: string
  customer_id: string
  status: string
  created_at: string
  updated_at: string | null
}

type SupabaseOrderItem = {
  id: string
  order_id: string
  product_type: string
  quantity: number
  taggo_id: string | null
  created_at: string
  updated_at: string | null
}

type SupabaseQr = {
  id: string
  public_id: string
  owner_id: string | null
  title: string | null
  destination_url: string | null
  status: QrRecord['status']
  lifecycle_status: QrRecord['lifecycleStatus']
  created_at: string
  updated_at: string | null
  reserved_at: string | null
  assigned_at: string | null
  activated_at: string | null
}

function requireClient() {
  if (!supabase) throw new Error('La configuration Supabase est manquante.')
  return supabase
}

function toQrRecord(row: SupabaseQr): QrRecord {
  return {
    id: row.id,
    publicId: row.public_id,
    ownerId: row.owner_id ?? undefined,
    lifecycleStatus: row.lifecycle_status,
    title: row.title ?? '',
    destinationUrl: row.destination_url ?? '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    reservedAt: row.reserved_at ?? undefined,
    assignedAt: row.assigned_at ?? undefined,
    activatedAt: row.activated_at ?? undefined,
  }
}

function toOrder(row: SupabaseOrder): Order {
  return {
    id: row.id,
    customerId: row.customer_id,
    status: row.status as OrderStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  }
}

function toOrderSummary(row: SupabaseOrder): OrderSummary {
  return {
    id: row.id,
    status: row.status as OrderStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  }
}

function toOrderItem(row: SupabaseOrderItem): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productType: row.product_type as 'taggo',
    quantity: row.quantity,
    taggoId: row.taggo_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  }
}

export class SupabaseOrderRepository implements OrderRepository {
  async createOrder(): Promise<Order> {
    const { data, error } = await requireClient().rpc('create_order')
    if (error) throw error
    return toOrder(data as SupabaseOrder)
  }

  async getOrder(id: string, ownerId?: string): Promise<OrderDetails | null> {
    const client = requireClient()
    let query = client.from('orders').select('*').eq('id', id)
    if (ownerId) query = query.eq('customer_id', ownerId)
    const { data: orderData, error: orderError } = await query.maybeSingle()
    if (orderError) throw orderError
    if (!orderData) return null
    const orderRow = orderData as SupabaseOrder

    const { data: itemData, error: itemError } = await client
      .from('order_items')
      .select('*')
      .eq('order_id', id)
    if (itemError) throw itemError

    return {
      ...toOrder(orderRow),
      items: ((itemData ?? []) as SupabaseOrderItem[]).map(toOrderItem),
    }
  }

  async listOrders(ownerId?: string): Promise<OrderSummary[]> {
    let query = requireClient().from('orders').select('*').order('created_at', { ascending: false })
    if (ownerId) query = query.eq('customer_id', ownerId)
    const { data, error } = await query
    if (error) throw error
    return ((data ?? []) as SupabaseOrder[]).map(toOrderSummary)
  }

  async updateOrderStatus(id: string, status: OrderStatus, ownerId?: string): Promise<Order | null> {
    let query = requireClient().from('orders').update({ status }).eq('id', id)
    if (ownerId) query = query.eq('customer_id', ownerId)
    const { data, error } = await query.select('*').maybeSingle()
    if (error) throw error
    return data ? toOrder(data as SupabaseOrder) : null
  }

  async reserveTaggo(orderId: string, ownerId?: string): Promise<QrRecord> {
    if (!ownerId) throw new Error('Utilisateur non authentifié.')
    const { data, error } = await requireClient().rpc('reserve_taggo_for_order_id', {
      p_order_id: orderId,
    })
    if (error) throw error
    if (!data) throw new Error('Aucun TAGGO disponible.')
    return toQrRecord(data as SupabaseQr)
  }

  async assignTaggo(orderId: string, taggoId: string, ownerId?: string): Promise<QrRecord | null> {
    if (!ownerId) return null
    const { data, error } = await requireClient().rpc('assign_taggo_to_order_customer', {
      p_order_id: orderId,
      p_taggo_id: taggoId,
    })
    if (error) throw error
    return data ? toQrRecord(data as SupabaseQr) : null
  }
}
