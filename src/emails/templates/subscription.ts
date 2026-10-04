import {
  buttonHtml,
  buttonText,
  greeting,
  paragraphHtml,
  renderEmailLayout,
  signature,
} from '../components/layout'
import { safeUrl } from '../escape'
import type { TaggoSubscriptionEmailData } from '../emailTypes'
import type { EmailDraft } from './lineItems'

/**
 * ÉTAPE 12 — Emails d'abonnement TAGGO.
 *
 * RÈGLE ABSOLUE : aucune donnée financière. Ni montant, ni devise, ni
 * identifiant Stripe, ni référence de commande n'apparaît dans ces messages.
 * Un email qui annonce un prix alors que le tarif de renouvellement n'est pas
 * décidé serait une promesse commerciale inventée.
 *
 * Ces trois emails sont RENDUS mais jamais ENVOYÉS : le projet ne dispose
 * d'aucun déclencheur serveur planifié. Voir `docs/subscriptions.md`
 * § « Emails » pour le point laissé ouvert.
 */

type SubscriptionKind = 'expiring' | 'expired' | 'renewed'

function subjectFor(kind: SubscriptionKind, taggoPublicId: string): string {
  if (kind === 'expiring') return `Votre TAGGO ${taggoPublicId} arrive bientôt à échéance`
  if (kind === 'expired') return `Votre TAGGO ${taggoPublicId} n'est plus actif`
  return `Votre TAGGO ${taggoPublicId} a été renouvelé`
}

function preheaderFor(kind: SubscriptionKind): string {
  if (kind === 'expiring') return 'La période de votre TAGGO se termine.'
  if (kind === 'expired') return 'Votre TAGGO doit être renouvelé pour redevenir actif.'
  return 'Votre TAGGO est à nouveau actif.'
}

function introFor(kind: SubscriptionKind, taggoPublicId: string, endsAtLabel: string | null): string {
  if (kind === 'expiring') {
    return endsAtLabel
      ? `La période de votre TAGGO ${taggoPublicId} se termine le ${endsAtLabel}. Passé cette date, sa page publique ne redirigera plus vers sa destination.`
      : `La période de votre TAGGO ${taggoPublicId} arrive à échéance. Passé cette date, sa page publique ne redirigera plus vers sa destination.`
  }
  if (kind === 'expired') {
    return `La période de votre TAGGO ${taggoPublicId} est terminée. Sa page publique est temporairement suspendue jusqu’à son renouvellement.`
  }
  return `Le renouvellement de votre TAGGO ${taggoPublicId} est confirmé : sa page publique est de nouveau active.`
}

export function renderSubscriptionExpiringEmail(data: TaggoSubscriptionEmailData): EmailDraft {
  return renderSubscriptionEmail('expiring', data)
}

export function renderSubscriptionExpiredEmail(data: TaggoSubscriptionEmailData): EmailDraft {
  return renderSubscriptionEmail('expired', data)
}

export function renderSubscriptionRenewedEmail(data: TaggoSubscriptionEmailData): EmailDraft {
  return renderSubscriptionEmail('renewed', data)
}

function renderSubscriptionEmail(kind: SubscriptionKind, data: TaggoSubscriptionEmailData): EmailDraft {
  const dashboardUrl = safeUrl(data.dashboardUrl)
  const intro = introFor(kind, data.taggoPublicId, data.endsAtLabel)
  const isRenewed = kind === 'renewed'
  const followUp = isRenewed
    ? 'Aucune action n’est nécessaire de votre part.'
    : 'Retrouvez le statut et les dates de ce TAGGO dans votre espace.'

  const { html, text } = renderEmailLayout({
    title: isRenewed ? 'TAGGO renouvelé' : 'TAGGO',
    preheader: preheaderFor(kind),
    bodyHtml:
      paragraphHtml(intro) +
      paragraphHtml(followUp) +
      buttonHtml(dashboardUrl, 'Ouvrir mon TAGGO'),
    bodyText: [intro, followUp, buttonText(dashboardUrl, 'Ouvrir mon TAGGO')]
      .filter((part) => part.trim().length > 0)
      .join('\n\n'),
    greeting: greeting(data.firstName),
    signature: signature(),
  })

  return {
    subject: subjectFor(kind, data.taggoPublicId),
    preheader: preheaderFor(kind),
    html,
    text,
  }
}