import {
  clearLocalAuthSession,
  getLocalAuthSession,
  localSignIn,
  localSignOut,
  localSignUp,
  seedDemoUsers,
} from '../../lib/demoAuth'
import type { AuthRepository } from './AuthRepository'
import type { AuthSession, AuthStateListener, AuthUser, SignUpInput } from './authTypes'

/**
 * LocalStorage-backed AuthRepository (DEMO ONLY).
 *
 * SECURITY — DEMO ONLY, NOT PRODUCTION SAFE:
 * - demo passwords are stored in clear text in `taggo-demo-users`
 *   (see `src/lib/demoAuth.ts`);
 * - no hashing is applied on purpose: a home-made hash would give a
 *   false sense of security and must NOT be introduced;
 * - real account security comes later with Supabase Auth (server-side
 *   bcrypt/argon2, JWT sessions, RLS) in the dedicated auth step.
 *
 * Keeping the demo working while isolating every localStorage access
 * inside this repository (pages/components must never touch the keys).
 */
export class LocalAuthRepository implements AuthRepository {
  private listeners = new Set<AuthStateListener>()

  constructor() {
    seedDemoUsers()
  }

  private emit(session: AuthSession): void {
    for (const listener of this.listeners) {
      listener(session)
    }
  }

  getSession(): AuthSession {
    return { user: getLocalAuthSession() }
  }

  getCurrentUser(): AuthUser | null {
    return getLocalAuthSession()
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const user = await localSignIn(email.trim().toLowerCase(), password)
    this.emit({ user })
    return user
  }

  async signUp(input: SignUpInput): Promise<AuthUser> {
    const email = input.email.trim().toLowerCase()
    const user = await localSignUp(email, input.password, input.fullName)
    this.emit({ user })
    return user
  }

  signOut(): void {
    localSignOut()
    clearLocalAuthSession()
    this.emit({ user: null })
  }

  onAuthStateChange(listener: AuthStateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

/** Shared singleton. Swap with SupabaseAuthRepository later without touching callers. */
export const authRepository: AuthRepository = new LocalAuthRepository()
