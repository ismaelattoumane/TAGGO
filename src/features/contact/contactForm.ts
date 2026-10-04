import { BUSINESS } from '../../config/business'
import { isValidEmail, sanitizeText } from '../../lib/validators'

const MAX_NAME_LENGTH = 80
const MAX_EMAIL_LENGTH = 160
const MAX_MESSAGE_LENGTH = 2000
const MAX_ORDER_REFERENCE_LENGTH = 64

export type ContactFormValues = {
  name: string
  email: string
  orderReference: string
  message: string
}

export type ContactFormErrors = Partial<Record<keyof ContactFormValues, string>>

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: '',
  email: '',
  orderReference: '',
  message: '',
}

/**
 * Validation côté client. Elle protège l'utilisateur d'une adresse mailto
 * malformée ou surdimensionnée ; elle ne remplace pas une validation serveur
 * puisqu'aucun message n'est envoyé à un serveur (voir `ContactPage`).
 */
export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {}

  if (!sanitizeText(values.name)) {
    errors.name = 'Indique ton prénom pour qu’on puisse te répondre.'
  } else if (values.name.trim().length > MAX_NAME_LENGTH) {
    errors.name = `Ce champ est limité à ${MAX_NAME_LENGTH} caractères.`
  }

  if (!isValidEmail(values.email)) {
    errors.email = 'Cette adresse email n’est pas valide.'
  } else if (values.email.trim().length > MAX_EMAIL_LENGTH) {
    errors.email = `Ce champ est limité à ${MAX_EMAIL_LENGTH} caractères.`
  }

  if (values.orderReference.trim().length > MAX_ORDER_REFERENCE_LENGTH) {
    errors.orderReference = `Ce champ est limité à ${MAX_ORDER_REFERENCE_LENGTH} caractères.`
  }

  if (!sanitizeText(values.message)) {
    errors.message = 'Écris ton message.'
  } else if (values.message.trim().length > MAX_MESSAGE_LENGTH) {
    errors.message = `Ce champ est limité à ${MAX_MESSAGE_LENGTH} caractères.`
  }

  return errors
}

/**
 * Construit un lien `mailto:` à partir des données saisies.
 *
 * Aucun message n'est envoyé à un serveur TAGGO : la messagerie du visiteur
 * s'ouvre et il décide de l'envoi. Les valeurs sont nettoyées, bornées puis
 * encodées pour ne jamais pouvoir injecter de séparateur d'en-tête (`&`, `?`,
 * `#`, retour à la ligne) ni de contenu arbitraire dans le lien.
 */
export function buildContactMailto(values: ContactFormValues): string {
  const subject = values.orderReference.trim()
    ? `Contact TAGGO — commande ${sanitizeText(values.orderReference).slice(0, MAX_ORDER_REFERENCE_LENGTH)}`
    : 'Contact TAGGO'

  const body = [
    `Nom : ${sanitizeText(values.name).slice(0, MAX_NAME_LENGTH)}`,
    `Email : ${sanitizeText(values.email).slice(0, MAX_EMAIL_LENGTH)}`,
    values.orderReference.trim()
      ? `Référence de commande : ${sanitizeText(values.orderReference).slice(0, MAX_ORDER_REFERENCE_LENGTH)}`
      : '',
    '',
    sanitizeText(values.message).slice(0, MAX_MESSAGE_LENGTH),
  ]
    .filter((line) => line !== '')
    .join('\n')

  return `mailto:${BUSINESS.supportEmail}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`
}