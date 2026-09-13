import { isValidDestinationUrl, sanitizeText } from '../../lib/validators'
import { supabase } from '../../lib/supabase'
import { buildTagCode } from './tagCode'
import type { QrRepository } from './QrRepository'
import type { CreateQrInput, QrRecord, UpdateQrInput } from './qrTypes'

type SupabaseQr = {
  id: string
  public_id: string
  owner_id: string
  title: string | null
  destination_url: string | null
  status: QrRecord['status']
  created_at: string
  updated_at: string | null
}

function requireClient() {
  if (!supabase) throw new Error('La configuration Supabase est manquante.')
  return supabase
}

function toRecord(row: SupabaseQr): QrRecord {
  return {
    id: row.id,
    publicId: row.public_id,
    ownerId: row.owner_id,
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

  async create(input: CreateQrInput): Promise<QrRecord> {
    if (!input.ownerId) throw new Error('Utilisateur non authentifié.')
    const values = validateInput(input.title, input.destinationUrl)
    const { data, error } = await requireClient().from('qr_codes').insert({
      owner_id: input.ownerId,
      public_id: buildTagCode(),
      title: values.title,
      destination_url: values.destinationUrl,
      is_public: false,
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