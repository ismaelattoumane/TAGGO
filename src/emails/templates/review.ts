import {
  buttonHtml,
  buttonText,
  bulletsHtml,
  bulletsText,
  greeting,
  paragraphHtml,
  renderEmailLayout,
  signature,
} from '../components/layout'
import { clamp, safeUrl } from '../escape'
import type { EmailPromo, ReviewEmailData } from '../emailTypes'
import type { EmailDraft } from './lineItems'

const QUESTIONS = [
  'La coupe te convient-elle ?',
  'Le QR se scanne-t-il correctement ?',
  'Le dashboard est-il facile à utiliser ?',
  "Qu'est-ce qu'on pourrait améliorer ?",
]

const INTRO = 'Ton TAGGO a déjà commencé sa vie. 🚀 On aimerait savoir ce que tu en penses.'

/**
 * Bloc promotionnel d'un email.
 *
 * Il ne renvoie du contenu QUE si un code réel est fourni : aucune réduction
 * n'est annoncée tant qu'aucune offre n'est active côté TAGGO.
 */
export function promoBlocks(promo: EmailPromo | null): { html: string; text: string } {
  if (!promo || !promo.code) return { html: '', text: '' }

  const lines = [
    `Code : ${clamp(promo.code, 60)}`,
    promo.expiresAt ? `Validité : ${clamp(promo.expiresAt, 60)}` : '',
    promo.conditions ? `Conditions : ${clamp(promo.conditions, 300)}` : '',
  ].filter((line) => line.length > 0)

  return {
    html: paragraphHtml('Une offre est active pour ta prochaine commande :') + bulletsHtml(lines),
    text: lines.join('\n'),
  }
}

/**
 * ÉTAPE 10 — Email « demande d'avis ».
 * Le bloc promotionnel n'est rendu que si un code réel est fourni.
 */
export function renderReviewRequestEmail(data: ReviewEmailData): EmailDraft {
  const reviewUrl = safeUrl(data.reviewUrl)
  const promo = promoBlocks(data.promo)

  const { html, text } = renderEmailLayout({
    title: 'Donne ton avis sur TAGGO',
    preheader: 'Ton TAGGO a déjà commencé sa vie. Ton avis compte.',
    bodyHtml: paragraphHtml(INTRO) + bulletsHtml(QUESTIONS) + buttonHtml(reviewUrl, 'Laisser mon avis') + promo.html,
    bodyText: [INTRO, bulletsText(QUESTIONS), buttonText(reviewUrl, 'Avis'), promo.text]
      .filter((part) => part.trim().length > 0)
      .join('\n\n'),
    greeting: greeting(data.firstName),
    signature: signature(),
  })

  return {
    subject: 'Donne ton avis sur TAGGO',
    preheader: 'Ton TAGGO a déjà commencé sa vie. Ton avis compte.',
    html,
    text,
  }
}

export { QUESTIONS as REVIEW_QUESTIONS }