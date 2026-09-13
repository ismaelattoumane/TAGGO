import { beforeEach, describe, expect, it } from 'vitest'
import { LocalQrRepository } from './LocalQrRepository'
import { buildTagCode, isValidTagCode, normalizeTagCode } from './tagCode'

describe('tagCode (canonical public TAG format)', () => {
  it('builds a canonical TGG-XXXXXXX code', () => {
    const code = buildTagCode()
    expect(isValidTagCode(code)).toBe(true)
  })

  it('generates unique public codes for a stock batch', () => {
    const codes = Array.from({ length: 100 }, () => buildTagCode())
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.every(isValidTagCode)).toBe(true)
  })

  it('validates and normalizes codes case-insensitively', () => {
    expect(isValidTagCode('TGG-ABCOEFG')).toBe(false)
    expect(isValidTagCode('TGG-8K9L2R7')).toBe(true)
    expect(normalizeTagCode('  tgg-8k9l2r7 ')).toBe('TGG-8K9L2R7')
  })

  it('rejects legacy 6-char codes and unsafe values', () => {
    expect(isValidTagCode('TGG-8K9L2R')).toBe(false)
    expect(isValidTagCode('javascript:alert(1)')).toBe(false)
    expect(isValidTagCode('')).toBe(false)
  })
})

describe('LocalQrRepository', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('creates records with canonical tag codes and default draft status', () => {
    const repo = new LocalQrRepository()
    const record = repo.create({
      title: 'Collection Test',
      destinationUrl: 'https://taggo.example/collection',
    })
    expect(isValidTagCode(record.publicId)).toBe(true)
    expect(record.status).toBe('draft')
  })

  it('resolves records by internal id and canonical public id', () => {
    const repo = new LocalQrRepository()
    const created = repo.create({
      title: 'Resolve me',
      destinationUrl: 'https://taggo.example/resolve',
    })
    expect(repo.getById(created.id)?.publicId).toBe(created.publicId)
    expect(repo.getByPublicId(created.publicId.toLowerCase())?.id).toBe(created.id)
  })

  it('exposes only a coarse public lifecycle state', () => {
    const repo = new LocalQrRepository()
    const created = repo.create({
      title: 'Not activated',
      destinationUrl: 'https://taggo.example/not-activated',
    })
    expect(repo.getPublicTaggoState(created.publicId)).toBe('unactivated')
    expect(repo.getPublicTaggoState('TGG-AAAAAAA')).toBe('not_found')
  })

  it('keeps legacy 6-char seed URLs working via alias', () => {
    const repo = new LocalQrRepository()
    expect(repo.getByPublicId('TGG-8K9L2R')?.publicId).toBe('TGG-8K9L2R7')
    expect(repo.getByPublicId('TGG-NZ7Q4M')?.publicId).toBe('TGG-NZ7Q4M2')
  })

  it('updates title, destination and status', () => {
    const repo = new LocalQrRepository()
    const created = repo.create({
      title: 'Old',
      destinationUrl: 'https://taggo.example/old',
    })
    const updated = repo.update(created.id, {
      title: 'New title',
      destinationUrl: 'https://taggo.example/new',
      status: 'active',
    })
    expect(updated?.title).toBe('New title')
    expect(updated?.status).toBe('active')
  })

  it('rejects invalid create/update payloads', () => {
    const repo = new LocalQrRepository()
    expect(() =>
      repo.create({ title: '  ', destinationUrl: 'https://taggo.example/ok' }),
    ).toThrow()
    expect(() =>
      repo.create({ title: 'Ok', destinationUrl: 'javascript:alert(1)' }),
    ).toThrow()
  })

  it('enforces owner scoping when an ownerId is set', () => {
    const repo = new LocalQrRepository()
    const created = repo.create({
      title: 'Owned',
      destinationUrl: 'https://taggo.example/owned',
      ownerId: 'user-1',
    })
    expect(repo.getById(created.id, 'user-2')).toBeNull()
    expect(repo.getById(created.id, 'user-1')?.id).toBe(created.id)
    expect(repo.remove(created.id, 'user-2')).toBe(false)
    expect(repo.remove(created.id, 'user-1')).toBe(true)
  })

  it('activates an assigned code once and preserves its owner', () => {
    const repo = new LocalQrRepository()
    const created = repo.create({
      title: 'Assigned',
      destinationUrl: 'https://taggo.example/assigned',
    })
    const stored = JSON.parse(window.localStorage.getItem('taggo-demo-qrs') ?? '[]') as Array<Record<string, unknown>>
    stored[stored.length - 1] = { ...stored[stored.length - 1], lifecycleStatus: 'assigned', ownerId: undefined }
    window.localStorage.setItem('taggo-demo-qrs', JSON.stringify(stored))

    const activated = repo.activate(created.publicId, 'customer-1')
    expect(activated?.ownerId).toBe('customer-1')
    expect(activated?.lifecycleStatus).toBe('active')
    expect(repo.activate(created.publicId, 'customer-2')).toBeNull()
  })

  it('saves a public profile without exposing private QR fields', () => {
    const repo = new LocalQrRepository()
    const created = repo.create({
      title: 'Profiled',
      destinationUrl: 'https://taggo.example/profiled',
      ownerId: 'user-1',
    })
    repo.savePublicProfile(created.id, {
      displayName: 'TAGGO Profile',
      headline: 'Une accroche',
      bio: 'Une bio',
      profileUrl: 'https://taggo.example/about',
    }, 'user-1')

    expect(repo.getPublicProfile(created.id, 'user-1')).toEqual({
      displayName: 'TAGGO Profile',
      headline: 'Une accroche',
      bio: 'Une bio',
      profileUrl: 'https://taggo.example/about',
    })
    expect(repo.getPublicProfile(created.id, 'user-2')).toBeNull()
  })
})
