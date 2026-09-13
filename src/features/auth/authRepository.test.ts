import { beforeEach, describe, expect, it } from 'vitest'
import { LocalAuthRepository } from './LocalAuthRepository'

describe('LocalAuthRepository', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('seeds demo users and signs in with demo credentials', async () => {
    const repo = new LocalAuthRepository()
    const user = await repo.signIn('demo@taggo.local', 'DemoPass123!')
    expect(user.email).toBe('demo@taggo.local')
    expect(repo.getCurrentUser()?.email).toBe('demo@taggo.local')
    expect(repo.getSession().user?.email).toBe('demo@taggo.local')
  })

  it('rejects invalid credentials', async () => {
    const repo = new LocalAuthRepository()
    await expect(repo.signIn('demo@taggo.local', 'wrong-password')).rejects.toThrow()
  })

  it('registers a new user then signs out', async () => {
    const repo = new LocalAuthRepository()
    const user = await repo.signUp({
      email: 'new@taggo.local',
      password: 'StrongPass123!',
      fullName: 'New User',
    })
    expect(user.email).toBe('new@taggo.local')
    expect(repo.getCurrentUser()?.id).toBe(user.id)
    await repo.signOut()
    expect(repo.getCurrentUser()).toBeNull()
  })

  it('rejects duplicate registration', async () => {
    const repo = new LocalAuthRepository()
    await repo.signUp({
      email: 'dup@taggo.local',
      password: 'StrongPass123!',
      fullName: 'Dup',
    })
    await expect(
      repo.signUp({ email: 'dup@taggo.local', password: 'StrongPass123!', fullName: 'Dup' }),
    ).rejects.toThrow()
  })

  it('notifies auth state listeners and supports unsubscribe', async () => {
    const repo = new LocalAuthRepository()
    const events: Array<string | null> = []
    const unsubscribe = repo.onAuthStateChange((session) => {
      events.push(session.user?.email ?? null)
    })
    await repo.signIn('test@taggo.local', 'TestPass123!')
    await repo.signOut()
    unsubscribe()
    await repo.signIn('demo@taggo.local', 'DemoPass123!')
    expect(events).toEqual(['test@taggo.local', null])
  })
})
