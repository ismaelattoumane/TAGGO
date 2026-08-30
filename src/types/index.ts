export type UserRole = 'user' | 'admin'

export type QrStatus = 'draft' | 'active' | 'inactive' | 'archived'

export type User = {
  id: string
  email: string
  fullName: string
  role: UserRole
  createdAt: string
}

export type QrCode = {
  id: string
  ownerId: string
  publicId: string
  status: QrStatus
  destinationUrl: string
  title: string
  description: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export type PublicProfile = {
  id: string
  qrCodeId: string
  displayName: string
  headline: string
  bio: string
  profileUrl: string
  createdAt: string
}

export type AuthSession = {
  user: User | null
  accessToken: string | null
}
