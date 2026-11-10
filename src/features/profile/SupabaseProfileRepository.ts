import { supabase } from '../../lib/supabase'
import type { ProfileRepository } from './ProfileRepository'
import type { TaggoProfile, UpdateTaggoProfileInput } from './profileTypes'

type SupabaseProfile = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  full_name: string | null
  created_at: string | null
  updated_at: string | null
}

function requireClient() {
  if (!supabase) throw new Error('La configuration Supabase est manquante.')
  return supabase
}

function toProfile(row: SupabaseProfile): TaggoProfile {
  return {
    id: row.id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    displayName: row.display_name ?? row.full_name ?? '',
    email: row.email,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  }
}

const PROFILE_COLUMNS = 'id, email, first_name, last_name, display_name, full_name, created_at, updated_at'
const PROFILE_COLUMNS_FALLBACK = 'id, email, full_name, avatar_url, created_at, updated_at'

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42703' || /column .* does not exist/i.test(error?.message ?? '')
}

export class SupabaseProfileRepository implements ProfileRepository {
  async getCurrentProfile(): Promise<TaggoProfile | null> {
    const client = requireClient()
    const { data: authData, error: authError } = await client.auth.getUser()
    if (authError || !authData.user) return null

    let { data, error } = await client
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', authData.user.id)
      .maybeSingle()
    if (isMissingColumnError(error)) {
      ;({ data, error } = await client
        .from('profiles')
        .select(PROFILE_COLUMNS_FALLBACK)
        .eq('id', authData.user.id)
        .maybeSingle())
    }
    if (error) throw error
    if (data) return toProfile(data as SupabaseProfile)

    const displayName = authData.user.user_metadata?.full_name ?? ''
    let insertResult = await client
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: authData.user.email ?? '',
        full_name: displayName || null,
        display_name: displayName || null,
      })
      .select(PROFILE_COLUMNS)
      .single()
    if (isMissingColumnError(insertResult.error)) {
      insertResult = await client
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: authData.user.email ?? '',
          full_name: displayName || null,
        })
        .select(PROFILE_COLUMNS_FALLBACK)
        .single()
    }
    if (insertResult.error) throw insertResult.error
    return toProfile(insertResult.data as SupabaseProfile)
  }

  async updateCurrentProfile(input: UpdateTaggoProfileInput): Promise<TaggoProfile | null> {
    const client = requireClient()
    const { data: authData, error: authError } = await client.auth.getUser()
    if (authError || !authData.user) return null

    const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ')
    let result = await client
      .from('profiles')
      .upsert({
        id: authData.user.id,
        first_name: input.firstName,
        last_name: input.lastName,
        display_name: input.displayName,
        full_name: fullName || null,
      }, { onConflict: 'id' })
      .select(PROFILE_COLUMNS)
      .single()
    if (isMissingColumnError(result.error)) {
      result = await client
        .from('profiles')
        .upsert({
          id: authData.user.id,
          full_name: (input.displayName || fullName) || null,
        }, { onConflict: 'id' })
        .select(PROFILE_COLUMNS_FALLBACK)
        .single()
    }
    if (result.error) throw result.error
    return toProfile(result.data as SupabaseProfile)
  }
}