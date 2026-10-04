import {
  buttonHtml,
  buttonText,
  greeting,
  paragraphHtml,
  renderEmailLayout,
  signatureShort,
} from '../components/layout'
import { clamp, safeUrl } from '../escape'
import type { PasswordResetEmailData } from '../emailTypes'
import type { EmailDraft } from './lineItems'

const INTRO =
  'Une demande de réinitialisation du mot de passe de ton compte TAGGO a été effectuée.'

const IGNORE_NOTE =
  "Si tu n'es pas à l'origine de cette demande, tu peux ignorer cet email : ton mot de passe actuel reste inchangé et ne t'est jamais envoyé par email."

/**
 * ÉTAPE 10 — Email de réinitialisation du mot de passe.
 *
 * Sûreté :
 * - le lien est fourni par le mécanisme d'authentification (Supabase Auth) et
 *   validé par `safeUrl` : ni `javascript:`, ni URL relative, ni retour ligne ;
 * - aucune durée de validité n'est annoncée tant que le fournisseur
 *   d'authentification n'a pas de durée configurée et vérifiée ;
 * - le mot de passe actuel n'est jamais inclus, ni en clair ni chiffré.
 */
export function renderPasswordResetEmail(data: PasswordResetEmailData): EmailDraft {
  const resetUrl = safeUrl(data.resetUrl)

  const bodyHtml =
    paragraphHtml(INTRO) +
    buttonHtml(resetUrl, 'Choisir un nouveau mot de passe') +
    paragraphHtml(IGNORE_NOTE) +
    (data.expiresIn
      ? paragraphHtml(`Ce lien est valable ${clamp(data.expiresIn, 80)}.`)
      : '')

  const bodyText = [
    INTRO,
    buttonText(resetUrl, 'Réinitialiser le mot de passe'),
    IGNORE_NOTE,
    data.expiresIn ? `Ce lien est valable ${clamp(data.expiresIn, 80)}.` : '',
  ]
    .filter((part) => part.trim().length > 0)
    .join('\n\n')

  const { html, text } = renderEmailLayout({
    title: '🔑 Réinitialise ton mot de passe TAGGO',
    preheader: 'Réinitialisation du mot de passe de ton compte TAGGO.',
    bodyHtml,
    bodyText,
    greeting: greeting(data.firstName),
    signature: signatureShort(),
  })

  return {
    subject: '🔑 Réinitialise ton mot de passe TAGGO',
    preheader: 'Réinitialisation du mot de passe de ton compte TAGGO.',
    html,
    text,
  }
}