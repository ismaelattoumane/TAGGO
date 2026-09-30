import type { TaggoProfile, UpdateTaggoProfileInput } from './profileTypes'

export interface ProfileRepository {
  getCurrentProfile(): Promise<TaggoProfile | null> | TaggoProfile | null
  updateCurrentProfile(input: UpdateTaggoProfileInput): Promise<TaggoProfile | null> | TaggoProfile | null
}