import { beforeEach, describe, expect, it, vi } from 'vitest'

const { auth } = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth },
}))

describe('SupabaseAuthRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it('signs in through Supabase Auth without persisting a password', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com', user_metadata: { full_name: 'User' } } },
      error: null,
    })
    const { SupabaseAuthRepository } = await import('./SupabaseAuthRepository')
    const repository = new SupabaseAuthRepository()

    await expect(repository.signIn('user@example.com', 'StrongPass123!')).resolves.toEqual({
      id: 'user-1',
      email: 'user@example.com',
      fullName: 'User',
    })
    expect(window.localStorage.length).toBe(0)
  })

  it('creates a Supabase account and reports email confirmation when no session exists', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'user-2', email: 'new@example.com', user_metadata: { full_name: 'New User' } }, session: null },
      error: null,
    })
    const { SupabaseAuthRepository } = await import('./SupabaseAuthRepository')
    const repository = new SupabaseAuthRepository()

    await expect(repository.signUp({
      email: 'new@example.com',
      password: 'StrongPass123!',
      fullName: 'New User',
    })).rejects.toThrow('Confirmez votre adresse email')
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new@example.com',
      options: expect.objectContaining({ data: { full_name: 'New User' } }),
    }))
  })

  it('requests and applies a password reset through Supabase Auth', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    auth.updateUser.mockResolvedValue({ error: null })
    const { SupabaseAuthRepository } = await import('./SupabaseAuthRepository')
    const repository = new SupabaseAuthRepository()

    await repository.requestPasswordReset('user@example.com')
    await repository.updatePassword('NewStrongPass123!')

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') }),
    )
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'NewStrongPass123!' })
  })

  it('restores a session and forwards auth state changes', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-3', email: 'session@example.com', user_metadata: {} } } },
      error: null,
    })
    const { SupabaseAuthRepository } = await import('./SupabaseAuthRepository')
    const repository = new SupabaseAuthRepository()
    const listener = vi.fn()

    await expect(repository.getSession()).resolves.toEqual({
      user: { id: 'user-3', email: 'session@example.com', fullName: '' },
    })
    const unsubscribe = repository.onAuthStateChange(listener)
    const callback = auth.onAuthStateChange.mock.calls[0][0]
    callback('SIGNED_IN', { user: { id: 'user-3', email: 'session@example.com', user_metadata: {} } })

    expect(listener).toHaveBeenCalledWith({
      user: { id: 'user-3', email: 'session@example.com', fullName: '' },
    })
    unsubscribe()
  })

  it('propagates Supabase sign-in errors', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: new Error('Invalid login credentials') })
    const { SupabaseAuthRepository } = await import('./SupabaseAuthRepository')
    const repository = new SupabaseAuthRepository()

    await expect(repository.signIn('user@example.com', 'wrong')).rejects.toThrow('Invalid login credentials')
  })
})
