import { createContext } from 'react'
import type { AuthMode, AuthUser } from '../features/auth/authTypes'
import type { TaggoProfile, UpdateTaggoProfileInput } from '../features/profile/profileTypes'

export type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  mode: AuthMode
  profile: TaggoProfile | null
  profileLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  requestEmailChange: (email: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  updateProfile: (input: UpdateTaggoProfileInput) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
