import type { AuthSession, AuthUser, SignUpInput } from './authTypes'

/**
 * Storage abstraction for TAGGO authentication.
 *
 * UI pages and AuthContext must depend on this interface only.
 * Current implementation: LocalStorage demo (`LocalAuthRepository`).
 * Future implementation: Supabase Auth (`SupabaseAuthRepository`).
 */
export interface AuthRepository {
  getSession(): Promise<AuthSession> | AuthSession
  getCurrentUser(): Promise<AuthUser | null> | AuthUser | null
  signIn(email: string, password: string): Promise<AuthUser>
  signUp(input: SignUpInput): Promise<AuthUser>
  signOut(): Promise<void> | void
  /** Subscribe to session changes. Returns an unsubscribe function. */
  onAuthStateChange(listener: (session: AuthSession) => void): () => void
}
