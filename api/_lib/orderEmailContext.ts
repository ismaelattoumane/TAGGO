import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrderLineDraft } from '../../src/emails/templates/lineItems'
import { isValidEmail } from '../../src/lib/validators'
import type { OrderEmailContext } from './emailTriggers'

/**
 * ÉTAPE 10 — Lecture serveur des données nécessaires à l'email de commande.
 *
 * AUCUNE donnée n'est inventée : si une information obligatoire manque (email
 * du client, montant, référence), la fonction renvoie `null` et AUCUN email
 * n'est rendu ni envoyé. Le journal `email_events` trace alors l'absence.
 */

type OrderEmailRow = {
  id: string
  customer_id: string
  subtotal_cents: number | null
  currency: string | null
  order_items: {
    quantity: number
    unit_price_cents: number | null
    line_total_cents: number | null
    product_type: string
    product: { name: string | null } | null
    variant: { size: string | null; color: string | null } | null
  }[] | null
}

type ProfileEmailRow = {
  first_name: string | null
  display_name: string | null
  full_name: string | null
}

const DEFAULT_FIRST_NAME = 'TAGGO'

/** Formatage monétaire EUR côté serveur. Le template ne fait aucun calcul. */
export function formatEuros(cents: number, currency: string | null): string {
  if (!Number.isFinite(cents) || cents < 0) return ''
  const amount = (cents / 100).toFixed(2).replace('.', ',')
  return currency && currency.toUpperCase() === 'EUR' ? `${amount} €` : `${amount} ${currency ?? ''}`.trim()
}

function firstNameOf(profile: ProfileEmailRow | null): string {
  const candidate = profile?.first_name ?? profile?.display_name ?? profile?.full_name ?? ''
  const cleaned = candidate.trim().split(/\s+/)[0] ?? ''
  return cleaned.length > 0 ? cleaned : DEFAULT_FIRST_NAME
}

/**
 * Construit le contexte d'email d'une commande payée.
 * Renvoie `null` si une donnée indispensable est absente : aucun email ne part
 * plutôt qu'un email incomplet ou faux.
 */
export async function loadOrderEmailContext(
  client: SupabaseClient,
  orderId: string,
  dashboardUrl: string,
): Promise<OrderEmailContext | null> {
  const { data, error } = await client
    .from('orders')
    .select(
      'id, customer_id, subtotal_cents, currency, order_items(quantity, unit_price_cents, line_total_cents, product_type, product(name), variant(size, color))',
    )
    .eq('id', orderId)
    .maybeSingle()

  if (error || !data) return null

  const order = data as unknown as OrderEmailRow
  const email = order.customer_id

  if (!email) return null

  const { data: recipientData, error: recipientError } = await client.rpc(
    'get_confirmed_order_recipient',
    { p_order_id: orderId },
  )
  if (recipientError) throw recipientError

  const recipient = typeof recipientData === 'string' ? recipientData : ''
  if (!isValidEmail(recipient)) return null

  const { data: profileData, error: profileError } = await client
    .from('profiles')
    .select('first_name, display_name, full_name')
    .eq('id', order.customer_id)
    .maybeSingle()
  if (profileError) throw profileError

  const profile = (profileData as unknown as ProfileEmailRow | null) ?? null

  const totalFormatted = formatEuros(order.subtotal_cents ?? -1, order.currency)
  if (!totalFormatted) return null

  const items = Array.isArray(order.order_items) ? order.order_items : []
  const lines: OrderLineDraft[] = items
    .filter((item) => item.product_type === 'apparel')
    .map((item) => {
      const size = item.variant?.size ? `Taille ${item.variant.size}` : null
      const color = item.variant?.color ?? null
      const variant = [size, color].filter(Boolean).join(' · ') || null

      return {
        name: item.product?.name ?? 'Produit TAGGO',
        variant,
        quantity: item.quantity,
        lineTotalFormatted:
          formatEuros(item.line_total_cents ?? item.unit_price_cents ?? -1, order.currency) || '—',
      }
    })

  return {
    orderId: order.id,
    // Aucune référence commerciale n'existe encore dans le modèle : l'identifiant
    // technique de la commande est utilisé comme référence, sans rien inventer.
    reference: order.id,
    email: recipient,
    firstName: firstNameOf(profile),
    lines,
    totalFormatted,
    dashboardUrl,
  }
}