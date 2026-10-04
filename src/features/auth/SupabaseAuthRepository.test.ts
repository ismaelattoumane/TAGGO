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

  it('never logs the password it forwards to Supabase Auth', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com', user_metadata: {} } },
      error: null,
    })
    auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    auth.updateUser.mockResolvedValue({ error: null })
    const { SupabaseAuthRepository } = await import('./SupabaseAuthRepository')
    const repository = new SupabaseAuthRepository()

    await repository.signIn('user@example.com', 'StrongPass123!')
    await repository.requestPasswordReset('user@example.com')
    await repository.updatePassword('AnotherStrong123!')

    const logged = [...warn.mock.calls, ...log.mock.calls].flat().join(' ')
    expect(logged).not.toContain('StrongPass123!')
    expect(logged).not.toContain('AnotherStrong123!')
    warn.mockRestore()
    log.mockRestore()
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

  it('requests email changes through Supabase Auth with an internal confirmation redirect', async () => {
    auth.updateUser.mockResolvedValue({ error: null })
    const { SupabaseAuthRepository } = await import('./SupabaseAuthRepository')
    const repository = new SupabaseAuthRepository()

    await repository.requestEmailChange(' new@example.com ')

    expect(auth.updateUser).toHaveBeenCalledWith(
      { email: 'new@example.com' },
      { emailRedirectTo: `${window.location.origin}/settings` },
    )
  })

  it('never sends the password to the reset request and keeps storage empty', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    const { SupabaseAuthRepository } = await import('./SupabaseAuthRepository')
    const repository = new SupabaseAuthRepository()

    await repository.requestPasswordReset('user@example.com')

    // Le repository ne reçoit et ne transmet que l'adresse : aucun mot de
    // passe, aucun token n'est fabriqué par TAGGO.
    const [email, options] = auth.resetPasswordForEmail.mock.calls[0]
    expect(email).toBe('user@example.com')
    expect(Object.keys(options)).toEqual(['redirectTo'])
    expect(typeof options.redirectTo).toBe('string')
    expect(window.localStorage.length).toBe(0)
  })

  it('propagates Supabase reset errors without leaking a generic success path', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: new Error('rate limited') })
    const { SupabaseAuthRepository } = await import('./SupabaseAuthRepository')
    const repository = new SupabaseAuthRepository()

    await expect(repository.requestPasswordReset('user@example.com')).rejects.toThrow('rate limited')
  })

  it('always redirects the reset link to an allow-listed internal path', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'user-9', email: 'a@example.com', user_metadata: {} }, session: { user: {} } },
      error: null,
    })
    const { SupabaseAuthRepository } = await import('./SupabaseAuthRepository')
    const repository = new SupabaseAuthRepository()

    await repository.requestPasswordReset('user@example.com')
    await repository.signUp({ email: 'a@example.com', password: 'StrongPass123!', fullName: 'A' })

    const resetOptions = auth.resetPasswordForEmail.mock.calls[0][1]
    const signupOptions = auth.signUp.mock.calls[0][0].options

    expect(resetOptions.redirectTo).toBe(`${window.location.origin}/reset-password`)
    expect(signupOptions.emailRedirectTo).toBe(`${window.location.origin}/login`)
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
