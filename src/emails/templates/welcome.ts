import {
  buttonHtml,
  buttonText,
  greeting,
  paragraphHtml,
  renderEmailLayout,
  signature,
} from '../components/layout'
import { safeUrl } from '../escape'
import type { WelcomeEmailData } from '../emailTypes'
import { promoBlocks } from './review'
import type { EmailDraft } from './lineItems'

const INTRO = "Bienvenue dans l'univers TAGGO. Ici, les vêtements connectent le physique au numérique."

const INTRO_2 =
  "Ton espace TAGGO te permettra de gérer ton compte et, lorsque tu possèdes un TAGGO, de gérer les fonctionnalités associées."

/**
 * ÉTAPE 10 — Email de bienvenue.
 * Aucune offre de bienvenue n'est annoncée tant qu'aucun code réel n'est actif.
 */
export function renderWelcomeEmail(data: WelcomeEmailData): EmailDraft {
  const collectionUrl = safeUrl(data.collectionUrl)
  const howItWorksUrl = safeUrl(data.howItWorksUrl)
  const dashboardUrl = safeUrl(data.dashboardUrl)
  const promo = promoBlocks(data.promo)

  const { html, text } = renderEmailLayout({
    title: '👋 Bienvenue chez TAGGO',
    preheader: 'Bienvenue dans l’univers TAGGO.',
    bodyHtml:
      paragraphHtml(INTRO) +
      paragraphHtml(INTRO_2) +
      buttonHtml(collectionUrl, 'Découvrir TAGGO') +
      buttonHtml(howItWorksUrl, 'Comment ça marche ?') +
      buttonHtml(dashboardUrl, 'Ouvrir mon dashboard') +
      promo.html,
    bodyText: [
      INTRO,
      INTRO_2,
      buttonText(collectionUrl, 'Découvrir TAGGO'),
      buttonText(howItWorksUrl, 'Comment ça marche'),
      buttonText(dashboardUrl, 'Dashboard'),
      promo.text,
    ]
      .filter((part) => part.trim().length > 0)
      .join('\n\n'),
    greeting: greeting(data.firstName),
    signature: signature(),
  })

  return {
    subject: '👋 Bienvenue chez TAGGO',
    preheader: 'Bienvenue dans l’univers TAGGO.',
    html,
    text,
  }
}