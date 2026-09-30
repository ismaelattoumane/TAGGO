import { getLocalAuthSession } from '../../lib/demoAuth'
import type { ProfileRepository } from './ProfileRepository'
import type { TaggoProfile, UpdateTaggoProfileInput } from './profileTypes'

const STORAGE_KEY = 'taggo-demo-profile'

export class LocalProfileRepository implements ProfileRepository {
  getCurrentProfile(): TaggoProfile | null {
    const user = getLocalAuthSession()
    if (!user) return null

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      const profile = stored ? JSON.parse(stored) as TaggoProfile : null
      if (profile?.id === user.id) return { ...profile, email: user.email }
    } catch {
      // Fall back to the authenticated demo identity.
    }

    const [firstName = '', ...lastNameParts] = user.fullName.trim().split(/\s+/)
    return {
      id: user.id,
      firstName,
      lastName: lastNameParts.join(' '),
      displayName: user.fullName,
      email: user.email,
    }
  }

  updateCurrentProfile(input: UpdateTaggoProfileInput): TaggoProfile | null {
    const current = this.getCurrentProfile()
    if (!current) return null
    const profile = { ...current, ...input }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    return profile
  }
}