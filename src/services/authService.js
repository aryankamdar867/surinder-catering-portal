import { supabase } from '@/lib/supabase.js'

const appUrl = (path) => `${window.location.origin}${path}`

/**
 * Register a customer. Name/phone go into user metadata; the database trigger
 * copies them into public.profiles (role is always 'customer').
 * Returns { needsConfirmation } – true when the user must click the email link.
 */
export async function signUp({ fullName, email, phone, password }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, ...(phone ? { phone } : {}) },
      emailRedirectTo: appUrl('/account'),
    },
  })
  if (error) throw error
  return { needsConfirmation: !data.session }
}

export async function signIn({ email, password }) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function resendConfirmation(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: appUrl('/account') },
  })
  if (error) throw error
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl('/reset-password'),
  })
  if (error) throw error
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
