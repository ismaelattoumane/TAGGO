import { isValidDestinationUrl, sanitizeText } from '../../lib/validators'
import { supabase } from '../../lib/supabase'
import { buildTagCode } from './tagCode'
import type { QrRepository } from './QrRepository'
import type { CreateQrInput, PublicTaggoState, QrRecord, UpdateQrInput } from './qrTypes'
import { toPublicTaggoProfile, type PublicProfileInput, type PublicProfileRecord, type PublicTaggoProfile } from './publicProfile'

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
}

type SupabasePublicProfile = {
  display_name: string
  headline: string | null
  bio: string | null
  profile_url: string | null
}

function requireClient() {
  if (!supabase) throw new Error('La configuration Supabase est manquante.')
  return supabase
}

function toRecord(row: SupabaseQr): QrRecord {
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
  }
}

function validateInput(title: string, destinationUrl: string) {
  const cleanedTitle = sanitizeText(title).slice(0, 80)
  const cleanedDestination = destinationUrl.trim()
  if (!cleanedTitle || !isValidDestinationUrl(cleanedDestination)) {
    throw new Error('Titre ou destination QR invalide.')
  }
  return { title: cleanedTitle, destinationUrl: cleanedDestination }
}

export class SupabaseQrRepository implements QrRepository {
  async list(ownerId?: string): Promise<QrRecord[]> {
    if (!ownerId) return []
    const { data, error } = await requireClient().from('qr_codes').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false })
    if (error) throw error
    return (data as SupabaseQr[]).map(toRecord)
  }

  async getById(id: string, ownerId?: string): Promise<QrRecord | null> {
    if (!ownerId) return null
    const { data, error } = await requireClient().from('qr_codes').select('*').eq('id', id).eq('owner_id', ownerId).maybeSingle()
    if (error) throw error
    return data ? toRecord(data as SupabaseQr) : null
  }

  async getByPublicId(publicId: string): Promise<QrRecord | null> {
    const { data, error } = await requireClient().from('qr_codes').select('*').eq('public_id', publicId.trim().toUpperCase()).eq('status', 'active').eq('is_public', true).not('destination_url', 'is', null).maybeSingle()
    if (error) throw error
    return data ? toRecord(data as SupabaseQr) : null
  }

  async getPublicTaggoProfile(publicId: string): Promise<PublicTaggoProfile | null> {
    const qr = await this.getByPublicId(publicId)
    if (!qr) return null
    const { data, error } = await requireClient()
      .from('public_profiles')
      .select('display_name, headline, bio, profile_url')
      .eq('qr_code_id', qr.id)
      .maybeSingle()
    if (error) throw error
    return toPublicTaggoProfile(qr, data as SupabasePublicProfile | null)
  }

  async getPublicTaggoStatus(publicId: string): Promise<QrRecord['status'] | null> {
    return (await this.getByPublicId(publicId))?.status ?? null
  }

  async getPublicTaggoState(publicId: string): Promise<PublicTaggoState> {
    const { data, error } = await requireClient().rpc('get_public_taggo_state', {
      p_public_id: publicId.trim().toUpperCase(),
    })
    if (error) throw error
    return (data as PublicTaggoState) ?? 'not_found'
  }

  async activate(publicId: string, ownerId: string): Promise<QrRecord | null> {
    if (!ownerId) return null
    const { data, error } = await requireClient().rpc('activate_taggo', {
      p_public_id: publicId.trim().toUpperCase(),
    })
    if (error) throw error
    return data ? toRecord(data as SupabaseQr) : null
  }

  async getPublicProfile(qrId: string, ownerId?: string): Promise<PublicProfileRecord | null> {
    if (!ownerId || !(await this.getById(qrId, ownerId))) return null
    const { data, error } = await requireClient()
      .from('public_profiles')
      .select('display_name, headline, bio, profile_url')
      .eq('qr_code_id', qrId)
      .maybeSingle()
    if (error) throw error
    return data ? {
      displayName: data.display_name,
      headline: data.headline ?? '',
      bio: data.bio ?? '',
      profileUrl: data.profile_url ?? '',
    } : null
  }

  async savePublicProfile(qrId: string, input: PublicProfileInput, ownerId?: string): Promise<PublicProfileRecord | null> {
    if (!ownerId || !(await this.getById(qrId, ownerId))) return null
    const { data, error } = await requireClient()
      .from('public_profiles')
      .upsert({
        qr_code_id: qrId,
        display_name: input.displayName,
        headline: input.headline || null,
        bio: input.bio || null,
        profile_url: input.profileUrl || null,
      }, { onConflict: 'qr_code_id' })
      .select('display_name, headline, bio, profile_url')
      .single()
    if (error) throw error
    return {
      displayName: data.display_name,
      headline: data.headline ?? '',
      bio: data.bio ?? '',
      profileUrl: data.profile_url ?? '',
    }
  }

  async create(input: CreateQrInput): Promise<QrRecord> {
    if (!input.ownerId) throw new Error('Utilisateur non authentifié.')
    const values = validateInput(input.title, input.destinationUrl)
    const { data, error } = await requireClient().from('qr_codes').insert({
      owner_id: input.ownerId,
      public_id: buildTagCode(),
      title: values.title,
      destination_url: values.destinationUrl,
      is_public: false,
      lifecycle_status: 'activated',
    }).select('*').single()
    if (error) throw error
    return toRecord(data as SupabaseQr)
  }

  async update(id: string, updates: UpdateQrInput, ownerId?: string): Promise<QrRecord | null> {
    if (!ownerId) return null
    const current = await this.getById(id, ownerId)
    if (!current) return null
    const values = validateInput(updates.title ?? current.title, updates.destinationUrl ?? current.destinationUrl)
    const status = updates.status ?? current.status
    const { data, error } = await requireClient().from('qr_codes').update({
      title: values.title,
      destination_url: values.destinationUrl,
      status,
      lifecycle_status: status === 'active'
        ? 'active'
        : status === 'inactive'
          ? 'inactive'
          : current.lifecycleStatus ?? 'activated',
      is_public: status === 'active',
    }).eq('id', id).eq('owner_id', ownerId).select('*').maybeSingle()
    if (error) throw error
    return data ? toRecord(data as SupabaseQr) : null
  }

  async remove(id: string, ownerId?: string): Promise<boolean> {
    if (!ownerId) return false
    const { error, count } = await requireClient().from('qr_codes').delete({ count: 'exact' }).eq('id', id).eq('owner_id', ownerId)
    if (error) throw error
    return count === 1
  }
}