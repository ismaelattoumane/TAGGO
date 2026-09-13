import { buildAuthRedirectUrl } from '../lib/runtime'
import { supabase } from '../lib/supabase'

function requireClient(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('La configuration Supabase est manquante.')
  return supabase as NonNullable<typeof supabase>
}

export async function signIn(email: string, password: string) {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await requireClient().auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: buildAuthRedirectUrl('/login'),
    },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await requireClient().auth.signOut()
  if (error) throw error
}
