import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

/**
 * Current auth state:
 *   loading      – true until the session (and profile, if signed in) is known
 *   user         – Supabase auth user or null
 *   profile      – row from public.profiles or null
 *   profileError – error loading the profile, if any
 *   isAdmin      – profile.role === 'admin' (UI only; the database enforces access)
 *   isRecovery   – user arrived via a password-reset link
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
