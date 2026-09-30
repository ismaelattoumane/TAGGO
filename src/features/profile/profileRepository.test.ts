import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_USER_IDS, saveLocalAuthSession } from '../../lib/demoAuth'
import { LocalProfileRepository } from './LocalProfileRepository'

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth,
  },
}))

describe('LocalProfileRepository', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('keeps the demo profile tied to the canonical demo identity', () => {
    saveLocalAuthSession({ id: DEMO_USER_IDS.demo, email: 'demo@taggo.local', fullName: 'Demo User' })
    const repository = new LocalProfileRepository()

    expect(repository.getCurrentProfile()).toMatchObject({
      id: DEMO_USER_IDS.demo,
      email: 'demo@taggo.local',
      firstName: 'Demo',
      lastName: 'User',
      displayName: 'Demo User',
    })
  })

  it('updates only the current demo profile', () => {
    saveLocalAuthSession({ id: DEMO_USER_IDS.demo, email: 'demo@taggo.local', fullName: 'Demo User' })
    const repository = new LocalProfileRepository()
    const updated = repository.updateCurrentProfile({
      firstName: 'Démonstration',
      lastName: 'Utilisateur',
      displayName: 'Demo TAGGO',
    })

    expect(updated?.id).toBe(DEMO_USER_IDS.demo)
    expect(repository.getCurrentProfile()?.displayName).toBe('Demo TAGGO')
  })
})

describe('Supabase profile identity contract', () => {
  it('derives the profile id from auth.getUser instead of accepting a user id', async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1', email: 'user@example.com', user_metadata: { full_name: 'Auth User' } } },
      error: null,
    })
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: {
              id: 'auth-user-1',
              email: 'user@example.com',
              first_name: null,
              last_name: null,
              display_name: 'Auth User',
              full_name: 'Auth User',
              created_at: null,
              updated_at: null,
            },
            error: null,
          }),
        }),
      }),
    }))
    vi.doMock('../../lib/supabase', () => ({ supabase: { auth, from } }))
    const { SupabaseProfileRepository } = await import('./SupabaseProfileRepository')
    const repository = new SupabaseProfileRepository()

    await expect(repository.getCurrentProfile()).resolves.toMatchObject({
      id: 'auth-user-1',
      email: 'user@example.com',
    })
    expect(from).toHaveBeenCalledWith('profiles')
    expect(auth.getUser).toHaveBeenCalledTimes(1)
  })
})
