import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PasswordResetPage } from './PasswordResetPage'
import { PasswordUpdatePage } from './PasswordUpdatePage'
import { EmailConfirmationRequiredError } from '../features/auth/authErrors'
import type { AuthContextValue } from '../context/authContextValue'

/**
 * ÉTAPE 10.1 — Parcours front `/forgot-password` → `/reset-password`.
 *
 * Ces tests ne simulent PAS Supabase : ils vérifient que le front appelle le
 * repository, que les messages restent neutres (pas d'énumération de comptes)
 * et que les routes Auth restent atteignables.
 *
 * Le repository est la frontière testée ailleurs
 * (`SupabaseAuthRepository.test.ts`) : ici on vérifie l'interface.
 */

const GENERIC_RESET_MESSAGE =
  'Si un compte correspond à cette adresse, un email de réinitialisation vient d’être envoyé.'

function createAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    loading: false,
    mode: 'supabase',
    profile: null,
    profileLoading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    requestEmailChange: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    updateProfile: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  }
}

const authState: { value: AuthContextValue } = { value: createAuthValue() }

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState.value,
}))

function renderRoute(path: string, element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="/login" element={<h1>Connexion</h1>} />
        <Route path="/forgot-password" element={<h1>Mot de passe oublié</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Soumet le formulaire en court-circuitant la validation native du navigateur. */
function submitEmail(value: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value } })
  fireEvent.submit(screen.getByRole('button', { name: /Recevoir le lien/i }).closest('form') as HTMLFormElement)
}

const RECOVERY_USER = { id: 'u1', email: 'alex@example.com', fullName: 'Alex' }

beforeEach(() => {
  vi.clearAllMocks()
  authState.value = createAuthValue()
})

describe('/forgot-password', () => {
  it('appelle requestPasswordReset avec l’email saisi', async () => {
    renderRoute('/forgot-password', <PasswordResetPage />)

    submitEmail('alex@example.com')

    await waitFor(() => {
      expect(authState.value.requestPasswordReset).toHaveBeenCalledWith('alex@example.com')
    })
  })

  it('affiche le message générique après un envoi réussi', async () => {
    renderRoute('/forgot-password', <PasswordResetPage />)

    submitEmail('alex@example.com')

    expect(await screen.findByRole('status')).toHaveTextContent(GENERIC_RESET_MESSAGE)
  })

  it('affiche exactement le même message quand aucun compte ne correspond', async () => {
    // Le message ne dépend pas du résultat : impossible d'énumérer les comptes.
    renderRoute('/forgot-password', <PasswordResetPage />)

    submitEmail('inconnu@example.com')

    expect(await screen.findByRole('status')).toHaveTextContent(GENERIC_RESET_MESSAGE)
    expect(screen.queryByText(/n’existe pas|introuvable|compte inconnu/i)).not.toBeInTheDocument()
  })

  it('n’affiche pas de message d’erreur Supabase brut', async () => {
    authState.value = createAuthValue({
      requestPasswordReset: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('User not found: alex@example.com'), { code: 'user_not_found' }),
        ),
    })
    renderRoute('/forgot-password', <PasswordResetPage />)

    submitEmail('alex@example.com')

    expect(await screen.findByRole('status')).toHaveTextContent(GENERIC_RESET_MESSAGE)
    expect(screen.queryByText(/User not found/i)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('alex@example.com')
  })

  it('signale une adresse invalide sans appeler Supabase', async () => {
    renderRoute('/forgot-password', <PasswordResetPage />)

    submitEmail('pas-un-email')

    expect(await screen.findByRole('alert')).toHaveTextContent('Saisissez une adresse email valide.')
    expect(authState.value.requestPasswordReset).not.toHaveBeenCalled()
  })

  it('traduit un anti-abus sans révéler le compte visé', async () => {
    authState.value = createAuthValue({
      requestPasswordReset: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('rate limited for alex@example.com token=abc'), {
            code: 'over_request_rate_limit',
          }),
        ),
    })
    renderRoute('/forgot-password', <PasswordResetPage />)

    submitEmail('alex@example.com')

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(/Trop de demandes/)
    expect(status.textContent).not.toContain('abc')
    expect(status.textContent).not.toContain('alex@example.com')
  })

  it('désactive le bouton pendant l’envoi', async () => {
    authState.value = createAuthValue({
      requestPasswordReset: vi.fn().mockReturnValue(new Promise<void>(() => undefined)),
    })
    renderRoute('/forgot-password', <PasswordResetPage />)

    submitEmail('alex@example.com')

    expect(await screen.findByRole('button', { name: /Envoi/i })).toBeDisabled()
  })

  it('reste accessible et sans indexation', async () => {
    renderRoute('/forgot-password', <PasswordResetPage />)

    expect(await screen.findByRole('heading', { level: 1, name: /mot de passe oublié/i })).toBeInTheDocument()
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex, nofollow')
    expect(screen.getByRole('link', { name: 'Retour à la connexion' })).toHaveAttribute('href', '/login')
  })
})

