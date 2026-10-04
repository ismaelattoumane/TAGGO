import {
  buttonHtml,
  buttonText,
  bulletsHtml,
  bulletsText,
  greeting,
  paragraphHtml,
  paragraphText,
  renderEmailLayout,
  signatureShort,
} from '../components/layout'
import { clamp, escapeHtml, safeUrl } from '../escape'
import type { OrderEmailData } from '../emailTypes'
import type { EmailDraft } from './lineItems'

const STEPS = [
  'Ouvre ton colis.',
  'Scanne le QR code de ton TAGGO.',
  'Connecte-toi à ton dashboard.',
  'Configure ta destination.',
]

const USE_CASES = [
  'Instagram',
  'TikTok',
  'YouTube',
  'plusieurs liens',
  'une boutique',
  'un portfolio',
  'un site',
  'une page de projet',
]

const TRANSFER_NOTE =
  "Si tu offres ton TAGGO, utilise la fonctionnalité de transfert prévue par le dashboard."

/**
 * ÉTAPE 10 — Email « livraison ».
 * Déclenché uniquement après confirmation serveur de la livraison.
 */
export function renderDeliveryEmail(data: OrderEmailData): EmailDraft {
  const dashboardUrl = safeUrl(data.dashboardUrl)

  const { html, text } = renderEmailLayout({
    title: '🎉 Ton TAGGO est là !',
    preheader: 'Ton TAGGO vient d’être livré. Il est temps de scanner.',
    bodyHtml:
      paragraphHtml('Ton TAGGO vient d’être livré. 📬') +
      paragraphHtml('Maintenant, place à la partie la plus cool :') +
      `<ol style="margin:0 0 16px 0;padding-left:20px;">${stepsHtml()}</ol>` +
      buttonHtml(dashboardUrl, 'Ouvrir mon dashboard') +
      paragraphHtml('Tu peux notamment utiliser ton TAGGO pour :') +
      bulletsHtml(USE_CASES) +
      paragraphHtml(TRANSFER_NOTE),
    bodyText: [
      paragraphText('Ton TAGGO vient d’être livré. 📬'),
      paragraphText('Maintenant, place à la partie la plus cool :'),
      STEPS.map((step, index) => `${index + 1}. ${step}`).join('\n'),
      buttonText(dashboardUrl, 'Dashboard'),
      `${paragraphText('Tu peux notamment utiliser ton TAGGO pour :')}\n${bulletsText(USE_CASES)}`,
      paragraphText(TRANSFER_NOTE),
    ]
      .filter((part) => part.trim().length > 0)
      .join('\n\n'),
    greeting: greeting(data.firstName),
    signature: signatureShort(),
  })

  return {
    subject: '🎉 Ton TAGGO est là !',
    preheader: 'Ton TAGGO vient d’être livré. Il est temps de scanner.',
    html,
    text,
  }
}

function stepsHtml(): string {
  return STEPS.map(
    (step) =>
      `<li style="margin:0 0 8px 0;color:#2B2D42;font-size:15px;line-height:1.6;">${escapeHtml(
        clamp(step, 200),
      )}</li>`,
  ).join('')
}