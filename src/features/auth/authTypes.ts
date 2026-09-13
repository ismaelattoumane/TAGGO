/**
 * Canonical TAGGO auth user (public session shape).
 * Never contains a password. Passwords only transit through
 * signIn/signUp arguments and must never be persisted in clear
 * outside the demo-only LocalAuthRepository (see SECURITY note there).
 */
export type AuthUser = {
  id: string
  email: string
  fullName: string
}

export type AuthSession = {
  user: AuthUser | null
}

export type SignUpInput = {
  email: string
  password: string
  fullName: string
}

export type AuthStateListener = (session: AuthSession) => void
