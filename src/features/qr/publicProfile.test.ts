import { describe, expect, it } from 'vitest'
import { buildPublicTaggoUrl } from '../../lib/publicUrl'
import { buildQrTargetUrl, generateQrSvg } from './qrCode'
import { toPublicTaggoProfile } from './publicProfile'

describe('public TAGGO profile', () => {
  it('maps only the visitor-facing QR fields', () => {
    const profile = toPublicTaggoProfile({
      id: 'private-id',
      publicId: 'TGG-8K9L2R7',
      title: 'Collection Print',
      destinationUrl: 'https://taggo.example/collection',
      status: 'active',
      ownerId: 'private-owner',
      createdAt: '2026-08-30T09:00:00.000Z',
    })

    expect(profile).toEqual({
      publicId: 'TGG-8K9L2R7',
      displayName: 'Collection Print',
      headline: null,
      bio: null,
      profileUrl: null,
      destinationUrl: 'https://taggo.example/collection',
    })
    expect(profile).not.toHaveProperty('id')
    expect(profile).not.toHaveProperty('ownerId')
  })

  it('builds the current-origin public URL', () => {
    expect(buildPublicTaggoUrl('TGG-ABC1234')).toBe('http://localhost:3000/t/TGG-ABC1234')
    expect(buildQrTargetUrl('TGG-ABC1234')).toContain('/t/TGG-ABC1234')
  })

  it('generates a real SVG QR document', async () => {
    const svg = await generateQrSvg('TGG-ABC1234')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('<path')
  })
})