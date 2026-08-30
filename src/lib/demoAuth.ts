/**
 * Local demo authentication storage
 * 
 * This module provides a fallback authentication mechanism when Supabase is not available.
 * It stores user sessions in localStorage and provides a simple sign-in/sign-up experience.
 * 
 * In production, this should be replaced with real Supabase authentication.
 */

export type LocalAuthUser = {
  id: string
  email: string
  fullName: string
}

const STORAGE_KEY = 'taggo-demo-auth'
const USERS_KEY = 'taggo-demo-users'

type StoredUser = LocalAuthUser & {
  password: string // Never send this over network in real app!
}

export function getLocalAuthSession(): LocalAuthUser | null {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as LocalAuthUser
  } catch {
    return null
  }
}

export function saveLocalAuthSession(user: LocalAuthUser) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export function clearLocalAuthSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

function getStoredUsers(): Map<string, StoredUser> {
  if (typeof window === 'undefined') return new Map()

  const raw = window.localStorage.getItem(USERS_KEY)
  if (!raw) return new Map()

  try {
    const data = JSON.parse(raw)
    return new Map(Object.entries(data) as [string, StoredUser][])
  } catch {
    return new Map()
  }
}

function saveStoredUsers(users: Map<string, StoredUser>) {
  if (typeof window === 'undefined') return
  const data = Object.fromEntries(users)
  window.localStorage.setItem(USERS_KEY, JSON.stringify(data))
}

export async function localSignUp(
  email: string,
  password: string,
  fullName: string
): Promise<LocalAuthUser> {
  const users = getStoredUsers()

  if (users.has(email)) {
    throw new Error('User already exists')
  }

  const id = `user-${Math.random().toString(36).slice(2, 11)}`
  const user: StoredUser = { id, email, fullName, password }

  users.set(email, user)
  saveStoredUsers(users)

  const sessionUser: LocalAuthUser = { id, email, fullName }
  saveLocalAuthSession(sessionUser)

  return sessionUser
}

export async function localSignIn(
  email: string,
  password: string
): Promise<LocalAuthUser> {
  const users = getStoredUsers()
  const stored = users.get(email)

  if (!stored || stored.password !== password) {
    throw new Error('Invalid email or password')
  }

  const sessionUser: LocalAuthUser = {
    id: stored.id,
    email: stored.email,
    fullName: stored.fullName,
  }
  saveLocalAuthSession(sessionUser)

  return sessionUser
}

export function localSignOut() {
  clearLocalAuthSession()
}

/**
 * Seed demo users for testing
 * These are pre-created accounts that can be used to test the app
 */
export function seedDemoUsers() {
  const users = getStoredUsers()

  if (users.size === 0) {
    const demoUsers = [
      {
        email: 'demo@taggo.local',
        password: 'DemoPass123!',
        fullName: 'Demo User',
      },
      {
        email: 'test@taggo.local',
        password: 'TestPass123!',
        fullName: 'Test Account',
      },
    ]

    demoUsers.forEach(({ email, password, fullName }) => {
      if (!users.has(email)) {
        const id = `user-${Math.random().toString(36).slice(2, 11)}`
        users.set(email, { id, email, fullName, password })
      }
    })

    saveStoredUsers(users)
  }
}
