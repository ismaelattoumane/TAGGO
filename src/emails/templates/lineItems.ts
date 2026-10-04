import { escapeHtml, clamp } from '../escape'
import type { EmailOrderLine } from '../emailTypes'

/** Brouillon d'email avant assemblage (type, destinataire). */
export type EmailDraft = {
  subject: string
  preheader: string
  html: string
  text: string
}

/**
 * Ligne de commande pour un email. Le montant provient du serveur : il n'est
 * jamais recalculé ni formaté dans un template.
 */
export type OrderLineDraft = EmailOrderLine

function lineLabel(line: OrderLineDraft): string {
  const variant = line.variant ? ` — ${clamp(line.variant, 80)}` : ''
  return `${clamp(line.name, 120)}${variant} × ${line.quantity}`
}

export function orderLinesHtml(lines: OrderLineDraft[]): string {
  if (lines.length === 0) return ''

  return lines
    .map(
      (line) =>
        `<li style="margin:0 0 8px 0;color:#2B2D42;font-size:15px;line-height:1.6;">${escapeHtml(
          lineLabel(line),
        )} : ${escapeHtml(clamp(line.lineTotalFormatted, 40))}</li>`,
    )
    .join('')
}

export function orderLinesText(lines: OrderLineDraft[]): string {
  return lines
    .map((line) => `- ${lineLabel(line)} : ${clamp(line.lineTotalFormatted, 40)}`)
    .join('\n')
}