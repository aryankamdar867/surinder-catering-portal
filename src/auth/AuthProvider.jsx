import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase.js'
import { fetchProfile } from '@/services/profileService.js'
import { signOut as signOutRequest } from '@/services/authService.js'
import { AuthContext } from './AuthContext.js'

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [initializing, setInitializing] = useState(true)
  const [isRecovery, setIsRecovery] = useState(false)
  // Profile is stored together with the user id it belongs to, so a stale
  // profile is never shown after switching accounts.
  const [profileState, setProfileState] = useState({ userId: null, profile: null, error: null })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    // Resolves after any ?code= in the URL (email confirmation / password reset) is exchanged.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session ?? null)
      setInitializing(false)
    })

    // Keep this callback synchronous: Supabase warns against awaiting other
    // Supabase calls inside it. Profile loading happens in the effect below.
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
      if (event === 'SIGNED_OUT') setIsRecovery(false)
      setSession(nextSession)
      setInitializing(false)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId) return
    let active = true
    fetchProfile(userId).then(
      (profile) => active && setProfileState({ userId, profile, error: null }),
      (error) => active && setProfileState({ userId, profile: null, error }),
    )
    return () => {
      active = false
    }
  }, [userId, reloadKey])

  const profileLoaded = userId !== null && profileState.userId === userId
  const profile = profileLoaded ? profileState.profile : null
  const profileError = profileLoaded ? profileState.error : null

  const setProfile = useCallback((next) => setProfileState({ userId: next.id, profile: next, error: null }), [])
  const reloadProfile = useCallback(() => setReloadKey((key) => key + 1), [])
  const signOut = useCallback(() => signOutRequest(), [])

  const value = useMemo(
    () => ({
      loading: initializing || (userId !== null && !profileLoaded),
      session,
      user: session?.user ?? null,
      profile,
      profileError,
      isAdmin: profile?.role === 'admin',
      isRecovery,
      setProfile,
      reloadProfile,
      signOut,
    }),
    [initializing, userId, profileLoaded, session, profile, profileError, isRecovery, setProfile, reloadProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
