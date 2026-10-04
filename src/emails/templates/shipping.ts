import {
  buttonHtml,
  buttonText,
  greeting,
  paragraphHtml,
  paragraphText,
  renderEmailLayout,
  signatureShort,
} from '../components/layout'
import { clamp, safeUrl } from '../escape'
import type { ShippingEmailData } from '../emailTypes'
import { orderLinesHtml, orderLinesText, type EmailDraft } from './lineItems'

const INTRO = 'Ta commande TAGGO vient d’être remise au transporteur.'

/**
 * ÉTAPE 10 — Email « expédition ».
 *
 * Le transporteur, le numéro de suivi, le lien de suivi et le délai estimé sont
 * INJECTÉS dynamiquement par le serveur. Aucun transporteur (La Poste,
 * Colissimo, DPD…) n'est codé en dur, et aucun délai n'est annoncé s'il n'est
 * pas fourni.
 */
export function renderShippingEmail(
  data: ShippingEmailData,
): EmailDraft {
  const trackingUrl = safeUrl(data.trackingUrl)
  const reference = clamp(data.reference, 40)

  const shipmentHtml =
    (data.carrierName ? paragraphHtml(`Transporteur : ${clamp(data.carrierName, 120)}`) : '') +
    (data.trackingNumber
      ? paragraphHtml(`Numéro de suivi : ${clamp(data.trackingNumber, 120)}`)
      : '') +
    buttonHtml(trackingUrl, trackingUrl ? 'Suivre ma commande' : '') +
    (data.estimatedDelay
      ? paragraphHtml(`Délai estimé : ${clamp(data.estimatedDelay, 120)}`)
      : '')

  const shipmentText = [
    data.carrierName ? `Transporteur : ${clamp(data.carrierName, 120)}` : '',
    data.trackingNumber ? `Numéro de suivi : ${clamp(data.trackingNumber, 120)}` : '',
    buttonText(trackingUrl, 'Suivi'),
    data.estimatedDelay ? `Délai estimé : ${clamp(data.estimatedDelay, 120)}` : '',
  ]
    .filter((part) => part.trim().length > 0)
    .join('\n')

  const { html, text } = renderEmailLayout({
    title: 'Ton TAGGO prend la route !',
    preheader: 'Ta commande TAGGO est remise au transporteur.',
    bodyHtml:
      paragraphHtml(INTRO) +
      shipmentHtml +
      paragraphHtml(`Référence de commande : ${reference}`) +
      `<ul style="margin:0 0 16px 0;padding-left:20px;">${orderLinesHtml(data.lines)}</ul>` +
      paragraphHtml('Ton TAGGO arrive bientôt.'),
    bodyText: [
      INTRO,
      shipmentText,
      `Référence de commande : ${reference}`,
      orderLinesText(data.lines),
      paragraphText('Ton TAGGO arrive bientôt.'),
    ]
      .filter((part) => part.trim().length > 0)
      .join('\n\n'),
    greeting: greeting(data.firstName),
    signature: signatureShort(),
  })

  return {
    subject: 'Ton TAGGO prend la route !',
    preheader: 'Ta commande TAGGO est remise au transporteur.',
    html,
    text,
  }
}