/**
 * ÉTAPE 10 — Échappement et validation des données d'email.
 *
 * Toute donnée dynamique injectée dans un email passe par `escapeHtml`.
 * Aucune donnée utilisateur n'est concaténée telle quelle dans du HTML.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Échappe les caractères HTML sensibles d'une valeur dynamique. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character])
}

/** Échappe une valeur destinée à un attribut HTML (par défaut, double quotes). */
export function escapeAttribute(value: string): string {
  return escapeHtml(value)
}

/**
 * Normalise une valeur : espaces resserrés, longueur bornée.
 * Les données d'email ne sont jamais tronquées silencieusement à moins que la
 * limite soit explicitement fournie par l'appelant.
 */
export function clamp(value: string, maxLength: number): string {
  const trimmed = value.trim()
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength)
}

/**
 * Valide une URL destinée à un lien d'email.
 * Seuls les schémas `http:` et `https:` absolus sont acceptés : ni `javascript:`,
 * ni `data:`, ni URL relative, ni injection par retour à la ligne.
 */
export function isSafeAbsoluteUrl(value: string): boolean {
  const candidate = clamp(value, 2048)

  if (candidate.length === 0 || /[\r\n\t]/.test(candidate)) return false

  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Retourne l'URL si elle est sûre, `null` sinon.
 * Un lien invalide est OMIS de l'email plutôt que d'être rendu tel quel.
 */
export function safeUrl(value: string | null): string | null {
  if (!value) return null
  return isSafeAbsoluteUrl(value) ? clamp(value, 2048) : null
}

/** Constructeur de lien : renvoie le HTML complet ou `null` si l'URL est refusée. */
export function safeLink(url: string | null, label: string): string | null {
  const href = safeUrl(url)
  if (!href) return null

  return `<a href="${escapeAttribute(href)}" style="color:#6F2DA8;font-weight:700;">${escapeHtml(
    clamp(label, 120),
  )}</a>`
}

/** Nettoie un texte pour la version texte brut (pas d'échappement nécessaire). */
export function plainText(value: string): string {
  return value.replace(/\r\n/g, '\n').trim()
}