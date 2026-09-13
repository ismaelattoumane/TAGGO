import { isSupabaseConfigured } from '../../lib/supabase'
import { LocalQrRepository } from './LocalQrRepository'
import { SupabaseQrRepository } from './SupabaseQrRepository'
import type { QrRepository } from './QrRepository'

const unavailableQrRepository: QrRepository = {
  list: () => [],
  getById: () => null,
  getByPublicId: () => null,
  create: async () => { throw new Error('Supabase doit être configuré pour la production.') },
  update: () => null,
  remove: () => false,
  getPublicTaggoProfile: () => null,
  getPublicTaggoStatus: () => null,
  getPublicTaggoState: () => 'not_found',
  activate: async () => { throw new Error('Supabase doit être configuré pour la production.') },
  getPublicProfile: () => null,
  savePublicProfile: async () => { throw new Error('Supabase doit être configuré pour la production.') },
}

export const qrRepository: QrRepository = isSupabaseConfigured
  ? new SupabaseQrRepository()
  : import.meta.env.PROD
    ? unavailableQrRepository
    : new LocalQrRepository()