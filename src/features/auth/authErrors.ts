/**
 * ÉTAPE 10.1 — Traduction sécurisée des erreurs Supabase Auth.
 *
 * RÈGLE ABSOLUE : le message brut d'une erreur Supabase n'est JAMAIS affiché
 * tel quel à l'utilisateur et n'est JAMAIS journalisé. Il peut contenir un
 * détail interne (jeton, identifiant de projet, charge utile de la requête).
 *
 * Seul un code d'erreur connu est traduit. Tout code inconnu retombe sur un
 * message générique qui ne dépend pas du compte visé : impossible d'en déduire
 * si une adresse email existe.
 */

/** Codes Supabase Auth documentés, renalisés en minuscules. */
const AUTH_ERROR_CODES = {
  /** Lien de récupération / confirmation expiré ou déjà utilisé. */
  otpExpired: 'otp_expired',
  /** Jeton de récupération absent ou session de récupération manquante. */
  sessionMissing: 'session_not_found',
  /** Anti-abus : trop d'emails d'authentification demandés. */
  rateLimited: 'over_request_rate_limit',
  /** Mot de passe rejeté par la politique de sécurité du projet. */
  weakPassword: 'weak_password',
  /** Mot de passe identique à l'ancien. */
  samePassword: 'same_password',
  /** Mot de passe trop court pour le projet. */
  passwordTooShort: 'password_too_short',
  /** Utilisateur / identifiants invalides (connexion). */
  invalidCredentials: 'invalid_credentials',
  /** Adresse déjà utilisée. */
  emailExists: 'user_already_exists',
} as const

function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) return ''

  const candidate = error as { code?: unknown; name?: unknown }
  const raw = typeof candidate.code === 'string' && candidate.code.trim().length > 0
    ? candidate.code
    : typeof candidate.name === 'string'
      ? candidate.name
      : ''

  return raw.toLowerCase()
}

/** `true` si l'erreur ressemble à un échec réseau (pas une réponse Supabase). */
export function isNetworkAuthError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name
    if (name === 'TypeError' || name === 'AbortError') return true
  }

  return false
}

/** Anti-abus : demande trop fréquente d'un email d'authentification. */
export function isAuthRateLimited(error: unknown): boolean {
  const code = errorCode(error)
  return code.includes(AUTH_ERROR_CODES.rateLimited) || code.includes('rate_limit')
}

/** Lien expiré, invalide, déjà consommé, ou session de récupération absente. */
export function isAuthLinkInvalid(error: unknown): boolean {
  const code = errorCode(error)
  return code.includes(AUTH_ERROR_CODES.otpExpired) || code.includes(AUTH_ERROR_CODES.sessionMissing)
}

/** Mot de passe refusé par la politique du projet. */
export function isWeakAuthPassword(error: unknown): boolean {
  const code = errorCode(error)
  return (
    code.includes(AUTH_ERROR_CODES.weakPassword) ||
    code.includes(AUTH_ERROR_CODES.samePassword) ||
    code.includes(AUTH_ERROR_CODES.passwordTooShort)
  )
}

/**
 * Message affiché après une demande de réinitialisation.
 *
 * Le même texte est renvoyé que la demande ait réussi ou échoué : un attaquant
 * ne peut pas distinguer « compte inexistant » de « email envoyé ».
 * Seuls les échecs techniques indépendants du compte (anti-abus, réseau)
 * reçoivent un message distinct.
 */
export function passwordResetRequestMessage(error: unknown): string {
  if (isAuthRateLimited(error)) {
    return 'Trop de demandes envoyées. Patientez quelques instants avant de réessayer.'
  }

  if (isNetworkAuthError(error)) {
    return 'Connexion impossible. Vérifie ta connexion internet et réessaie.'
  }

  return 'Si un compte correspond à cette adresse, un email de réinitialisation vient d’être envoyé.'
}

/** Message affiché après l'enregistrement du nouveau mot de passe. */
export function passwordUpdateErrorMessage(error: unknown): string {
  if (isAuthLinkInvalid(error)) {
    return 'Ce lien est invalide ou a expiré. Demande un nouveau lien de réinitialisation.'
  }

  if (isWeakAuthPassword(error)) {
    return 'Ce mot de passe ne respecte pas les règles de sécurité de TAGGO.'
  }

  if (isAuthRateLimited(error)) {
    return 'Trop de tentatives. Patientez quelques instants avant de réessayer.'
  }

  if (isNetworkAuthError(error)) {
    return 'Connexion impossible. Vérifie ta connexion internet et réessaie.'
  }

  return 'Impossible d’enregistrer le nouveau mot de passe. Réessaie dans un instant.'
}

/**
 * ÉTAPE 10.1 — Confirmation d'email demandée à l'inscription.
 *
 * `signUp()` ne retourne pas de session quand Supabase exige la confirmation
 * de l'adresse. Ce n'est pas une erreur : le compte EST créé et l'email de
 * confirmation part. L'erreur est donc traitée à part pour que son message ne
 * soit jamais remplacé par un message générique d'échec.
 */
export class EmailConfirmationRequiredError extends Error {
  constructor(message = 'Compte créé. Confirmez votre adresse email avant de vous connecter.') {
    super(message)
    this.name = 'EmailConfirmationRequiredError'
  }
}

/** Message générique pour une inscription refusée. */
export function signUpErrorMessage(error: unknown): string {
  if (error instanceof EmailConfirmationRequiredError) {
    return error.message
  }

  if (isWeakAuthPassword(error)) {
    return 'Ce mot de passe ne respecte pas les règles de sécurité de TAGGO.'
  }

  if (isAuthRateLimited(error)) {
    return 'Trop de tentatives. Patientez quelques instants avant de réessayer.'
  }

  if (isNetworkAuthError(error)) {
    return 'Connexion impossible. Vérifie ta connexion internet et réessaie.'
  }

  return 'Inscription impossible. Réessaie dans un instant.'
}

/** Message générique pour une connexion refusée (jamais « compte inconnu »). */
export function signInErrorMessage(error: unknown): string {
  if (isAuthRateLimited(error)) {
    return 'Trop de tentatives. Patientez quelques instants avant de réessayer.'
  }

  if (isNetworkAuthError(error)) {
    return 'Connexion impossible. Vérifie ta connexion internet et réessaie.'
  }

  return 'Email ou mot de passe incorrect.'
}

/**
 * Trace d'erreur SÛRE pour la console du navigateur.
 *
 * Ne renvoie ni le message, ni la charge utile, ni le jeton : uniquement le
 * nom technique de l'erreur. UnSupabase `AuthError` peut embarquer un détail
 * interne dans `message` ; il n'est jamais journalisé.
 */
export function safeAuthErrorLabel(error: unknown): string {
  const code = errorCode(error)
  return code.length > 0 ? code : 'auth_error_unknown'
}
