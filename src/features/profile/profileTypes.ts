export type TaggoProfile = {
  id: string
  firstName: string
  lastName: string
  displayName: string
  email: string
  createdAt?: string
  updatedAt?: string
}

export type UpdateTaggoProfileInput = {
  firstName: string
  lastName: string
  displayName: string
}