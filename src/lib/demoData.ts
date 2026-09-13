import { LocalQrRepository } from '../features/qr/LocalQrRepository'
import type { QrRecord } from '../features/qr/qrTypes'

/**
 * @deprecated Use `qrRepository` from `src/features/qr/LocalQrRepository`.
 * Compatibility facade kept so no existing import breaks during migration.
 */

export type DemoQr = {
  id: string
  publicId: string
  title: string
  destinationUrl: string
  status: QrRecord['status']
  createdAt: string
}

const compatRepo = new LocalQrRepository()

function toDemoQr(qr: QrRecord): DemoQr {
  return {
    id: qr.id,
    publicId: qr.publicId,
    title: qr.title,
    destinationUrl: qr.destinationUrl,
    status: qr.status,
    createdAt: qr.createdAt,
  }
}

export function getDemoQrs(): DemoQr[] {
  return compatRepo.list().map(toDemoQr)
}

export function saveDemoQrs(_qrs: DemoQr[]): void {
  // No-op: storage is owned by LocalQrRepository (`taggo-demo-qrs`).
}

export function getDemoQrById(id: string): DemoQr | undefined {
  const qr = compatRepo.getById(id)
  return qr ? toDemoQr(qr) : undefined
}

export function getDemoQrByPublicId(publicId: string): DemoQr | undefined {
  const qr = compatRepo.getByPublicId(publicId)
  return qr ? toDemoQr(qr) : undefined
}

export function updateDemoQr(
  id: string,
  updates: Partial<Omit<DemoQr, 'id' | 'publicId' | 'createdAt'>>,
): DemoQr | null {
  const qr = compatRepo.update(id, updates)
  return qr ? toDemoQr(qr) : null
}

export function createDemoQr(title: string, destinationUrl: string): DemoQr {
  return toDemoQr(compatRepo.create({ title, destinationUrl }))
}

export function deleteDemoQr(id: string): boolean {
  return compatRepo.remove(id)
}
