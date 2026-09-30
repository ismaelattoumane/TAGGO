import { isSupabaseConfigured } from '../../lib/supabase'
import { LocalOrderRepository } from './LocalOrderRepository'
import { SupabaseOrderRepository } from './SupabaseOrderRepository'
import type { OrderRepository } from './OrderRepository'

const unavailableOrderRepository: OrderRepository = {
  createOrder: async () => { throw new Error('Supabase doit être configuré pour la production.') },
  getOrder: async () => null,
  listOrders: () => [],
  updateOrderStatus: async () => null,
  reserveTaggo: async () => { throw new Error('Supabase doit être configuré pour la production.') },
  assignTaggo: async () => null,
}

export const orderRepository: OrderRepository = isSupabaseConfigured
  ? new SupabaseOrderRepository()
  : import.meta.env.PROD
    ? unavailableOrderRepository
    : new LocalOrderRepository()
