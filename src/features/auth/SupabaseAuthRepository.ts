import { buildAuthRedirectUrl } from '../../lib/runtime'
import { supabase } from '../../lib/supabase'
import type { AuthRepository } from './AuthRepository'
import type { AuthSession, AuthStateListener, AuthUser, SignUpInput } from './authTypes'

function requireClient() {
  if (!supabase) throw new Error('La configuration Supabase est manquante.')
  return supabase
}

function toUser(user: { id: string; email?: string | null; user_metadata?: { full_name?: string } }): AuthUser {
  return {
    id: user.id,
    email: user.email ?? '',
    fullName: user.user_metadata?.full_name ?? '',
  }
}

export class SupabaseAuthRepository implements AuthRepository {
  async getSession(): Promise<AuthSession> {
    const { data, error } = await requireClient().auth.getSession()
    if (error) throw error
    return { user: data.session?.user ? toUser(data.session.user) : null }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const { data, error } = await requireClient().auth.getUser()
    if (error) return null
    return data.user ? toUser(data.user) : null
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await requireClient().auth.signInWithPassword({ email, password })
    if (error || !data.user) throw error ?? new Error('Connexion impossible.')
    return toUser(data.user)
  }

  async signUp({ email, password, fullName }: SignUpInput): Promise<AuthUser> {
    const { data, error } = await requireClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: buildAuthRedirectUrl('/login'),
      },
    })
    if (error || !data.user) throw error ?? new Error('Inscription impossible.')
    if (!data.session) {
      throw new Error('Compte créé. Confirmez votre adresse email avant de vous connecter.')
    }
    return toUser(data.user)
  }

  async signOut(): Promise<void> {
    const { error } = await requireClient().auth.signOut()
    if (error) throw error
  }

  onAuthStateChange(listener: AuthStateListener): () => void {
    const { data } = requireClient().auth.onAuthStateChange((_event, session) => {
      listener({ user: session?.user ? toUser(session.user) : null })
    })
    return () => data.subscription.unsubscribe()
  }
}