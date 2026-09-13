import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authRepository } from '../features/auth/LocalAuthRepository'
import type { AuthUser } from '../features/auth/authTypes'

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const restoreSession = async () => {
      try {
        const session = await authRepository.getSession()
        if (!cancelled) setUser(session.user)
      } catch (error) {
        console.warn('Auth restore failed:', error)
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void restoreSession()
    const unsubscribe = authRepository.onAuthStateChange((session) => {
      if (!cancelled) setUser(session.user)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const authUser = await authRepository.signIn(email, password)
    setUser(authUser)
  }, [])

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const authUser = await authRepository.signUp({ email, password, fullName })
    setUser(authUser)
  }, [])

  const signOut = useCallback(async () => {
    await authRepository.signOut()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut],
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

