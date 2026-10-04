import {
  buttonHtml,
  buttonText,
  bulletsHtml,
  bulletsText,
  greeting,
  paragraphHtml,
  paragraphText,
  renderEmailLayout,
  signature,
} from '../components/layout'
import { BUSINESS } from '../../config/business'
import { clamp, escapeHtml, safeUrl } from '../escape'
import type { OrderEmailData } from '../emailTypes'
import { orderLinesHtml, orderLinesText, type EmailDraft } from './lineItems'

const NEXT_STEPS = [
  'choisir la destination de ton QR code',
  'consulter les fonctionnalités disponibles dans ton dashboard',
  'transférer ton TAGGO si tu souhaites le transmettre',
]

const INTRO =
  "Bien joué, tu viens de rejoindre la team TAGGO ! Ton TAGGO est en cours de préparation. On te tiendra au courant dès qu'il prendra la route."

const PS = `Une question ? Contacte-nous à ${BUSINESS.supportEmail}.`

/**
 * ÉTAPE 10 — Email « commande confirmée ».
 *
 * Le sujet ne dit JAMAIS que le colis est en route : la commande est confirmée,
 * elle n'est pas encore expédiée. L'expédition fait l'objet d'un email distinct,
 * déclenché uniquement par l'événement d'expédition côté serveur.
 */
export function renderOrderConfirmationEmail(
  data: OrderEmailData,
): EmailDraft {
  const dashboardUrl = safeUrl(data.dashboardUrl)
  const total = clamp(data.totalFormatted, 40)
  const reference = clamp(data.reference, 40)
  const orderId = clamp(data.orderId, 40)

  const recapHtml =
    paragraphHtml('Récapitulatif :') +
    `<ul style="margin:0 0 16px 0;padding-left:20px;">${orderLinesHtml(data.lines)}</ul>` +
    paragraphHtml(`Total : ${total}`) +
    paragraphHtml(`Référence de commande : ${reference}`) +
    paragraphHtml(`Identifiant de ta commande : ${orderId}`)

  const recapText = [
    'Récapitulatif :',
    orderLinesText(data.lines),
    `Total : ${total}`,
    `Référence de commande : ${reference}`,
    `Identifiant de ta commande : ${orderId}`,
  ].join('\n')

  const stepsHtml = paragraphHtml('Dès que tu reçois ton TAGGO, tu pourras :') + bulletsHtml(NEXT_STEPS)
  const stepsText = `${paragraphText(
    'Dès que tu reçois ton TAGGO, tu pourras :',
  )}\n${bulletsText(NEXT_STEPS)}`

  const { html, text } = renderEmailLayout({
    title: 'Ta commande TAGGO est confirmée',
    preheader: 'Ta commande est enregistrée. On prépare ton TAGGO.',
    bodyHtml: paragraphHtml(INTRO) + recapHtml + stepsHtml + buttonHtml(dashboardUrl, 'Ouvrir mon dashboard'),
    bodyText: [INTRO, recapText, stepsText, buttonText(dashboardUrl, 'Dashboard'), PS]
      .filter((part) => part.trim().length > 0)
      .join('\n\n'),
    greeting: greeting(data.firstName),
    signature: signature(),
  })

  return {
    subject: 'Ta commande TAGGO est confirmée 🔥',
    preheader: 'Ta commande est enregistrée. On prépare ton TAGGO.',
    html,
    text,
  }
}

/** Ligne de support réutilisable en pied d'email. */
export function supportLine(): string {
  return escapeHtml(PS)
}