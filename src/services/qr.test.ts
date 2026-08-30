import { describe, expect, it } from 'vitest'
import { createQrRecord, updateQrRecord } from './qr'

describe('qr service', () => {
  it('creates a QR record with a robust public id and valid status', () => {
    const record = createQrRecord({
      title: 'Collection Test',
      destinationUrl: 'https://taggo.example/collection',
    })

    expect(record.publicId).toMatch(/^[A-Z0-9]{10,}$/)
    expect(record.status).toBe('draft')
    expect(record.destinationUrl).toBe('https://taggo.example/collection')
  })

  it('updates a QR record without exposing private data', () => {
    const initial = createQrRecord({
      title: 'Old',
      destinationUrl: 'https://taggo.example/old',
    })

    const updated = updateQrRecord(initial, {
      title: 'New title',
      destinationUrl: 'https://taggo.example/new',
      status: 'active',
    })

    expect(updated.title).toBe('New title')
    expect(updated.destinationUrl).toBe('https://taggo.example/new')
    expect(updated.status).toBe('active')
  })
})
