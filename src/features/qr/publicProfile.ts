import type { QrRecord } from './qrTypes'

export type PublicProfileInput = {
  displayName: string
  headline: string
  bio: string
  profileUrl: string
}

export type PublicProfileRecord = PublicProfileInput

export type PublicTaggoProfile = {
  publicId: string
  displayName: string | null
  headline: string | null
  bio: string | null
  profileUrl: string | null
  destinationUrl: string
}

export function toPublicTaggoProfile(
  qr: QrRecord,
  publicProfile?: {
    displayName?: string | null
    headline?: string | null
    bio?: string | null
    profileUrl?: string | null
  } | null,
): PublicTaggoProfile {
  return {
    publicId: qr.publicId,
    displayName: publicProfile?.displayName || qr.title || null,
    headline: publicProfile?.headline || null,
    bio: publicProfile?.bio || null,
    profileUrl: publicProfile?.profileUrl || null,
    destinationUrl: qr.destinationUrl,
  }
}