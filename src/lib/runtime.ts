/**
 * ÉTAPE 10.1 — Origine et redirections de l'authentification.
 *
 * Deux protections distinctes :
 *
 * 1. `buildAuthRedirectUrl` ne reçoit QUE des chemins internes issus d'une
 *    liste blanche (`AUTH_REDIRECT_PATHS`). Une origine, un domaine ou une URL
 *    fournie par l'utilisateur ne peut donc pas devenir une redirection Auth.
 * 2. `getSafeAuthDestination` filtre le paramètre `returnTo` utilisé par les
 *    pages `/login` et `/register` (protection de l'étape 4, conservée).
 */

/**
 * Chemins de redirection autorisés pour les emails Supabase Auth.
 *
 * `/reset-password` est la cible de `resetPasswordForEmail()` : c'est la page
 * qui appelle `updateUser()`. `/login` est la cible de la confirmation
 * d'inscription.
 */
export const AUTH_REDIRECT_PATHS = ['/login', '/reset-password', '/settings'] as const

export type AuthRedirectPath = (typeof AUTH_REDIRECT_PATHS)[number]

export function isAuthRedirectPath(value: string): value is AuthRedirectPath {
  return (AUTH_REDIRECT_PATHS as readonly string[]).includes(value)
}

export function getOriginForAuth(baseOrigin?: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return (baseOrigin ?? 'https://taggo-omega.vercel.app').replace(/\/+$/, '')
}

export function buildAuthRedirectUrl(pathname: string, baseOrigin?: string): string {
  if (!isAuthRedirectPath(pathname)) {
    throw new Error('Redirection Auth refusée : chemin non autorisé.')
  }

  return `${getOriginForAuth(baseOrigin)}${pathname}`
}

export function getSafeAuthDestination(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard'

  const pathname = value.split('?')[0].split('#')[0]
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname.startsWith('/activate/')) {
    return value
  }

  return '/dashboard'
}
