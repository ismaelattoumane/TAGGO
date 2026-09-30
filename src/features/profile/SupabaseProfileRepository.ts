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

export class SupabaseProfileRepository implements ProfileRepository {
  async getCurrentProfile(): Promise<TaggoProfile | null> {
    const client = requireClient()
    const { data: authData, error: authError } = await client.auth.getUser()
    if (authError || !authData.user) return null

    const { data, error } = await client
      .from('profiles')
      .select('id, email, first_name, last_name, display_name, full_name, created_at, updated_at')
      .eq('id', authData.user.id)
      .maybeSingle()
    if (error) throw error
    if (data) return toProfile(data as SupabaseProfile)

    const displayName = authData.user.user_metadata?.full_name ?? ''
    const { data: created, error: insertError } = await client
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: authData.user.email ?? '',
        full_name: displayName || null,
        display_name: displayName || null,
      })
      .select('id, email, first_name, last_name, display_name, full_name, created_at, updated_at')
      .single()
    if (insertError) throw insertError
    return toProfile(created as SupabaseProfile)
  }

  async updateCurrentProfile(input: UpdateTaggoProfileInput): Promise<TaggoProfile | null> {
    const client = requireClient()
    const { data: authData, error: authError } = await client.auth.getUser()
    if (authError || !authData.user) return null

    const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ')
    const { data, error } = await client
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: authData.user.email ?? '',
        first_name: input.firstName,
        last_name: input.lastName,
        display_name: input.displayName,
        full_name: fullName || null,
      }, { onConflict: 'id' })
      .select('id, email, first_name, last_name, display_name, full_name, created_at, updated_at')
      .single()
    if (error) throw error
    return toProfile(data as SupabaseProfile)
  }
}