describe('/reset-password', () => {
  function fillPasswords(password: string, confirmation: string) {
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: password } })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: confirmation } })
    fireEvent.submit(
      screen.getByRole('button', { name: /Enregistrer le mot de passe/i }).closest('form') as HTMLFormElement,
    )
  }

  function renderWithSession() {
    authState.value = createAuthValue({ user: RECOVERY_USER })
    return renderRoute('/reset-password', <PasswordUpdatePage />)
  }

  it('appelle updatePassword avec le nouveau mot de passe', async () => {
    renderWithSession()

    fillPasswords('NewStrong123!', 'NewStrong123!')

    await waitFor(() => {
      expect(authState.value.updatePassword).toHaveBeenCalledWith('NewStrong123!')
    })
  })

  it('redirige vers /login après un changement réussi', async () => {
    renderWithSession()

    fillPasswords('NewStrong123!', 'NewStrong123!')

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeInTheDocument()
  })

  it('refuse une confirmation différente sans appeler Supabase', async () => {
    renderWithSession()

    fillPasswords('NewStrong123!', 'OtherStrong123!')

    expect(await screen.findByRole('alert')).toHaveTextContent(/doivent correspondre/i)
    expect(authState.value.updatePassword).not.toHaveBeenCalled()
  })

  it('refuse un mot de passe trop faible sans appeler Supabase', async () => {
    renderWithSession()

    fillPasswords('short', 'short')

    expect(await screen.findByRole('alert')).toHaveTextContent(/règles de sécurité/i)
    expect(authState.value.updatePassword).not.toHaveBeenCalled()
  })

  it('affiche la règle réellement appliquée par le front', () => {
    renderWithSession()

    expect(screen.getByText(/Minimum 8 caractères, dont une majuscule et un chiffre/i)).toBeInTheDocument()
  })

  it('affiche un état exploitable quand le lien est expiré (session absente)', async () => {
    renderRoute('/reset-password', <PasswordUpdatePage />)

    expect(
      await screen.findByText(/Ce lien de réinitialisation est invalide ou a expiré/i),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Nouveau mot de passe')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Recevoir un nouveau lien' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('n’affiche ni formulaire ni erreur pendant le chargement de session', () => {
    authState.value = createAuthValue({ loading: true })
    renderRoute('/reset-password', <PasswordUpdatePage />)

    expect(screen.queryByLabelText('Nouveau mot de passe')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('accepte un utilisateur déjà connecté et l’informe', async () => {
    renderWithSession()

    expect(await screen.findByLabelText('Nouveau mot de passe')).toBeInTheDocument()
    expect(screen.getByText(/Tu es déjà connecté/i)).toBeInTheDocument()
  })

  it('traduit une erreur de mot de passe refusée par Supabase', async () => {
    authState.value = createAuthValue({
      user: RECOVERY_USER,
      updatePassword: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('New password should be different'), { code: 'same_password' })),
    })
    renderRoute('/reset-password', <PasswordUpdatePage />)

    fillPasswords('NewStrong123!', 'NewStrong123!')

    expect(await screen.findByRole('alert')).toHaveTextContent(/règles de sécurité/i)
    expect(screen.queryByText(/should be different/i)).not.toBeInTheDocument()
  })

  it('traduit un lien expiré remonté par updatePassword', async () => {
    authState.value = createAuthValue({
      user: RECOVERY_USER,
      updatePassword: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('Token has expired token=xyz'), { code: 'otp_expired' })),
    })
    renderRoute('/reset-password', <PasswordUpdatePage />)

    fillPasswords('NewStrong123!', 'NewStrong123!')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/invalide ou a expiré/i)
    expect(alert.textContent).not.toContain('xyz')
  })

  it('vide les champs après un échec', async () => {
    authState.value = createAuthValue({
      user: RECOVERY_USER,
      updatePassword: vi.fn().mockRejectedValue(new Error('boom')),
    })
    renderRoute('/reset-password', <PasswordUpdatePage />)

    fillPasswords('NewStrong123!', 'NewStrong123!')

    await screen.findByRole('alert')
    expect(screen.getByLabelText('Nouveau mot de passe')).toHaveValue('')
    expect(screen.getByLabelText('Confirmer le mot de passe')).toHaveValue('')
  })

  it('refuse d’afficher un formulaire quand Supabase Auth n’est pas configuré', () => {
    authState.value = createAuthValue({ mode: 'unavailable' })
    renderRoute('/reset-password', <PasswordUpdatePage />)

    expect(screen.getByText(/disponible avec Supabase Auth/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Nouveau mot de passe')).not.toBeInTheDocument()
  })

  it('reste accessible et sans indexation', async () => {
    renderWithSession()

    expect(await screen.findByRole('heading', { level: 1, name: /nouveau mot de passe/i })).toBeInTheDocument()
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex, nofollow')
    expect(screen.getByRole('link', { name: 'Retour à la connexion' })).toHaveAttribute('href', '/login')
  })
})

describe('confirmation d’email à l’inscription', () => {
  it('conserve le message d’attente de confirmation', () => {
    // L'attente de confirmation n'est pas un échec : le message ne doit pas
    // retomber sur le message générique d'inscription impossible.
    expect(new EmailConfirmationRequiredError().message).toBe(
      'Compte créé. Confirmez votre adresse email avant de vous connecter.',
    )
  })
})
