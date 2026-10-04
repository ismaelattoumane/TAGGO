import {
  buttonHtml,
  buttonText,
  greeting,
  paragraphHtml,
  renderEmailLayout,
  signatureShort,
} from '../components/layout'
import { clamp, safeUrl } from '../escape'
import type { CartAbandonedEmailData } from '../emailTypes'
import { promoBlocks } from './review'
import type { EmailDraft } from './lineItems'

const INTRO = 'Ton panier TAGGO t’attend toujours.'

/**
 * ÉTAPE 10 — Email « panier abandonné ».
 *
 * Aucun code promotionnel n'est inventé : le bloc n'apparaît que si un code
 * réel est fourni.
 *
 * Aucune promesse de réservation de stock n'est faite : le panier ne réserve
 * rien. Le stock n'est décrémenté qu'après confirmation serveur du paiement.
 */
export function renderCartAbandonedEmail(data: CartAbandonedEmailData): EmailDraft {
  const cartUrl = safeUrl(data.cartUrl)
  const promo = promoBlocks(data.promo)

  const attributes = [
    `Produit : ${clamp(data.productName, 120)}`,
    data.size ? `Taille : ${clamp(data.size, 60)}` : '',
    data.color ? `Couleur : ${clamp(data.color, 60)}` : '',
    `Prix : ${clamp(data.priceFormatted, 40)}`,
  ].filter((line) => line.length > 0)

  const { html, text } = renderEmailLayout({
    title: 'Ton TAGGO t’attend dans ton panier !',
    preheader: 'Ton panier TAGGO est toujours disponible.',
    bodyHtml:
      paragraphHtml(INTRO) +
      attributes
        .map((line) => paragraphHtml(line))
        .join('') +
      buttonHtml(cartUrl, 'Retrouver mon panier') +
      promo.html,
    bodyText: [INTRO, attributes.join('\n'), buttonText(cartUrl, 'Retrouve ton panier'), promo.text]
      .filter((part) => part.trim().length > 0)
      .join('\n\n'),
    greeting: greeting(data.firstName),
    signature: signatureShort(),
  })

  return {
    subject: 'Ton TAGGO t’attend dans ton panier !',
    preheader: 'Ton panier TAGGO est toujours disponible.',
    html,
    text,
  }
}