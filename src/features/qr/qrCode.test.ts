import { describe, expect, it } from 'vitest'
import { generateQrPng } from './qrCode'

describe('QR generation', () => {
  it('generates a PNG data URL', async () => {
    await expect(generateQrPng('TGG-ABC1234')).resolves.toMatch(/^data:image\/png;base64,/)
  })
})