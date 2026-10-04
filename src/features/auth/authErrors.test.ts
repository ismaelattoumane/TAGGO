import { describe, expect, it } from 'vitest'
import {
  EmailConfirmationRequiredError,
  isAuthLinkInvalid,
  isAuthRateLimited,
  isWeakAuthPassword,
  passwordResetRequestMessage,
  passwordUpdateErrorMessage,
  safeAuthErrorLabel,
  signInErrorMessage,
  signUpErrorMessage,
} from './authErrors'

/**
 * ÉTAPE 10.1 — Sécurité des messages d'erreur Auth.
 *
 * Invariant central : AUCUN message ne dépend de l'existence d'un compte, et
 * AUCUNE erreur brute de Supabase n'est réémise telle quelle (elle pourrait
 * contenir un jeton ou un identifiant interne).
 */

function authError(code: string, message = 'boom'): Error & { code: string } {
  return Object.assign(new Error(message), { code })
}

describe('messages de demande de réinitialisation', () => {
  it('renvoie le même message succès et échec, sans révéler le compte', () => {
    const success = passwordResetRequestMessage(null)
    const unknownFailure = passwordResetRequestMessage(authError('some_internal_code'))

    expect(success).toBe('Si un compte correspond à cette adresse, un email de réinitialisation vient d’être envoyé.')
    expect(unknownFailure).toBe(success)
  })

  it('distingue uniquement les échecs techniques indépendants du compte', () => {
    expect(passwordResetRequestMessage(authError('over_request_rate_limit'))).toMatch(/Trop de demandes/)
    expect(passwordResetRequestMessage(new TypeError('Failed to fetch'))).toMatch(/Connexion impossible/)
  })

  it('ne laisse fuir aucun message brut de Supabase', () => {
    const leaky = authError('internal', 'token=abc123 user_id=uuid project_ref=xyz')
    const rendered = [
      passwordResetRequestMessage(leaky),
      passwordUpdateErrorMessage(leaky),
      signInErrorMessage(leaky),
      signUpErrorMessage(leaky),
      safeAuthErrorLabel(leaky),
    ].join(' ')

    expect(rendered).not.toContain('abc123')
    expect(rendered).not.toContain('uuid')
    expect(rendered).not.toContain('project_ref')
    // Seul le libellé technique non sensible est réutilisé.
    expect(safeAuthErrorLabel(leaky)).toBe('internal')
  })
})

describe("messages de mise à jour du mot de passe", () => {
  it('oriente vers une nouvelle demande quand le lien a expiré', () => {
    expect(passwordUpdateErrorMessage(authError('otp_expired'))).toMatch(/invalide ou a expiré/i)
    expect(passwordUpdateErrorMessage(authError('session_not_found'))).toMatch(/invalide ou a expiré/i)
  })

  it('signale un mot de passe refusé sans afficher la règle technique', () => {
    const message = passwordUpdateErrorMessage(authError('weak_password', 'Password should be at least 6 characters'))
    expect(message).toMatch(/règles de sécurité/i)
    expect(message).not.toContain('6 characters')
  })

  it('retombe sur un message générique pour une erreur inconnue', () => {
    expect(passwordUpdateErrorMessage(authError('whatever'))).toMatch(/Impossible d’enregistrer/i)
    expect(passwordUpdateErrorMessage(undefined)).toMatch(/Impossible d’enregistrer/i)
  })
})

describe("messages d'inscription et de connexion", () => {
  it('conserve le message de confirmation d’email', () => {
    const error = new EmailConfirmationRequiredError()
    expect(signUpErrorMessage(error)).toBe(
      'Compte créé. Confirmez votre adresse email avant de vous connecter.',
    )
  })

  it('ne distingue pas compte inconnu et mot de passe erroné', () => {
    const unknownUser = signInErrorMessage(authError('invalid_credentials'))
    const wrongPassword = signInErrorMessage(authError('Invalid login credentials'))
    expect(unknownUser).toBe(wrongPassword)
    expect(unknownUser).not.toMatch(/n’existe|introuvable|inconnu|not found/i)
  })
})

describe('détection des codes Auth', () => {
  it('reconnaît les codes documentés, quelle que soit leur casse', () => {
    expect(isAuthRateLimited(authError('OVER_REQUEST_RATE_LIMIT'))).toBe(true)
    expect(isAuthLinkInvalid(authError('OTP_EXPIRED'))).toBe(true)
    expect(isWeakAuthPassword(authError('weak_password'))).toBe(true)
    expect(isWeakAuthPassword(authError('same_password'))).toBe(true)
  })

  it('ne confond pas un code inconnu avec un code connu', () => {
    expect(isAuthRateLimited(authError('unrelated'))).toBe(false)
    expect(isAuthLinkInvalid(authError('unrelated'))).toBe(false)
    expect(isWeakAuthPassword(null)).toBe(false)
    expect(isWeakAuthPassword('not an object')).toBe(false)
  })

  it('étiquette une erreur sans exposer son message', () => {
    expect(safeAuthErrorLabel(authError('otp_expired', 'secret detail'))).toBe('otp_expired')
    expect(safeAuthErrorLabel(new Error('boom'))).toBe('error')
    expect(safeAuthErrorLabel(null)).toBe('auth_error_unknown')
  })
})
