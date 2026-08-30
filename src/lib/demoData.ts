export type DemoQr = {
  id: string
  publicId: string
  title: string
  destinationUrl: string
  status: 'draft' | 'active' | 'inactive' | 'archived'
  createdAt: string
}

const STORAGE_KEY = 'taggo-demo-qrs'

const seedQrs: DemoQr[] = [
  {
    id: 'QRT-7812',
    publicId: 'TGG-8K9L2R',
    title: 'Collection Print',
    destinationUrl: 'https://taggo.example/shop/collection-print',
    status: 'active',
    createdAt: '2026-08-30T09:00:00.000Z',
  },
  {
    id: 'QRT-2134',
    publicId: 'TGG-NZ7Q4M',
    title: 'Limited Capsule',
    destinationUrl: 'https://taggo.example/capsule',
    status: 'draft',
    createdAt: '2026-08-29T09:00:00.000Z',
  },
]

export function getDemoQrs(): DemoQr[] {
  if (typeof window === 'undefined') return seedQrs

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedQrs))
    return seedQrs
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : seedQrs
  } catch {
    return seedQrs
  }
}

export function saveDemoQrs(qrs: DemoQr[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(qrs))
}

export function getDemoQrById(id: string) {
  return getDemoQrs().find((qr) => qr.id === id)
}

export function getDemoQrByPublicId(publicId: string) {
  return getDemoQrs().find((qr) => qr.publicId === publicId)
}

export function updateDemoQr(id: string, updates: Partial<Omit<DemoQr, 'id' | 'publicId' | 'createdAt'>>) {
  const qrs = getDemoQrs()
  const index = qrs.findIndex((qr) => qr.id === id)
  if (index === -1) return null

  const updated = { ...qrs[index], ...updates }
  qrs[index] = updated
  saveDemoQrs(qrs)
  return updated
}

export function createDemoQr(title: string, destinationUrl: string): DemoQr {
  const qrs = getDemoQrs()
  const id = `QRT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const publicId = generatePublicId()

  const newQr: DemoQr = {
    id,
    publicId,
    title,
    destinationUrl,
    status: 'draft',
    createdAt: new Date().toISOString(),
  }

  qrs.push(newQr)
  saveDemoQrs(qrs)
  return newQr
}

export function deleteDemoQr(id: string): boolean {
  const qrs = getDemoQrs()
  const index = qrs.findIndex((qr) => qr.id === id)
  if (index === -1) return false

  qrs.splice(index, 1)
  saveDemoQrs(qrs)
  return true
}

function generatePublicId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = 'TGG-'
  for (let i = 0; i < 7; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}
