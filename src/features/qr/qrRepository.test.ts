import { beforeEach, describe, expect, it } from 'vitest'
import { LocalQrRepository } from './LocalQrRepository'
import { buildTagCode, isValidTagCode, normalizeTagCode } from './tagCode'

describe('tagCode (canonical public TAG format)', () => {
  it('builds a canonical TGG-XXXXXXX code', () => {
    const code = buildTagCode()
    expect(isValidTagCode(code)).toBe(true)
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
})
