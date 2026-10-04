import { isValidDestinationUrl, sanitizeText } from '../../lib/validators'
import { supabase } from '../../lib/supabase'
import { buildTagCode } from './tagCode'
import type { QrRepository } from './QrRepository'
import type { CreateQrInput, PublicTaggoState, QrRecord, UpdateQrInput } from './qrTypes'
import type { TaggoLifecycleStatus } from './qrTypes'
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
  reserved_at: string | null
  assigned_at: string | null
  activated_at: string | null
}

type SupabasePublicProfile = {
  display_name: string
  headline: string | null
  bio: string | null
  profile_url: string | null
}

/**
 * Colonnes de la vue publique `public_taggo_cards`. Volontairement restreint :
 * ni `owner_id`, ni horodatage de cycle de vie, ni référence de paiement ou
 * d'abonnement n'y sont projetés, donc aucun ne peutfuiter.
 */
type SupabasePublicCard = Pick<SupabaseQr, 'id' | 'public_id' | 'title' | 'destination_url' | 'status'>

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
    reservedAt: row.reserved_at ?? undefined,
    assignedAt: row.assigned_at ?? undefined,
    activatedAt: row.activated_at ?? undefined,
  }
}

/**
 * La vue publique ne projette que cinq colonnes : ni `owner_id`, ni horodatage
 * de cycle de vie. `QrRecord.createdAt` est donc renseigné à vide — la page
 * publique n'a aucune date à afficher, et `getPublicTaggoProfile` /
 * `getPublicTaggoStatus` n'utilisent que `id`, `publicId`, `title`,
 * `destinationUrl` et `status`.
 */
function toPublicCardRecord(row: SupabasePublicCard): QrRecord {
  return {
    id: row.id,
    publicId: row.public_id,
    title: row.title ?? '',
    destinationUrl: row.destination_url ?? '',
    status: row.status,
    createdAt: '',
  }
}

function validateInput(title: string, destinationUrl: string) {  const cleanedTitle = sanitizeText(title).slice(0, 80)
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
    // Lecture PUBLIQUE : elle passe par `public_taggo_cards`, une vue à colonnes
    // explicites. La table `qr_codes` n'est plus lisible par l'anonyme, et sa RLS
    // ne filtres que des lignes : passer par elle exposait `owner_id` au moindre
    // `select *`. La vue ne projette que ce que la page publique affiche.
    const { data, error } = await requireClient().from('public_taggo_cards').select('id, public_id, title, destination_url, status').eq('public_id', publicId.trim().toUpperCase()).maybeSingle()
    if (error) throw error
    return data ? toPublicCardRecord(data as SupabasePublicCard) : null
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

  async transition(id: string, to: TaggoLifecycleStatus, ownerId?: string): Promise<QrRecord | null> {
    if (!ownerId) return null
    const { data, error } = await requireClient().rpc('transition_taggo', {
      p_qr_id: id,
      p_target_status: to,
    })
    if (error) throw error
    return data ? toRecord(data as SupabaseQr) : null
  }

  /**
   * Volontairement refusée en mode Supabase.
   *
   * La RPC `assign_taggo_to_user` a été retirée du périmètre client
   * (migration `20260931130000_taggo_hardening_followup.sql`) : elle
   * n'exigeait ni achat, ni commande, ni affectation préalable, et permettait
   * donc à n'importe quel compte authentifié de s'attribuer un TAGGO du stock —
   * y compris un TAGGO déjà réservé pour la commande payée d'un tiers. Elle
   * contournait exactement ce que la protection du cycle de vie cherche à
   * garantir.
   *
   * Les affectations légitimes passent par `activate_taggo` (TAGGO attribué lors
   * d'une commande), `assign_taggo_to_order_customer` (commande vérifiée) ou le
   * webhook Stripe. Aucune page n'appelle cette méthode : elle n'existe plus
   * que pour le dépôt local de démonstration, où elle écrit dans
   * LocalStorage et non en base.
   */
  async assignTagToUser(_id: string, _ownerId: string): Promise<QrRecord | null> {
    throw new Error(
      "L'affectation directe d'un TAGGO n'est pas autorisée. Un TAGGO est attribué par une commande ou par le serveur.",
    )
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

    // Contenu du TAGGO : colonnes accordées au client (`grant update (title,
    // description, destination_url)`), le reste est refusé par PostgreSQL.
    const content: UpdateQrInput = { title: values.title, destinationUrl: values.destinationUrl }
    const { data: saved, error } = await requireClient().from('qr_codes').update(content).eq('id', id).eq('owner_id', ownerId).select('*').maybeSingle()
    if (error) throw error

    const status = updates.status ?? current.status
    if (status !== current.status) {
      // `status` / `lifecycle_status` / `is_public` sont des champs serveur :
      // PostgreSQL refuse toute écriture directe. Le seul chemin autorisé est
      // `set_taggo_status`, qui porte les mêmes garde-fous d'abonnement et de
      // cycle de vie que `transition_taggo`.
      const { data: transitioned, error: statusError } = await requireClient().rpc('set_taggo_status', {
        p_qr_id: id,
        p_status: status,
      })
      if (statusError) throw statusError
      return transitioned ? toRecord(transitioned as SupabaseQr) : (saved ? toRecord(saved as SupabaseQr) : null)
    }

    return saved ? toRecord(saved as SupabaseQr) : null
  }

  async remove(id: string, ownerId?: string): Promise<boolean> {
    if (!ownerId) return false
    const { error, count } = await requireClient().from('qr_codes').delete({ count: 'exact' }).eq('id', id).eq('owner_id', ownerId)
    if (error) throw error
    return count === 1
  }
}