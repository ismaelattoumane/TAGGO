import { buildPublicId } from '../lib/validators'

export type QrDraft = {
  title: string
  destinationUrl: string
  isPublic: boolean
}

export function createQrDraft(input: QrDraft) {
  return {
    ...input,
    publicId: buildPublicId(),
    status: 'draft',
    createdAt: new Date().toISOString(),
  }
}
