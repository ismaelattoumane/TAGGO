import { isSupabaseConfigured } from '../../lib/supabase'
import { LocalProfileRepository } from './LocalProfileRepository'
import { SupabaseProfileRepository } from './SupabaseProfileRepository'
import type { ProfileRepository } from './ProfileRepository'

const unavailableProfileRepository: ProfileRepository = {
  getCurrentProfile: () => null,
  updateCurrentProfile: async () => {
    throw new Error('Supabase doit être configuré pour modifier le profil.')
  },
}

export const profileRepository: ProfileRepository = isSupabaseConfigured
  ? new SupabaseProfileRepository()
  : import.meta.env.DEV
    ? new LocalProfileRepository()
    : unavailableProfileRepository