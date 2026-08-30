import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import {
  getLocalAuthSession,
  localSignIn,
  localSignOut,
  localSignUp,
  seedDemoUsers,
} from '../lib/demoAuth'

type AuthUser = {
  id: string
  email: string
  fullName: string
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

let useSupabase = false

// Check if Supabase is available
try {
  const hasUrl = import.meta.env.VITE_SUPABASE_URL
  const hasKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  useSupabase = Boolean(hasUrl && hasKey)
} catch {
  useSupabase = false
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      try {
        if (useSupabase) {
          // Try Supabase first
          const { data } = await supabase.auth.getSession()

          if (data.session?.user) {
            setUser({
              id: data.session.user.id,
              email: data.session.user.email ?? '',
              fullName: data.session.user.user_metadata?.full_name ?? 'TAGGO User',
            })
          }
        } else {
          // Fallback to local storage
          seedDemoUsers()
          const localUser = getLocalAuthSession()
          if (localUser) {
            setUser(localUser)
          }
        }
      } catch (error) {
        console.warn('Auth restore failed:', error)
        // Fallback to local auth on error
        seedDemoUsers()
        const localUser = getLocalAuthSession()
        if (localUser) {
          setUser(localUser)
        }
      } finally {
        setLoading(false)
      }
    }

    restoreSession()

    if (useSupabase) {
      const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
            fullName: session.user.user_metadata?.full_name ?? 'TAGGO User',
          })
        } else {
          setUser(null)
        }
      })

      return () => subscription.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      if (useSupabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email ?? '',
            fullName: data.user.user_metadata?.full_name ?? 'TAGGO User',
          })
        }
      } else {
        const user = await localSignIn(email, password)
        setUser(user)
      }
    } catch (error) {
      console.error('Sign in failed:', error)
      // Try local auth as fallback
      try {
        const user = await localSignIn(email, password)
        setUser(user)
      } catch {
        throw error
      }
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      if (useSupabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (error) throw error
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email ?? '',
            fullName: data.user.user_metadata?.full_name ?? fullName,
          })
        }
      } else {
        const user = await localSignUp(email, password, fullName)
        setUser(user)
      }
    } catch (error) {
      console.error('Sign up failed:', error)
      // Try local auth as fallback
      try {
        const user = await localSignUp(email, password, fullName)
        setUser(user)
      } catch {
        throw error
      }
    }
  }

  const signOut = async () => {
    try {
      if (useSupabase) {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      }
    } catch (error) {
      console.warn('Supabase sign out failed:', error)
    } finally {
      localSignOut()
      setUser(null)
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading],
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
