import { buildPublicId, isValidDestinationUrl, sanitizeText } from '../lib/validators'

export type QrRecord = {
  id: string
  publicId: string
  title: string
  destinationUrl: string
  status: 'draft' | 'active' | 'inactive' | 'archived'
  createdAt: string
}

export function createQrRecord(input: { title: string; destinationUrl: string }) {
  const title = sanitizeText(input.title).slice(0, 80)
  const destinationUrl = input.destinationUrl.trim()

  if (!title || !isValidDestinationUrl(destinationUrl)) {
    throw new Error('Titre ou destination QR invalide.')
  }

  return {
    id: crypto.randomUUID(),
    publicId: buildPublicId(),
    title,
    destinationUrl,
    status: 'draft' as const,
    createdAt: new Date().toISOString(),
  }
}

export function updateQrRecord(
  record: QrRecord,
  input: { title?: string; destinationUrl?: string; status?: QrRecord['status'] },
): QrRecord {
  const title = input.title ? sanitizeText(input.title).slice(0, 80) : record.title
  const destinationUrl = input.destinationUrl ? input.destinationUrl.trim() : record.destinationUrl

  if (!title || !isValidDestinationUrl(destinationUrl)) {
    throw new Error('Mise à jour QR invalide.')
  }

  return {
    ...record,
    title,
    destinationUrl,
    status: input.status ?? record.status,
  }
}
