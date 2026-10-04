import { BUSINESS } from '../../config/business'
import { clamp, escapeAttribute, escapeHtml } from '../escape'

/**
 * ÉTAPE 10 — Gabarit d'email HTML + texte brut.
 *
 * Charte volontairement sobre : pas d'image distante, pas de police externe,
 * pas de script. Toutes les données dynamiques sont échappées par `escapeHtml`.
 */

const BRAND_COLOR = '#6F2DA8'
const INK_COLOR = '#2B2D42'
const MUTED_COLOR = '#6D597A'

type LayoutInput = {
  title: string
  preheader: string
  /** Blocs déjà rendus/échappés. */
  bodyHtml: string
  bodyText: string
  /** Paragraphe d'ouverture, déjà échappé. */
  greeting: string
  /** Signature de fin, déjà échappée. */
  signature: string
}

/** Bloc « paragraphe + liste à puces » partagé par plusieurs templates. */
export function bulletsHtml(items: string[]): string {
  if (items.length === 0) return ''

  const listItems = items
    .map(
      (item) =>
        `<li style="margin:0 0 8px 0;color:${INK_COLOR};font-size:15px;line-height:1.6;">${escapeHtml(
          clamp(item, 300),
        )}</li>`,
    )
    .join('')

  return `<ul style="margin:0 0 16px 0;padding-left:20px;">${listItems}</ul>`
}

export function bulletsText(items: string[]): string {
  if (items.length === 0) return ''
  return items.map((item) => `- ${clamp(item, 300)}`).join('\n')
}

export function paragraphHtml(text: string): string {
  return `<p style="margin:0 0 16px 0;color:${INK_COLOR};font-size:15px;line-height:1.7;">${escapeHtml(
    clamp(text, 800),
  )}</p>`
}

export function paragraphText(text: string): string {
  return clamp(text, 800)
}

export function buttonHtml(url: string | null, label: string): string {
  if (!url) return ''

  return `<p style="margin:0 0 20px 0;"><a href="${escapeAttribute(
    url,
  )}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:12px 22px;border-radius:10px;">${escapeHtml(
    clamp(label, 80),
  )}</a></p>`
}

export function buttonText(url: string | null, label: string): string {
  if (!url) return ''
  return `${label} : ${url}`
}

export function renderEmailLayout({
  title,
  preheader,
  bodyHtml,
  bodyText,
  greeting,
  signature,
}: LayoutInput): { html: string; text: string } {
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(clamp(title, 150))}</title>
</head>
<body style="margin:0;padding:0;background:#F5E1DA;font-family:Inter,'Segoe UI',system-ui,-apple-system,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
    clamp(preheader, 200),
  )}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5E1DA;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFAF8;border:1px solid rgba(43,45,66,0.12);border-radius:18px;">
<tr><td style="padding:28px 24px;">
<p style="margin:0 0 20px 0;color:${BRAND_COLOR};font-size:13px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">${escapeHtml(
    BUSINESS.businessName,
  )}</p>
<h1 style="margin:0 0 16px 0;color:${INK_COLOR};font-size:22px;line-height:1.25;">${escapeHtml(
    clamp(title, 150),
  )}</h1>
<p style="margin:0 0 16px 0;color:${INK_COLOR};font-size:15px;line-height:1.6;">${greeting}</p>
${bodyHtml}
<p style="margin:24px 0 0 0;color:${INK_COLOR};font-size:15px;line-height:1.7;">${signature}</p>
</td></tr>
<tr><td style="padding:0 24px 28px 24px;">
<p style="margin:0;color:${MUTED_COLOR};font-size:12px;line-height:1.6;">${escapeHtml(
    BUSINESS.tagline,
  )}</p>
<p style="margin:8px 0 0 0;color:${MUTED_COLOR};font-size:12px;line-height:1.6;">${escapeHtml(
    BUSINESS.businessName,
  )} — ${escapeHtml(BUSINESS.supportEmail)}</p>
<p style="margin:8px 0 0 0;color:${MUTED_COLOR};font-size:12px;line-height:1.6;">Cet email est lié à ton compte ou à une commande ${escapeHtml(
    BUSINESS.businessName,
  )}. Il ne constitue pas une facture.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    greeting.replace(/<[^>]+>/g, ''),
    bodyText,
    signature.replace(/<[^>]+>/g, ''),
    BUSINESS.tagline,
    `${BUSINESS.businessName} — ${BUSINESS.supportEmail}`,
  ]
    .filter((part) => part.trim().length > 0)
    .join('\n\n')
    .trim()

  return { html, text }
}

export function greeting(firstName: string): string {
  const name = escapeHtml(clamp(firstName, 60))
  return `Salut ${name},`
}

export function signature(): string {
  return escapeHtml(`L'équipe TAGGO`)
}

export function signatureShort(): string {
  return escapeHtml("L'équipe TAGGO.")
}