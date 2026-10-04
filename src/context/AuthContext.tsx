import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { LocalAuthRepository } from '../features/auth/LocalAuthRepository'
import { SupabaseAuthRepository } from '../features/auth/SupabaseAuthRepository'
import type { AuthRepository } from '../features/auth/AuthRepository'
import { safeAuthErrorLabel } from '../features/auth/authErrors'
import type { AuthMode, AuthUser } from '../features/auth/authTypes'
import { AuthContext, type AuthContextValue } from './authContextValue'
import { isSupabaseConfigured } from '../lib/supabase'
import { profileRepository } from '../features/profile/repository'
import type { UpdateTaggoProfileInput, TaggoProfile } from '../features/profile/profileTypes'
const unavailableAuthRepository: AuthRepository = {
  getSession: () => ({ user: null }),
  getCurrentUser: () => null,
  signIn: async () => { throw new Error('Supabase doit être configuré pour la production.') },
  signUp: async () => { throw new Error('Supabase doit être configuré pour la production.') },
  requestEmailChange: async () => { throw new Error('Le changement d’adresse email nécessite Supabase Auth.') },
  requestPasswordReset: async () => { throw new Error('Supabase doit être configuré pour la récupération du mot de passe.') },
  updatePassword: async () => { throw new Error('Supabase doit être configuré pour la modification du mot de passe.') },
  signOut: async () => undefined,
  onAuthStateChange: () => () => undefined,
}

export const authMode: AuthMode = isSupabaseConfigured
  ? 'supabase'
  : import.meta.env.DEV
    ? 'demo'
    : 'unavailable'

const authRepository: AuthRepository = authMode === 'supabase'
  ? new SupabaseAuthRepository()
  : authMode === 'demo'
    ? new LocalAuthRepository()
    : unavailableAuthRepository

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<TaggoProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    let sessionInitialized = false
    let hasPendingSession = false
    let pendingSession: AuthUser | null = null

    const unsubscribe = authRepository.onAuthStateChange((session) => {
      if (sessionInitialized) {
        if (!cancelled) setUser(session.user)
        return
      }
      hasPendingSession = true
      pendingSession = session.user
    })

    const restoreSession = async () => {
      try {
        const session = await authRepository.getSession()
        if (!cancelled) setUser(hasPendingSession ? pendingSession : session.user)
      } catch (error) {
        // Seul un libellé technique non sensible est journalisé : ni l'objet
        // d'erreur ni son message, qui peut contenir un jeton ou un identifiant.
        console.warn(`Auth restore failed: ${safeAuthErrorLabel(error)}`)
        if (!cancelled) setUser(null)
      } finally {
        sessionInitialized = true
        if (!cancelled) setLoading(false)
      }
    }
    void restoreSession()
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      return () => {
        cancelled = true
      }
    }

    setProfileLoading(true)
    void Promise.resolve(profileRepository.getCurrentProfile())
      .then((currentProfile) => {
        if (!cancelled) setProfile(currentProfile)
      })
      .catch((error) => {
        console.warn(`Profile restore failed: ${safeAuthErrorLabel(error)}`)
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const signIn = useCallback(async (email: string, password: string) => {
    const authUser = await authRepository.signIn(email, password)
    setUser(authUser)
  }, [])

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const authUser = await authRepository.signUp({ email, password, fullName })
    setUser(authUser)
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    await authRepository.requestPasswordReset(email)
  }, [])

  const requestEmailChange = useCallback(async (email: string) => {
    await authRepository.requestEmailChange(email)
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    await authRepository.updatePassword(password)
  }, [])

  const updateProfile = useCallback(async (input: UpdateTaggoProfileInput) => {
    const updatedProfile = await profileRepository.updateCurrentProfile(input)
    if (!updatedProfile) throw new Error('Profil utilisateur introuvable.')
    setProfile(updatedProfile)
  }, [])

  const signOut = useCallback(async () => {
    await authRepository.signOut()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, mode: authMode, profile, profileLoading, signIn, signUp, requestEmailChange, requestPasswordReset, updatePassword, updateProfile, signOut }),
    [user, loading, profile, profileLoading, signIn, signUp, requestEmailChange, requestPasswordReset, updatePassword, updateProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
